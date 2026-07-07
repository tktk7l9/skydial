// Dashboard: current sun/moon hero cards, the day timeline, and the times
// grid. Day-level results are cached per (day, location) — only the cheap
// per-instant positions recompute on each live tick.

import { moonDayEvents, sunDayEvents } from "../astro/events";
import type { MoonDayEvents, SunDayEvents } from "../astro/events";
import { blueHours, goldenHours } from "../astro/goldenhour";
import { moonPosition } from "../astro/lunar";
import { moonGlyph, moonPhase } from "../astro/moonphase";
import { sunPosition } from "../astro/solar";
import type { GeoLocation, Interval } from "../astro/types";
import { dayStartFor } from "../state/dayWindow";
import type { AppState } from "../state/appState";
import type { AppCtx } from "../app";
import { clear, el } from "./dom";
import { buildTimeline } from "./timelineBar";

interface DayCache {
  key: string;
  dayStart: Date;
  sun: SunDayEvents;
  moon: MoonDayEvents;
  golden: Interval[];
  blue: Interval[];
}

function computeDay(time: Date, loc: GeoLocation, utcOffsetMin: number | null): DayCache {
  const dayStart = dayStartFor(time, utcOffsetMin);
  return {
    key: `${dayStart.getTime()}:${loc.lat.toFixed(4)}:${loc.lng.toFixed(4)}`,
    dayStart,
    sun: sunDayEvents(dayStart, loc),
    moon: moonDayEvents(dayStart, loc),
    golden: goldenHours(dayStart, loc),
    blue: blueHours(dayStart, loc),
  };
}

