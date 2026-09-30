// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createGpsControl } from "./gpsControl";
import { createTestCtx } from "../test-utils/testCtx";
import { dismissToast } from "./toast";

function deferred(): { promise: Promise<boolean>; resolve(v: boolean): void } {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
}

describe("GPS control", () => {
  afterEach(() => {
    dismissToast();
    document.body.replaceChildren();
  });

  it("offers to undo a fix that replaced a named place (SHIG 54, 57)", async () => {
    const restoreLocation = vi.fn();
    const ctx = createTestCtx(
      { location: { lat: 34.7, lng: 135.5 }, locationSource: "manual", locationName: "実家" },
      { requestGps: () => Promise.resolve(true), restoreLocation },
    );
    document.body.append(createGpsControl(ctx));
    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    const undo = await screen.findByRole("button", { name: "元に戻す" });
    expect(screen.getByText("地点を変更しました")).toBeVisible();
    await userEvent.click(undo);
    expect(restoreLocation).toHaveBeenCalledWith({
      location: { lat: 34.7, lng: 135.5 },
      locationSource: "manual",
      locationName: "実家",
      utcOffsetMin: null,
    });
  });

  it("does not offer undo when nothing was set before", async () => {
    const ctx = createTestCtx({}, { requestGps: () => Promise.resolve(true) });
    document.body.append(createGpsControl(ctx));
    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "現在地を使う" })).toBeEnabled(),
    );
    expect(screen.queryByRole("button", { name: "元に戻す" })).not.toBeInTheDocument();
  });

  it("shows progress, blocks double presses, and reports success", async () => {
    const d = deferred();
    const onLocated = vi.fn();
    const ctx = createTestCtx({}, { requestGps: () => d.promise });
    document.body.append(createGpsControl(ctx, { onLocated }));

    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    const busy = screen.getByRole("button", { name: "取得中…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    d.resolve(true);
    await waitFor(() => expect(onLocated).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "現在地を使う" })).toBeEnabled();
    expect(screen.queryByText(/位置情報が使えません/)).not.toBeInTheDocument();
  });

  it("explains a failure and offers the map instead", async () => {
    const onOpenMap = vi.fn();
    const ctx = createTestCtx();
    document.body.append(createGpsControl(ctx, { primary: false, onOpenMap }));
    const button = screen.getByRole("button", { name: "現在地を使う" });
    expect(button).not.toHaveClass("primary");

    await userEvent.click(button);
    expect(await screen.findByText(/位置情報が使えません/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "地図を開く" }));
    expect(ctx.store.get().tab).toBe("map");
    expect(onOpenMap).toHaveBeenCalled();
  });

  it("can leave out the map link where the map is already open (SHIG 37)", async () => {
    const ctx = createTestCtx();
    document.body.append(createGpsControl(ctx, { mapLink: false }));
    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    expect(await screen.findByText(/位置情報が使えません/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "地図を開く" })).not.toBeInTheDocument();
  });

  it("works without callbacks", async () => {
    const ctx = createTestCtx({}, { requestGps: () => Promise.resolve(true) });
    document.body.append(createGpsControl(ctx));
    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "現在地を使う" })).toBeEnabled(),
    );
    const ctx2 = createTestCtx();
    document.body.replaceChildren(createGpsControl(ctx2));
    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    await userEvent.click(await screen.findByRole("button", { name: "地図を開く" }));
    expect(ctx2.store.get().tab).toBe("map");
  });
});
