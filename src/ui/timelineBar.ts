// The day timeline: layered horizontal bands for night → twilights → day,
// with golden/blue hour overlays and a "now" marker.

import type { SunDayEvents } from "../astro/events";
import type { Interval } from "../astro/types";
import { el } from "./dom";

const COLORS = {
  night: "#0a0f24",
  astro: "#141d3f",
  nautical: "#22305e",
  civil: "#3c5590",
  day: "#7cb3e8",
  golden: "rgb(240 163 94 / 85%)",
  blue: "rgb(96 130 220 / 85%)",
};

function frac(dayStart: Date, t: Date): number {
  return Math.min(1, Math.max(0, (t.getTime() - dayStart.getTime()) / 86_400_000));
}

function seg(from: number, to: number, color: string): HTMLElement {
  const s = el("div", { class: "seg" });
  s.style.left = `${(from * 100).toFixed(3)}%`;
  s.style.width = `${(Math.max(0, to - from) * 100).toFixed(3)}%`;
  s.style.background = color;
  return s;
}

export function buildTimeline(
  dayStart: Date,
  events: SunDayEvents,
  golden: Interval[],
  blue: Interval[],
  now: Date,
): HTMLElement {
  const bar = el("div", { class: "timeline" });
  bar.append(seg(0, 1, COLORS.night));

  // Twilight bands, widest (astro) first so narrower ones layer on top.
  const layer = (dawn: Date | null, dusk: Date | null, color: string): void => {
    const from = dawn === null ? 0 : frac(dayStart, dawn);
    const to = dusk === null ? 1 : frac(dayStart, dusk);
    // Both absent means the band never occurs (e.g. polar night daytime) —
    // but absent dawn with a present dusk (or vice versa) still spans the edge.
    if (dawn === null && dusk === null) return;
    bar.append(seg(from, to, color));
  };
  layer(events.astronomicalDawn, events.astronomicalDusk, COLORS.astro);
  layer(events.nauticalDawn, events.nauticalDusk, COLORS.nautical);
  layer(events.civilDawn, events.civilDusk, COLORS.civil);

  if (events.riseSet.kind === "alwaysUp") {
    bar.append(seg(0, 1, COLORS.day));
  } else if (events.riseSet.kind === "normal") {
    const { rise, set } = events.riseSet;
    if (rise !== null || set !== null) {
      const from = rise === null ? 0 : frac(dayStart, rise);
      const to = set === null ? 1 : frac(dayStart, set);
      if (to > from) {
        bar.append(seg(from, to, COLORS.day));
      } else {
        // Sun already up at midnight: day spans both edges.
        bar.append(seg(0, to, COLORS.day));
        bar.append(seg(from, 1, COLORS.day));
      }
    }
  }

  for (const iv of golden) {
    bar.append(seg(frac(dayStart, iv.start), frac(dayStart, iv.end), COLORS.golden));
  }
  for (const iv of blue) {
    bar.append(seg(frac(dayStart, iv.start), frac(dayStart, iv.end), COLORS.blue));
  }

  const marker = el("div", { class: "marker" });
  marker.style.left = `${(frac(dayStart, now) * 100).toFixed(3)}%`;
  bar.append(marker);
  return bar;
}
