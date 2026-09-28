// @vitest-environment jsdom
import { waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createArView } from "./index";
import { createTestCtx } from "../../test-utils/testCtx";
import { stubCanvas } from "../../test-utils/fakeCanvas";
import type { View } from "../../app";

class FakeMediaStream {
  stopped = 0;
  getTracks() {
    return [{ stop: () => (this.stopped += 1) }];
  }
}

let canvas: ReturnType<typeof stubCanvas>;
const nav = navigator as unknown as Record<string, unknown>;

function mount(locationSource: "default" | "gps" = "gps") {
  const ctx = createTestCtx({
    location: { lat: 35.68, lng: 139.65 },
    locationSource,
    time: new Date("2026-06-21T03:00:00Z"),
    utcOffsetMin: 540,
  });
  const view: View = createArView(ctx);
  Object.defineProperty(view.root, "clientWidth", { value: 400, configurable: true });
  Object.defineProperty(view.root, "clientHeight", { value: 800, configurable: true });
  document.body.replaceChildren(view.root);
  view.update(ctx.store.get(), new Date());
  return { ctx, view, root: within(view.root) };
}

/** Wait for the draw loop to paint a frame containing `text`. */
async function drawn(text: string | RegExp): Promise<void> {
  await waitFor(() => {
    const texts = canvas.latest().texts;
    const hit = texts.some((t) => (typeof text === "string" ? t === text : text.test(t)));
    expect(hit).toBe(true);
  });
}

function orientationEvent(type: string, fields: Record<string, unknown>): Event {
  return Object.assign(new Event(type), fields);
}

describe("AR view", () => {
  beforeEach(() => {
    canvas = stubCanvas();
    (globalThis as Record<string, unknown>).MediaStream = FakeMediaStream;
  });
  afterEach(() => {
    canvas.restore();
    delete nav.mediaDevices;
    delete nav.wakeLock;
    delete (globalThis as Record<string, unknown>).DeviceOrientationEvent;
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("explains itself before asking for any permission", () => {
    const getUserMedia = vi.fn();
    nav.mediaDevices = { getUserMedia };
    const { root } = mount();
    expect(root.getByRole("heading", { name: "ARコンパス" })).toBeVisible();
    expect(root.getByText(/モーションセンサーとカメラの許可が必要です/)).toBeVisible();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("falls back to drag-to-look without sensors or camera", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const { root, view } = mount();
    await userEvent.click(root.getByRole("button", { name: "ARを開始" }), {
      advanceTimers: vi.advanceTimersByTime,
    } as never);
    expect(root.queryByRole("heading", { name: "ARコンパス" })).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1500);
    await vi.waitFor(() =>
      expect(root.getByText("この端末にはコンパスがありません — ドラッグで見回せます。")).toBeVisible(),
    );
    // The camera never arrived, so the video is hidden (sky gradient shows).
    expect(view.root.querySelector("video")).not.toBeVisible();
    // No camera hint on top of the virtual one.
    expect(root.queryByText(/カメラが使えません/)).not.toBeInTheDocument();
    vi.useRealTimers();

    await drawn("180°");
    const down = Object.assign(new MouseEvent("pointerdown", { clientX: 200, clientY: 400 }), { pointerId: 1 });
    view.root.dispatchEvent(down);
    view.root.dispatchEvent(Object.assign(new MouseEvent("pointermove", { clientX: 100, clientY: 400 }), { pointerId: 1 }));
    // Dragging left by a quarter screen turns 15° to the right.
    await drawn("195°");
    view.root.dispatchEvent(new MouseEvent("pointerup"));
    view.root.dispatchEvent(Object.assign(new MouseEvent("pointermove", { clientX: 0, clientY: 0 }), { pointerId: 1 }));
    view.destroy?.();
  });

  it("uses the iPhone compass once motion access is granted, and the camera", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const stream = new FakeMediaStream();
    nav.mediaDevices = { getUserMedia: vi.fn().mockResolvedValue(stream) };
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    nav.wakeLock = { request };
    const requestPermission = vi.fn().mockResolvedValue("granted");
    (globalThis as Record<string, unknown>).DeviceOrientationEvent = { requestPermission };

    const { root, view } = mount();
    await userEvent.click(root.getByRole("button", { name: "ARを開始" }));
    expect(requestPermission).toHaveBeenCalled();
    window.dispatchEvent(orientationEvent("deviceorientation", { alpha: 0, beta: null, gamma: 0 }));
    window.dispatchEvent(
      orientationEvent("deviceorientation", { alpha: 0, beta: 90, gamma: 0, webkitCompassHeading: 90 }),
    );
    await drawn("90°");
    await waitFor(() => expect(play).toHaveBeenCalled());
    expect(view.root.querySelector("video")).toBeVisible();
    expect(request).toHaveBeenCalledWith("screen");

    // Coming back to the page re-takes the wake lock.
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    view.destroy?.();
    expect(stream.stopped).toBe(1);
    await waitFor(() => expect(release).toHaveBeenCalled());
    play.mockRestore();
  });

  it("falls back when motion access is refused or fails", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    for (const requestPermission of [
      vi.fn().mockResolvedValue("denied"),
      vi.fn().mockRejectedValue(new Error("no gesture")),
    ]) {
      (globalThis as Record<string, unknown>).DeviceOrientationEvent = { requestPermission };
      const { root, view } = mount();
      root.getByRole("button", { name: "ARを開始" }).click();
      await vi.waitFor(() =>
        expect(root.getByText(/この端末にはコンパスがありません/)).toBeVisible(),
      );
      await vi.advanceTimersByTimeAsync(6000);
      expect(root.getByText(/この端末にはコンパスがありません/)).not.toBeVisible();
      view.destroy?.();
    }
  });

  it("corrects Android's magnetic heading and says when the camera is refused", async () => {
    nav.mediaDevices = { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) };
    nav.wakeLock = { request: vi.fn().mockRejectedValue(new Error("low battery")) };
    const { root, view } = mount();
    await userEvent.click(root.getByRole("button", { name: "ARを開始" }));
    window.dispatchEvent(
      orientationEvent("deviceorientationabsolute", { alpha: 0, beta: 90, gamma: 0, absolute: true }),
    );
    expect(await root.findByText("カメラが使えません — 空のグラデーションを表示します")).toBeVisible();
    // Magnetic north in Tokyo is ~7-8° west of true north.
    await drawn(/^35[23]°$/);
    view.destroy?.();
  });

  it("can be torn down before it was ever started", () => {
    const { view } = mount();
    expect(() => view.destroy?.()).not.toThrow();
  });
});
