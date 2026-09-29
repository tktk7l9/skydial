// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createMapView } from "./index";
import { createTestCtx } from "../../test-utils/testCtx";
import type { AppState } from "../../state/appState";
import type { View } from "../../app";
import { dismissToast } from "../../ui/toast";

const TOKYO = { lat: 35.6762, lng: 139.6503 };

function mount(patch: Partial<AppState> = {}) {
  const ctx = createTestCtx({ time: new Date("2026-06-21T03:00:00Z"), utcOffsetMin: 540, ...patch });
  const view: View = createMapView(ctx);
  document.body.replaceChildren(view.root);
  const render = (): void => {
    const s = ctx.store.get();
    view.update(s, s.time ?? new Date());
  };
  ctx.store.subscribe(render);
  render();
  return { ctx, view, root: within(view.root) };
}

describe("map view", () => {
  afterEach(() => {
    dismissToast();
    document.body.replaceChildren();
  });

  it("explains every line in the legend", () => {
    const { root } = mount();
    for (const label of ["太陽の方向", "月の方向", "日の出方向", "日の入り方向", "月の出方向", "月の入り方向"]) {
      expect(root.getByText(label)).toBeVisible();
    }
    expect(root.getByText("地図をタップして地点を設定")).toBeVisible();
  });

  it("rejects unreadable coordinates in place", async () => {
    const { ctx, root } = mount();
    const input = root.getByRole("textbox", { name: "緯度, 経度" });
    await userEvent.type(input, "somewhere{Enter}");
    expect(root.getByRole("status")).toHaveTextContent("「緯度, 経度」の形で入力してください");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveValue("somewhere");
    expect(ctx.store.get().locationSource).toBe("default");
  });

  it("moves to typed coordinates at once and offers undo", async () => {
    const { ctx, root } = mount();
    const input = root.getByRole("textbox", { name: "緯度, 経度" });
    await userEvent.type(input, "x{Enter}");
    await userEvent.clear(input);
    await userEvent.type(input, "35.0116, 135.7681");
    await userEvent.click(root.getByRole("button", { name: "移動" }));
    expect(ctx.store.get().location).toEqual({ lat: 35.0116, lng: 135.7681 });
    expect(ctx.store.get().locationSource).toBe("manual");
    expect(input).toHaveValue("");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(root.queryByText(/の形で入力してください/)).not.toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(ctx.store.get().location).toEqual(TOKYO);
    expect(ctx.store.get().locationSource).toBe("default");
  });

  it("sets the location from a tap on the map", async () => {
    const { ctx } = mount();
    const host = document.querySelector(".leaflet-host") as HTMLElement;
    host.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 0, clientY: 0 }));
    expect(ctx.store.get().locationSource).toBe("manual");
    expect(screen.getByText("地点を変更しました")).toBeVisible();
  });

  it("credits the chosen tile source", () => {
    const { ctx } = mount();
    expect(document.querySelector(".leaflet-control-attribution")).toHaveTextContent("OpenStreetMap");
    ctx.store.set({ tiles: "gsi" });
    expect(document.querySelector(".leaflet-control-attribution")).toHaveTextContent("国土地理院");
    expect(document.querySelector(".leaflet-control-attribution")).not.toHaveTextContent("OpenStreetMap");
  });

  it("draws rays by day and drops the sunrise/sunset bearings at the pole", () => {
    const { ctx } = mount();
    const paths = (): number =>
      [...document.querySelectorAll("path.leaflet-interactive, .leaflet-overlay-pane path")].filter(
        (p) => (p.getAttribute("d") ?? "") !== "" && p.getAttribute("d") !== "M0 0",
      ).length;
    const daytime = paths();
    expect(daytime).toBeGreaterThanOrEqual(3);
    ctx.store.set({ location: { lat: 69.65, lng: 18.96 }, utcOffsetMin: 120 });
    expect(paths()).toBeLessThan(daytime);
    ctx.store.set({ location: { lat: 69.65, lng: 18.96 }, time: new Date("2026-12-21T12:00:00Z") });
    ctx.store.set({ location: TOKYO, time: new Date("2026-06-21T15:00:00Z") });
    expect(paths()).toBeGreaterThanOrEqual(2);
  });

  it("tears the map down on destroy", () => {
    const { view } = mount();
    view.destroy?.();
    expect(document.querySelector(".leaflet-control-attribution")).not.toBeInTheDocument();
  });
});
