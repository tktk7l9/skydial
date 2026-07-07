// Rise/set/twilight solving: scan a day window for threshold crossings of an
// altitude function, then refine each crossing by bisection to sub-second
// precision. Shared by the sun and the moon.

import type { GeoLocation, RiseSetResult } from "./types";
import { sunAltitude } from "./solar";

export type AltitudeFn = (t: Date) => number;
/** Threshold may depend on time (the moon's parallax varies with distance). */
export type ThresholdFn = (t: Date) => number;

const SCAN_STEP_MS = 10 * 60 * 1000;
const BISECT_ITERATIONS = 30; // 10 min / 2^30 ≪ 1 ms

/** Sun rise/set altitude: refraction 34′ + semidiameter 16′. */
export const SUN_RISE_SET_ALTITUDE = -0.8333;
export const CIVIL_TWILIGHT_ALTITUDE = -6;
export const NAUTICAL_TWILIGHT_ALTITUDE = -12;
export const ASTRONOMICAL_TWILIGHT_ALTITUDE = -18;

export interface Crossings {
  rising: Date[];
  setting: Date[];
}

function bisect(
  g: (t: number) => number,
  loMs: number,
  hiMs: number,
): Date {
  let lo = loMs;
  let hi = hiMs;
  const rising = g(lo) < 0;
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    const below = g(mid) < 0;
    if (below === rising) lo = mid;
    else hi = mid;
  }
  return new Date(Math.round((lo + hi) / 2));
}

/** All upward/downward crossings of `altitude(t) = threshold(t)` in [start, end). */
export function findCrossings(
  altitude: AltitudeFn,
  threshold: ThresholdFn,
  start: Date,
  end: Date,
): Crossings {
  const g = (ms: number): number => {
    const t = new Date(ms);
    return altitude(t) - threshold(t);
  };
  const rising: Date[] = [];
  const setting: Date[] = [];
  let prevMs = start.getTime();
  let prevG = g(prevMs);
  for (let ms = prevMs + SCAN_STEP_MS; ms <= end.getTime(); ms += SCAN_STEP_MS) {
    const curG = g(ms);
    if (prevG < 0 && curG >= 0) rising.push(bisect(g, prevMs, ms));
    else if (prevG >= 0 && curG < 0) setting.push(bisect(g, prevMs, ms));
    prevMs = ms;
    prevG = curG;
  }
  return { rising, setting };
}

/** First rise and first set in the window, or always-up/down classification. */
export function classifyRiseSet(
  altitude: AltitudeFn,
  threshold: ThresholdFn,
  start: Date,
  end: Date,
): RiseSetResult {
  const { rising, setting } = findCrossings(altitude, threshold, start, end);
  if (rising.length === 0 && setting.length === 0) {
    const mid = new Date((start.getTime() + end.getTime()) / 2);
    return altitude(mid) >= threshold(mid) ? { kind: "alwaysUp" } : { kind: "alwaysDown" };
  }
  return { kind: "normal", rise: rising[0] ?? null, set: setting[0] ?? null };
}

/** Time and altitude of the maximum within the window (golden-section search). */
export function findTransit(
  altitude: AltitudeFn,
  start: Date,
  end: Date,
): { time: Date; altitude: number } {
  // Coarse scan to bracket the global maximum (the window may hold two local
  // maxima for the sun near midnight at polar latitudes).
  let bestMs = start.getTime();
  let bestAlt = -Infinity;
  for (let ms = start.getTime(); ms <= end.getTime(); ms += SCAN_STEP_MS) {
    const a = altitude(new Date(ms));
    if (a > bestAlt) {
      bestAlt = a;
      bestMs = ms;
    }
  }
  let lo = Math.max(start.getTime(), bestMs - SCAN_STEP_MS);
  let hi = Math.min(end.getTime(), bestMs + SCAN_STEP_MS);
  const phi = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - phi * (hi - lo);
  let x2 = lo + phi * (hi - lo);
  let f1 = altitude(new Date(x1));
  let f2 = altitude(new Date(x2));
  while (hi - lo > 1000) {
    if (f1 < f2) {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + phi * (hi - lo);
      f2 = altitude(new Date(x2));
    } else {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - phi * (hi - lo);
      f1 = altitude(new Date(x1));
    }
  }
  const t = new Date(Math.round((lo + hi) / 2));
  return { time: t, altitude: altitude(t) };
}

export interface SunDayEvents {
  riseSet: RiseSetResult;
  solarNoon: { time: Date; altitude: number };
  civilDawn: Date | null;
  civilDusk: Date | null;
  nauticalDawn: Date | null;
  nauticalDusk: Date | null;
  astronomicalDawn: Date | null;
  astronomicalDusk: Date | null;
}

/** All solar events for the 24h window starting at `dayStart`. */
export function sunDayEvents(dayStart: Date, loc: GeoLocation): SunDayEvents {
  const end = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const alt: AltitudeFn = (t) => sunAltitude(t, loc);
  const twilight = (h0: number): Crossings =>
    findCrossings(alt, () => h0, dayStart, end);
  const civil = twilight(CIVIL_TWILIGHT_ALTITUDE);
  const nautical = twilight(NAUTICAL_TWILIGHT_ALTITUDE);
  const astro = twilight(ASTRONOMICAL_TWILIGHT_ALTITUDE);
  return {
    riseSet: classifyRiseSet(alt, () => SUN_RISE_SET_ALTITUDE, dayStart, end),
    solarNoon: findTransit(alt, dayStart, end),
    civilDawn: civil.rising[0] ?? null,
    civilDusk: civil.setting[0] ?? null,
    nauticalDawn: nautical.rising[0] ?? null,
    nauticalDusk: nautical.setting[0] ?? null,
    astronomicalDawn: astro.rising[0] ?? null,
    astronomicalDusk: astro.setting[0] ?? null,
  };
}
