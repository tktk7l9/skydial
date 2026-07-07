// Julian day conversions (Meeus "Astronomical Algorithms" ch.7) and a ΔT
// approximation for converting UT to the TT timescale used by ephemerides.

const MS_PER_DAY = 86_400_000;
const UNIX_EPOCH_JD = 2_440_587.5; // JD of 1970-01-01T00:00:00Z

/** JD of the J2000.0 epoch (2000-01-01T12:00:00 TT). */
export const J2000 = 2_451_545.0;

export function toJulianDay(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

export function fromJulianDay(jd: number): Date {
  return new Date(Math.round((jd - UNIX_EPOCH_JD) * MS_PER_DAY));
}

/** Julian centuries since J2000.0. */
export function julianCenturies(jd: number): number {
  return (jd - J2000) / 36525;
}

// ΔT = TT − UT in seconds. Espenak–Meeus polynomial for 2005–2050, clamped
// outside that range. A few seconds of error only shifts the moon by ~0.001°,
// far below this app's accuracy target.
export function deltaTSeconds(year: number): number {
  const y = Math.min(2050, Math.max(2005, year));
  const t = y - 2000;
  return 62.92 + 0.32217 * t + 0.005589 * t * t;
}

/** TT-based Julian day (JDE) for ephemeris formulas. */
export function toJulianEphemerisDay(date: Date): number {
  return toJulianDay(date) + deltaTSeconds(date.getUTCFullYear()) / 86_400;
}
