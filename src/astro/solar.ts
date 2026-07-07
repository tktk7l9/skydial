// Solar position (Meeus ch.25, low-accuracy method — geometric error ~0.01°).

import { cosd, normalizeDeg, sind } from "./angles";
import { eclipticToEquatorial, equatorialToHorizontal, meanObliquity, refraction } from "./coords";
import { julianCenturies, toJulianDay, toJulianEphemerisDay } from "./julian";
import { lmst } from "./sidereal";
import type { Equatorial, GeoLocation } from "./types";

export interface SunEphemeris extends Equatorial {
  /** Apparent ecliptic longitude in degrees. */
  lambda: number;
  distanceAU: number;
}

export interface SunPosition extends SunEphemeris {
  /** Azimuth from north, clockwise, degrees. */
  azimuth: number;
  /** True (geometric) altitude, degrees. */
  altitude: number;
  /** Altitude with atmospheric refraction applied. */
  apparentAltitude: number;
}

/** Geocentric apparent solar coordinates for a TT-based Julian day. */
export function sunEphemeris(jde: number): SunEphemeris {
  const T = julianCenturies(jde);
  const L0 = normalizeDeg(280.46646 + 36_000.76983 * T + 0.0003032 * T * T);
  const M = normalizeDeg(357.52911 + 35_999.05029 * T - 0.0001537 * T * T);
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sind(M) +
    (0.019993 - 0.000101 * T) * sind(2 * M) +
    0.000289 * sind(3 * M);
  const trueLongitude = L0 + C;
  const trueAnomaly = M + C;
  const distanceAU =
    (1.000001018 * (1 - e * e)) / (1 + e * cosd(trueAnomaly));
  // Apparent longitude: correct for nutation and aberration via Ω.
  const omega = 125.04 - 1934.136 * T;
  const lambda = normalizeDeg(trueLongitude - 0.00569 - 0.00478 * sind(omega));
  const epsilon = meanObliquity(T) + 0.00256 * cosd(omega);
  const { ra, dec } = eclipticToEquatorial(lambda, 0, epsilon);
  return { ra, dec, lambda, distanceAU };
}

/** Topocentric-ish sun position (solar parallax ~8.8″ is ignored). */
export function sunPosition(date: Date, loc: GeoLocation): SunPosition {
  const eph = sunEphemeris(toJulianEphemerisDay(date));
  const st = lmst(toJulianDay(date), loc.lng);
  const { azimuth, altitude } = equatorialToHorizontal(eph, loc.lat, st);
  return {
    ...eph,
    azimuth,
    altitude,
    apparentAltitude: altitude + refraction(altitude),
  };
}

/** True altitude of the sun in degrees — the solver's objective function. */
export function sunAltitude(date: Date, loc: GeoLocation): number {
  const eph = sunEphemeris(toJulianEphemerisDay(date));
  const st = lmst(toJulianDay(date), loc.lng);
  return equatorialToHorizontal(eph, loc.lat, st).altitude;
}
