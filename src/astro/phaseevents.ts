// Principal moon phases and solstices as exact instants, solved as
// elongation / solar-longitude crossings with the same scan+bisect approach
// the rise/set solver uses. Accuracy follows the ephemeris (~minutes).

import { normalizeDeg, normalizeDeg180 } from "./angles";
import { toJulianEphemerisDay } from "./julian";
import { moonEphemeris } from "./lunar";
import { sunEphemeris } from "./solar";

export type PrincipalPhase = "new" | "firstQuarter" | "full" | "lastQuarter";

export const PRINCIPAL_PHASE_ELONGATION: Record<PrincipalPhase, number> = {
  new: 0,
  firstQuarter: 90,
  full: 180,
  lastQuarter: 270,
};

function elongationDeg(date: Date): number {
  const jde = toJulianEphemerisDay(date);
  return normalizeDeg(moonEphemeris(jde).lambda - sunEphemeris(jde).lambda);
}

const STEP_MS = 6 * 3600 * 1000; // elongation moves ~3° per step
const BISECT_ITERATIONS = 40;

/**
 * All upward crossings of `angle(t) = target` (mod 360) inside [start, end).
 * The angle must advance well under 180° per step, so the wrap jump
 * (+178 → −178) never looks like a rising crossing.
 */
function risingCrossings(
  angle: (t: Date) => number,
  target: number,
  start: Date,
  end: Date,
): Date[] {
  const g = (ms: number): number => normalizeDeg180(angle(new Date(ms)) - target);
  const found: Date[] = [];
  let prevMs = start.getTime();
  let prevG = g(prevMs);
  for (let ms = prevMs + STEP_MS; ms <= end.getTime(); ms += STEP_MS) {
    const curG = g(ms);
    if (prevG < 0 && curG >= 0) {
      let lo = prevMs;
      let hi = ms;
      for (let i = 0; i < BISECT_ITERATIONS; i++) {
        const mid = (lo + hi) / 2;
        if (g(mid) < 0) lo = mid;
        else hi = mid;
      }
      found.push(new Date(Math.round((lo + hi) / 2)));
    }
    prevMs = ms;
    prevG = curG;
  }
  return found;
}

/** The first instant of the given principal phase strictly after `from`. */
export function nextPrincipalPhase(from: Date, phase: PrincipalPhase): Date {
  const end = new Date(from.getTime() + 32 * 86_400_000);
  const hits = risingCrossings(
    elongationDeg,
    PRINCIPAL_PHASE_ELONGATION[phase],
    from,
    end,
  );
  // A 32-day window always contains at least one synodic cycle.
  return hits[0];
}

/** The most recent new moon at or before `from`. */
export function previousNewMoon(from: Date): Date {
  const start = new Date(from.getTime() - 31 * 86_400_000);
  const hits = risingCrossings(elongationDeg, 0, start, from);
  return hits[hits.length - 1];
}

/** Days since the actual last new moon (unlike the mean-elongation age). */
export function accurateMoonAge(date: Date): number {
  return (date.getTime() - previousNewMoon(date).getTime()) / 86_400_000;
}

/** Exact solstice instant: apparent solar longitude crossing 90° / 270°. */
export function solsticeInstant(year: number, which: "jun" | "dec"): Date {
  const target = which === "jun" ? 90 : 270;
  const around = Date.UTC(year, which === "jun" ? 5 : 11, 21);
  const lambda = (t: Date): number => sunEphemeris(toJulianEphemerisDay(t)).lambda;
  const hits = risingCrossings(
    lambda,
    target,
    new Date(around - 5 * 86_400_000),
    new Date(around + 5 * 86_400_000),
  );
  return hits[0];
}
