// Persistent time scrubber: drag the track to move through time (3 min/px),
// tap the date to open a picker, "Back to now" returns to live ticking.
//
// SHIG 49: live-ness is a state shown as a badge next to the clock, and the
// button only ever means one action ("Back to now"), hidden while live.
// SHIG 4, 31: the track carries hour labels and, until the first drag, a
// hint that it can be dragged.

import type { AppState } from "../state/appState";
import { effectiveTime } from "../state/appState";
import type { AppCtx } from "../app";
import { el } from "./dom";

const MS_PER_PX = 3 * 60 * 1000;
const PX_PER_HOUR = 3_600_000 / MS_PER_PX;
const TICK_HOURS = [2, 6, 10] as const;
const HINT_KEY = "skydial:scrub-hinted";

function readHinted(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHinted(): void {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    // Storage may be unavailable (private mode); the hint just shows again.
  }
}

export function createScrubber(ctx: AppCtx): {
  root: HTMLElement;
  update(s: AppState): void;
} {
  const dateEl = el("div", { class: "d" });
  const timeEl = el("span", {});
  const liveBadge = el(
    "span",
    { class: "live-badge" },
    el("span", { class: "live-dot", "aria-hidden": "true" }),
    ctx.tr("live"),
  );

  // Hidden native picker, opened from the date/time display.
  const picker = el("input", {
    type: "datetime-local",
    class: "vh",
    tabindex: "-1",
    "aria-label": ctx.tr("scrubHint"),
  });
  // The picker speaks the same wall time as the clock above it: the chosen
  // UTC offset for a remote place, else the device zone.
  picker.addEventListener("change", () => {
    if (picker.value === "") return;
    const offset = ctx.store.get().utcOffsetMin;
    const picked =
      offset === null
        ? new Date(picker.value)
        : new Date(Date.parse(`${picker.value}Z`) - offset * 60_000);
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
        // Pre-fill with the wall time the clock shows (display zone).
        const offsetMin = s.utcOffsetMin ?? -base.getTimezoneOffset();
        const wall = new Date(base.getTime() + offsetMin * 60_000);
        picker.value = wall.toISOString().slice(0, 16);
        if ("showPicker" in picker) picker.showPicker();
      },
    },
    dateEl,
    el("div", { class: "t" }, timeEl, liveBadge),
  );

  // Hour labels either side of the centre line: dragging right brings the
  // left side (the past) to the centre.
  const labels = el("div", { class: "tick-labels" });
  const tickEls: Array<{ node: HTMLElement; offsetPx: number }> = [];
  for (const h of TICK_HOURS) {
    for (const sign of [-1, 1] as const) {
      const node = el(
        "span",
        { class: "tick-label" },
        ctx.tr(sign < 0 ? "scrubTickBefore" : "scrubTickAfter", { h }),
      );
      labels.append(node);
      tickEls.push({ node, offsetPx: sign * h * PX_PER_HOUR });
    }
  }
  const hint = el("div", { class: "track-hint" }, ctx.tr("scrubFirstHint"));
  hint.hidden = readHinted();
  // The hint covers the track; its labels come in once it is dismissed.
  labels.hidden = !hint.hidden;

  // Pointer-only affordance; keyboard/AT users pick a time via the button →
  // native datetime picker instead.
  const track = el(
    "div",
    { class: "track", "aria-hidden": "true" },
    el("div", { class: "ticks" }),
    labels,
    el("div", { class: "centerline" }),
    hint,
  );

  const layoutTicks = (): void => {
    const half = track.clientWidth / 2;
    for (const { node, offsetPx } of tickEls) {
      node.style.left = `${half + offsetPx}px`;
      // Only show labels that fit whole inside the track.
      node.hidden = false;
      node.hidden = Math.abs(offsetPx) + node.offsetWidth / 2 + 2 > half;
    }
  };
  new ResizeObserver(layoutTicks).observe(track);

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
    if (!hint.hidden) {
      hint.hidden = true;
      labels.hidden = false;
      writeHinted();
      layoutTicks();
    }
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
    ctx.tr("backToNow"),
  );

  const root = el("div", { class: "scrubber" }, datetime, picker, track, nowBtn);

  return {
    root,
    update(s) {
      const t = effectiveTime(s);
      const live = s.time === null;
      dateEl.textContent = ctx.fmtDate(t);
      // HH:MM even while live — a seconds readout would repaint every tick.
      timeEl.textContent = ctx.fmtTime(t);
      liveBadge.hidden = !live;
      nowBtn.hidden = live;
    },
  };
}
