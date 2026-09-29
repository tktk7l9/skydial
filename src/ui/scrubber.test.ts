// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createScrubber } from "./scrubber";
import { createTestCtx } from "../test-utils/testCtx";

function mount(patch = {}) {
  const ctx = createTestCtx({ utcOffsetMin: 540, ...patch });
  const scrubber = createScrubber(ctx);
  document.body.replaceChildren(scrubber.root);
  ctx.store.subscribe((s) => scrubber.update(s));
  scrubber.update(ctx.store.get());
  return { ctx, scrubber, root: within(scrubber.root) };
}

function pointer(target: Element, type: string, clientX: number): void {
  const ev = new MouseEvent(type, { bubbles: true, clientX });
  Object.defineProperty(ev, "pointerId", { value: 1 });
  target.dispatchEvent(ev);
}

describe("time scrubber", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => document.body.replaceChildren());

  it("shows the live badge and hides 'Back to now' while live", () => {
    const { root } = mount();
    expect(root.getByText("ライブ")).toBeVisible();
    expect(root.getByText("今に戻る")).not.toBeVisible();
  });

  it("shows the picked instant and returns to live with one press", async () => {
    const { ctx, root } = mount({ time: new Date("2026-06-21T03:00:00Z") });
    expect(root.getByRole("button", { name: /12:00/ })).toBeVisible();
    expect(root.getByText("ライブ")).not.toBeVisible();
    await userEvent.click(root.getByRole("button", { name: "今に戻る" }));
    expect(ctx.store.get().time).toBeNull();
    expect(root.getByText("ライブ")).toBeVisible();
  });

  it("drags the track to move through time (3 min per px, right = past)", async () => {
    const { ctx } = mount({ time: new Date("2026-06-21T03:00:00Z") });
    const track = document.querySelector(".track") as HTMLElement;
    expect(screen.getByText("左右にドラッグで時刻を変更")).toBeVisible();

    pointer(track, "pointerdown", 100);
    pointer(track, "pointermove", 120);
    await new Promise((r) => requestAnimationFrame(r));
    expect(ctx.store.get().time?.toISOString()).toBe("2026-06-21T02:00:00.000Z");
    pointer(track, "pointerup", 120);
    pointer(track, "pointermove", 200); // ignored once released
    await new Promise((r) => requestAnimationFrame(r));
    expect(ctx.store.get().time?.toISOString()).toBe("2026-06-21T02:00:00.000Z");

    // The first-drag hint is dismissed for good; hour labels take its place.
    expect(screen.queryByText("左右にドラッグで時刻を変更")).not.toBeVisible();
    expect(localStorage.getItem("skydial:scrub-hinted")).toBe("1");
    mount();
    expect(screen.queryByText("左右にドラッグで時刻を変更")).not.toBeVisible();
    expect(screen.getAllByText(/時間前|時間後/).length).toBe(6);
  });

  it("cancelling a drag stops it", async () => {
    const { ctx } = mount({ time: new Date("2026-06-21T03:00:00Z") });
    const track = document.querySelector(".track") as HTMLElement;
    pointer(track, "pointerdown", 0);
    pointer(track, "pointercancel", 0);
    pointer(track, "pointermove", 50);
    await new Promise((r) => requestAnimationFrame(r));
    expect(ctx.store.get().time?.toISOString()).toBe("2026-06-21T03:00:00.000Z");
  });

  it("opens the native picker pre-filled in the displayed zone and applies a picked date", async () => {
    // A remote place (UTC-5) is shown in its own time, not the device's.
    const { ctx, root } = mount({ time: new Date("2026-06-21T03:00:00Z"), utcOffsetMin: -300 });
    const picker = document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    const showPicker = vi.fn();
    picker.showPicker = showPicker;
    const shown = root.getByRole("button", { name: /22:00/ });
    await userEvent.click(shown);
    expect(showPicker).toHaveBeenCalled();
    // The picker starts at the same wall time the button shows.
    expect(picker.value).toBe("2026-06-20T22:00");

    picker.value = "2026-12-22T09:30";
    picker.dispatchEvent(new Event("change"));
    expect(ctx.store.get().time?.toISOString()).toBe("2026-12-22T14:30:00.000Z");
    expect(shown).toHaveTextContent("09:30");

    // Clearing the field keeps the current time.
    picker.value = "";
    picker.dispatchEvent(new Event("change"));
    expect(ctx.store.get().time?.toISOString()).toBe("2026-12-22T14:30:00.000Z");
  });

  it("uses the device's wall time when no offset is set", async () => {
    const { ctx, root } = mount({ time: new Date("2026-06-21T03:00:00Z"), utcOffsetMin: null });
    const picker = document.querySelector<HTMLInputElement>('input[type="datetime-local"]')!;
    await userEvent.click(root.getByRole("button", { name: /2026/ }));
    const t = new Date("2026-06-21T03:00:00Z");
    const pad = (n: number): string => String(n).padStart(2, "0");
    expect(picker.value).toBe(
      `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`,
    );
    picker.value = "2026-12-22T09:30";
    picker.dispatchEvent(new Event("change"));
    expect(ctx.store.get().time?.getTime()).toBe(new Date(2026, 11, 22, 9, 30).getTime());
  });

  it("still works when storage is unavailable", () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    const track = document.querySelector(".track") as HTMLElement;
    expect(screen.getByText("左右にドラッグで時刻を変更")).toBeVisible();
    pointer(track, "pointerdown", 0);
    expect(screen.queryByText("左右にドラッグで時刻を変更")).not.toBeVisible();
    get.mockRestore();
    set.mockRestore();
  });

  it("shows only the hour labels that fit the track width", () => {
    localStorage.setItem("skydial:scrub-hinted", "1");
    const callbacks: Array<() => void> = [];
    const Original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(cb: () => void) {
        callbacks.push(cb);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
    mount();
    globalThis.ResizeObserver = Original;
    const track = document.querySelector(".track") as HTMLElement;
    Object.defineProperty(track, "clientWidth", { value: 200, configurable: true });
    callbacks.forEach((cb) => cb());
    // 20 px per hour: ±2 h fits in a 200 px track, ±6 h and ±10 h do not.
    expect(screen.getByText("2時間前")).toBeVisible();
    expect(screen.getByText("2時間後")).toBeVisible();
    expect(screen.getByText("6時間前")).not.toBeVisible();
    expect(screen.getByText("10時間後")).not.toBeVisible();
  });
});
