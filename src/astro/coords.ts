// Coordinate transforms (Meeus ch.13, ch.22) and atmospheric refraction.

import { asind, atan2d, cosd, normalizeDeg, sind, tand } from "./angles";
import type { Equatorial, Horizontal } from "./types";

/** Mean obliquity of the ecliptic in degrees (Meeus 22.2, truncated). */
export function meanObliquity(T: number): number {
  return (
    23.43929111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600
  );
}

/** Ecliptic → equatorial, all in degrees (Meeus 13.3 / 13.4). */
export function eclipticToEquatorial(
  lambda: number,
  beta: number,
  epsilon: number,
): Equatorial {
  const ra = normalizeDeg(
    atan2d(sind(lambda) * cosd(epsilon) - tand(beta) * sind(epsilon), cosd(lambda)),
  );
  const dec = asind(
    sind(beta) * cosd(epsilon) + cosd(beta) * sind(epsilon) * sind(lambda),
  );
  return { ra, dec };
}

/**
 * Equatorial → horizontal for an observer (Meeus 13.5 / 13.6).
 * `lmstDeg` is the local mean sidereal time in degrees.
 * Azimuth is returned from north, clockwise (N=0°, E=90°).
 */
export function equatorialToHorizontal(
  eq: Equatorial,
  latDeg: number,
  lmstDeg: number,
): Horizontal {
  const H = lmstDeg - eq.ra; // hour angle
  const altitude = asind(
    sind(latDeg) * sind(eq.dec) + cosd(latDeg) * cosd(eq.dec) * cosd(H),
  );
  // Meeus measures azimuth from south, westward; shift to north-based.
  const azFromSouth = atan2d(
    sind(H),
    cosd(H) * sind(latDeg) - tand(eq.dec) * cosd(latDeg),
  );
  return { azimuth: normalizeDeg(azFromSouth + 180), altitude };
}

/**
 * Atmospheric refraction in degrees for a TRUE altitude (Sæmundsson's
 * formula, standard pressure/temperature). Add to the true altitude to get
 * the apparent one. Clamped to 0 near the zenith where the formula dips
 * slightly negative, and evaluated at -1° for altitudes below its validity.
 */
export function refraction(altDeg: number): number {
  const h = Math.max(altDeg, -1);
  const r = 1.02 / tand(h + 10.3 / (h + 5.11)) / 60;
  return Math.max(r, 0);
}
