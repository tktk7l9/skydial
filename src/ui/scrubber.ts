// Persistent time scrubber: drag the track to move through time (3 min/px),
// tap the date to open a picker, "Now" returns to live ticking.

import type { AppState } from "../state/appState";
import { effectiveTime } from "../state/appState";
import type { AppCtx } from "../app";
import { el } from "./dom";

const MS_PER_PX = 3 * 60 * 1000;

export function createScrubber(ctx: AppCtx): {
  root: HTMLElement;
  update(s: AppState): void;
} {
  const dateEl = el("div", { class: "d" });
  const timeEl = el("div", { class: "t" });

  // Hidden native picker, opened from the date/time display.
  const picker = el("input", {
    type: "datetime-local",
    class: "vh",
    tabindex: "-1",
    "aria-label": ctx.tr("scrubHint"),
  });
  picker.addEventListener("change", () => {
    if (picker.value === "") return;
    const picked = new Date(picker.value);
    if (!Number.isNaN(picked.getTime())) ctx.store.set({ time: picked });
  });

  const datetime = el(
    "button",
    {
      type: "button",
      class: "datetime",
      onclick: () => {
        const s = ctx.store.get();
        const base = effectiveTime(s);
        // Pre-fill with the current instant in device-local wall time.
        const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);
        picker.value = local.toISOString().slice(0, 16);
        if ("showPicker" in picker) picker.showPicker();
      },
    },
    dateEl,
    timeEl,
  );

  // Pointer-only affordance; keyboard/AT users pick a time via the button →
  // native datetime picker instead.
  const track = el(
    "div",
    { class: "track", "aria-hidden": "true" },
    el("div", { class: "ticks" }),
    el("div", { class: "centerline" }),
  );

  let dragBase: { x: number; time: number } | null = null;
  let pendingDx = 0;
  let raf = 0;

  const applyDrag = (): void => {
    raf = 0;
    if (dragBase === null) return;
    ctx.store.set({ time: new Date(dragBase.time - pendingDx * MS_PER_PX) });
  };

  track.addEventListener("pointerdown", (ev) => {
    track.setPointerCapture(ev.pointerId);
    dragBase = { x: ev.clientX, time: effectiveTime(ctx.store.get()).getTime() };
  });
  track.addEventListener("pointermove", (ev) => {
    if (dragBase === null) return;
    pendingDx = ev.clientX - dragBase.x;
    if (raf === 0) raf = requestAnimationFrame(applyDrag);
  });
  const endDrag = (): void => {
    dragBase = null;
    pendingDx = 0;
  };
  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  const nowBtn = el(
    "button",
    {
      type: "button",
      class: "now-btn",
      onclick: () => ctx.store.set({ time: null }),
    },
    ctx.tr("now"),
  );

  const root = el("div", { class: "scrubber" }, datetime, picker, track, nowBtn);

  return {
    root,
    update(s) {
      const t = effectiveTime(s);
      dateEl.textContent = ctx.fmtDate(t);
      // HH:MM even while live — a seconds readout would repaint every tick.
      timeEl.textContent = ctx.fmtTime(t);
      nowBtn.classList.toggle("live", s.time === null);
      nowBtn.textContent = s.time === null ? ctx.tr("live") : ctx.tr("now");
    },
  };
}
