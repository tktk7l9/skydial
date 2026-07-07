// Golden hour / blue hour: intervals where the sun's altitude sits in a band.

import type { AltitudeFn } from "./events";
import { findCrossings } from "./events";
import { sunAltitude } from "./solar";
import type { GeoLocation, Interval } from "./types";

export const GOLDEN_HOUR_BAND: readonly [number, number] = [-4, 6];
export const BLUE_HOUR_BAND: readonly [number, number] = [-6, -4];

/** Segments of [start, end) where `altitude(t)` lies within [lo, hi]. */
export function altitudeIntervals(
  altitude: AltitudeFn,
  lo: number,
  hi: number,
  start: Date,
  end: Date,
): Interval[] {
  const loCross = findCrossings(altitude, () => lo, start, end);
  const hiCross = findCrossings(altitude, () => hi, start, end);
  const bounds = [
    start,
    ...loCross.rising,
    ...loCross.setting,
    ...hiCross.rising,
    ...hiCross.setting,
    end,
  ].sort((a, b) => a.getTime() - b.getTime());

  const intervals: Interval[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const s = bounds[i];
    const e = bounds[i + 1];
    if (e.getTime() - s.getTime() < 1000) continue; // degenerate segment
    const mid = new Date((s.getTime() + e.getTime()) / 2);
    const a = altitude(mid);
    if (a < lo || a > hi) continue;
    const prev = intervals[intervals.length - 1];
    if (prev && Math.abs(prev.end.getTime() - s.getTime()) < 1500) {
      prev.end = e; // merge contiguous segments split by a tangent bound
    } else {
      intervals.push({ start: s, end: e });
    }
  }
  return intervals;
}

/** Golden-hour intervals (sun altitude −4°…+6°) for the 24h window. */
export function goldenHours(dayStart: Date, loc: GeoLocation): Interval[] {
  const end = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  return altitudeIntervals(
    (t) => sunAltitude(t, loc),
    GOLDEN_HOUR_BAND[0],
    GOLDEN_HOUR_BAND[1],
    dayStart,
    end,
  );
}

/** Blue-hour intervals (sun altitude −6°…−4°) for the 24h window. */
export function blueHours(dayStart: Date, loc: GeoLocation): Interval[] {
  const end = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  return altitudeIntervals(
    (t) => sunAltitude(t, loc),
    BLUE_HOUR_BAND[0],
    BLUE_HOUR_BAND[1],
    dayStart,
    end,
  );
}
