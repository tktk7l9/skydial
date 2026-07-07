// Sidereal time (Meeus ch.12), in degrees.

import { normalizeDeg } from "./angles";
import { J2000, julianCenturies } from "./julian";

/** Greenwich mean sidereal time for a UT-based Julian day (Meeus 12.4). */
export function gmst(jd: number): number {
  const T = julianCenturies(jd);
  return normalizeDeg(
    280.46061837 +
      360.98564736629 * (jd - J2000) +
      0.000387933 * T * T -
      (T * T * T) / 38_710_000,
  );
}

/** Local mean sidereal time; east longitudes are positive. */
export function lmst(jd: number, lngDeg: number): number {
  return normalizeDeg(gmst(jd) + lngDeg);
}