export function createDashboard(ctx: AppCtx): {
  root: HTMLElement;
  update(s: AppState, time: Date): void;
} {
  const root = el("div", {});
  let cache: DayCache | null = null;

  function timeRow(label: string, value: string, cls = ""): HTMLElement {
    return el(
      "div",
      { class: cls === "range" ? "time-row wide" : "time-row" },
      el("span", { class: "lbl" }, label),
      el("span", { class: `val ${cls}`.trim() }, value),
    );
  }

  function render(s: AppState, time: Date, day: DayCache): void {
    const loc = s.location;
    const sun = sunPosition(time, loc);
    const moon = moonPosition(time, loc);
    const phase = moonPhase(time);
    const fmtT = (d: Date | null): string => (d === null ? ctx.tr("noEvent") : ctx.fmtTime(d));

    clear(root);

    // --- Hero cards ---
    const sunCard = el(
      "div",
      { class: `card body-card sun${sun.altitude < 0 ? " below-horizon" : ""}` },
      el(
        "div",
        { class: "body-name" },
        el("span", { class: "dot" }),
        el("span", {}, ctx.tr("sun")),
      ),
      el(
        "div",
        { class: "big" },
        ctx.fmtDeg(sun.azimuth),
        el("span", { class: "dir" }, ctx.trDir(sun.azimuth)),
      ),
      el("div", { class: "sub" }, `${ctx.tr("altitude")} ${ctx.fmtDeg(sun.apparentAltitude)}`),
    );
    const moonCard = el(
      "div",
      { class: `card body-card moon${moon.altitude < 0 ? " below-horizon" : ""}` },
      el(
        "div",
        { class: "body-name" },
        el("span", { class: "dot" }),
        el("span", {}, `${ctx.tr("moon")} ${moonGlyph(phase.name)}`),
      ),
      el(
        "div",
        { class: "big" },
        ctx.fmtDeg(moon.azimuth),
        el("span", { class: "dir" }, ctx.trDir(moon.azimuth)),
      ),
      el(
        "div",
        { class: "sub" },
        `${ctx.tr("altitude")} ${ctx.fmtDeg(moon.apparentAltitude)} · ${ctx.fmtPct(phase.illumination)}`,
      ),
    );
    root.append(el("div", { class: "hero" }, sunCard, moonCard));

    // --- Timeline ---
    const timelineCard = el("div", { class: "card" }, el("h2", {}, ctx.fmtDate(time)));
    timelineCard.append(buildTimeline(day.dayStart, day.sun, day.golden, day.blue, time));
    const scale = el("div", { class: "timeline-scale" });
    for (const h of [0, 6, 12, 18, 24]) scale.append(el("span", {}, String(h)));
    timelineCard.append(scale);
    root.append(timelineCard);

    // --- Sun times ---
    const sunTimes = el("div", { class: "times" });
    if (day.sun.riseSet.kind === "alwaysUp") {
      sunTimes.append(el("div", { class: "polar-note" }, ctx.tr("midnightSun")));
    } else if (day.sun.riseSet.kind === "alwaysDown") {
      sunTimes.append(el("div", { class: "polar-note" }, ctx.tr("polarNight")));
    } else {
      sunTimes.append(
        timeRow(ctx.tr("sunrise"), fmtT(day.sun.riseSet.rise)),
        timeRow(ctx.tr("sunset"), fmtT(day.sun.riseSet.set)),
      );
      const { rise, set } = day.sun.riseSet;
      if (rise !== null && set !== null && set.getTime() > rise.getTime()) {
        sunTimes.append(
          timeRow(ctx.tr("dayLength"), ctx.fmtDur(set.getTime() - rise.getTime())),
        );
      }
    }
    sunTimes.append(timeRow(ctx.tr("solarNoon"), ctx.fmtTime(day.sun.solarNoon.time)));
    const ivText = (ivs: Interval[]): string =>
      ivs.length === 0
        ? ctx.tr("noEvent")
        : ivs.map((iv) => `${ctx.fmtTime(iv.start)}–${ctx.fmtTime(iv.end)}`).join(" / ");
    sunTimes.append(
      timeRow(ctx.tr("goldenHour"), ivText(day.golden), "range"),
      timeRow(ctx.tr("blueHour"), ivText(day.blue), "range"),
      timeRow(ctx.tr("civilDawn"), fmtT(day.sun.civilDawn)),
      timeRow(ctx.tr("civilDusk"), fmtT(day.sun.civilDusk)),
      timeRow(ctx.tr("nauticalDawn"), fmtT(day.sun.nauticalDawn)),
      timeRow(ctx.tr("nauticalDusk"), fmtT(day.sun.nauticalDusk)),
      timeRow(ctx.tr("astronomicalDawn"), fmtT(day.sun.astronomicalDawn)),
      timeRow(ctx.tr("astronomicalDusk"), fmtT(day.sun.astronomicalDusk)),
    );
    root.append(el("div", { class: "card" }, el("h2", {}, ctx.tr("sun")), sunTimes));

    // --- Moon times ---
    const moonTimes = el("div", { class: "times" });
    if (day.moon.riseSet.kind === "alwaysUp") {
      moonTimes.append(el("div", { class: "polar-note" }, ctx.tr("moonAlwaysUp")));
    } else if (day.moon.riseSet.kind === "alwaysDown") {
      moonTimes.append(el("div", { class: "polar-note" }, ctx.tr("moonAlwaysDown")));
    } else {
      moonTimes.append(
        timeRow(ctx.tr("moonrise"), fmtT(day.moon.riseSet.rise)),
        timeRow(ctx.tr("moonset"), fmtT(day.moon.riseSet.set)),
      );
    }
    if (day.moon.transit !== null) {
      moonTimes.append(timeRow(ctx.tr("moonTransit"), ctx.fmtTime(day.moon.transit.time)));
    }
    moonTimes.append(
      timeRow(
        ctx.tr("moonAge"),
        ctx.tr("moonAgeDays", { days: phase.ageDays.toFixed(1) }),
      ),
      timeRow(ctx.tr("illumination"), ctx.fmtPct(phase.illumination)),
      timeRow(
        `${moonGlyph(phase.name)}`,
        ctx.tr(ctx.phaseKey(phase.name)),
        "range",
      ),
    );
    root.append(el("div", { class: "card" }, el("h2", {}, ctx.tr("moon")), moonTimes));

    root.append(el("p", { class: "footnote" }, ctx.tr("accuracyNote")));
  }

  return {
    root,
    update(s, time) {
      const dayStart = dayStartFor(time, s.utcOffsetMin);
      const key = `${dayStart.getTime()}:${s.location.lat.toFixed(4)}:${s.location.lng.toFixed(4)}`;
      // The solver-heavy day events are cached per (day, location); the DOM
      // rebuild itself with cheap per-instant positions runs in well under
      // a millisecond at the 1 Hz live tick.
      if (cache === null || cache.key !== key) {
        cache = computeDay(time, s.location, s.utcOffsetMin);
      }
      render(s, time, cache);
    },
  };
}
