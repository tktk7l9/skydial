// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createDomeView } from "./index";
import { createTestCtx } from "../../test-utils/testCtx";
import { stubCanvas } from "../../test-utils/fakeCanvas";
import type { View } from "../../app";
import type { AppState } from "../../state/appState";
import { clampHouse, defaultHouse } from "../../sunsim/house";

// jsdom has no WebGL. The scene graph (paths, house meshes) is real; only the
// GPU renderer is replaced, and it counts the frames it was asked to draw.
const gl = vi.hoisted(() => ({ frames: 0, disposed: 0 }));
vi.mock("three", async (importOriginal) => {
  const THREE = await importOriginal<typeof import("three")>();
  class FakeRenderer {
    shadowMap = { enabled: false, type: 0 };
    setPixelRatio(): void {}
    setSize(): void {}
    render(): void {
      gl.frames += 1;
    }
    dispose(): void {
      gl.disposed += 1;
    }
  }
  return { ...THREE, WebGLRenderer: FakeRenderer };
});

let canvas: ReturnType<typeof stubCanvas>;

function mount(patch: Partial<AppState> = {}) {
  const ctx = createTestCtx({
    time: new Date("2026-06-21T03:00:00Z"),
    utcOffsetMin: 540,
    ...patch,
  });
  ctx.toggleHouse = () =>
    ctx.store.set({ house: ctx.store.get().house === null ? clampHouse(defaultHouse()) : null });
  const view: View = createDomeView(ctx);
  document.body.replaceChildren(view.root);
  const render = (): void => {
    const s = ctx.store.get();
    view.update(s, s.time ?? new Date());
  };
  ctx.store.subscribe(render);
  render();
  return { ctx, view, root: within(view.root) };
}

const nextFrame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));

describe("dome view", () => {
  beforeEach(() => {
    canvas = stubCanvas();
    gl.frames = 0;
    gl.disposed = 0;
  });
  afterEach(() => {
    canvas.restore();
    document.body.replaceChildren();
  });

  it("labels the paths with the chosen date and draws on demand", async () => {
    const { ctx, root } = mount();
    expect(root.getByRole("img", { name: "太陽と月の軌道の3Dドーム" })).toBeInTheDocument();
    expect(root.getByText("ドラッグで回転 · ピンチでズーム")).toBeVisible();
    expect(root.getByText("太陽 · 6/21")).toBeVisible();
    expect(root.getByText("夏至")).toBeVisible();
    expect(root.getByText("冬至")).toBeVisible();
    await nextFrame();
    expect(gl.frames).toBeGreaterThan(0);

    ctx.store.set({ time: null });
    expect(root.getByText("太陽 · 今日")).toBeVisible();
    expect(root.getByText("月 · 今日")).toBeVisible();
  });

  it("turns the house on and off, showing its tools only while on", async () => {
    const { ctx, root } = mount();
    const houseChip = root.getByRole("button", { name: "家" });
    expect(houseChip).toHaveAttribute("aria-pressed", "false");
    expect(root.queryByRole("button", { name: "編集" })).not.toBeInTheDocument();

    await userEvent.click(houseChip);
    expect(ctx.store.get().house).not.toBeNull();
    expect(houseChip).toHaveAttribute("aria-pressed", "true");
    expect(root.getByRole("button", { name: "編集" })).toBeVisible();
    expect(root.getByRole("button", { name: "日射" })).toBeVisible();

    await userEvent.click(houseChip);
    expect(ctx.store.get().house).toBeNull();
    expect(root.queryByRole("button", { name: "日射" })).not.toBeInTheDocument();
  });

  it("opens the house editor and the results sheet", async () => {
    const { ctx, root } = mount({ house: clampHouse(defaultHouse()) });
    await userEvent.click(root.getByRole("button", { name: "編集" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("家の設定");
    // Edits re-render the 3D house straight away.
    ctx.store.set({ house: { ...ctx.store.get().house!, width: 12 } });
    document.querySelectorAll(".sheet, .sheet-backdrop").forEach((n) => n.remove());

    await userEvent.click(root.getByRole("button", { name: "日射" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("日射取得(快晴)");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: /6月21日|2026/ })).toBeVisible();
  });

  it("works in the southern hemisphere with the moon below the horizon", async () => {
    const { ctx } = mount({ location: { lat: -33.87, lng: 151.21 }, utcOffsetMin: 600 });
    ctx.store.set({ time: new Date("2026-06-21T14:00:00Z") });
    await nextFrame();
    expect(gl.frames).toBeGreaterThan(0);
  });

  it("animates while dragged unless reduced motion is on", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { view } = mount();
    const cnv = view.root.querySelector("canvas")!;
    await nextFrame();
    const before = gl.frames;
    cnv.dispatchEvent(new Event("pointerdown"));
    await nextFrame();
    expect(gl.frames).toBeGreaterThan(before);
    cnv.dispatchEvent(new Event("pointerup"));
    vi.advanceTimersByTime(1200);
    await nextFrame();
    await nextFrame();
    const settled = gl.frames;
    await nextFrame();
    await nextFrame();
    expect(gl.frames).toBe(settled);
    vi.useRealTimers();

    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({ matches: q.includes("reduce") })) as unknown as typeof window.matchMedia;
    const reduced = mount();
    await nextFrame();
    await nextFrame();
    const still = gl.frames;
    reduced.view.root.querySelector("canvas")!.dispatchEvent(new Event("pointerdown"));
    await nextFrame();
    expect(gl.frames).toBe(still);
    window.matchMedia = original;
  });

  it("releases the GPU resources on destroy", () => {
    const { view } = mount({ house: clampHouse(defaultHouse()) });
    view.destroy?.();
    expect(gl.disposed).toBe(1);
  });
});
