// Lunar position (Meeus "Astronomical Algorithms" ch.47, truncated series).
// The dominant periodic terms are kept — worst-case error stays within ~0.05°
// in longitude/latitude (validated against example 47.a and USNO rise/set),
// comfortably inside this app's 0.3° target.

import { asind, cosd, normalizeDeg, sind } from "./angles";
import { eclipticToEquatorial, equatorialToHorizontal, meanObliquity, refraction } from "./coords";
import { julianCenturies, toJulianDay, toJulianEphemerisDay } from "./julian";
import { lmst } from "./sidereal";
import type { Equatorial, GeoLocation } from "./types";

// Periodic terms for longitude (Σl, 1e-6 deg) and distance (Σr, 1e-3 km):
// [D, M, M', F, sinCoeff(l), cosCoeff(r)] — Meeus table 47.A (leading terms).
const LR_TERMS: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [0, 0, 1, 0, 6288774, -20905355],
  [2, 0, -1, 0, 1274027, -3699111],
  [2, 0, 0, 0, 658314, -2955968],
  [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888],
  [0, 0, 0, 2, -114332, -3149],
  [2, 0, -2, 0, 58793, 246158],
  [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733],
  [2, -1, 0, 0, 45758, -204586],
  [0, 1, -1, 0, -40923, -129620],
  [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755],
  [2, 0, 0, -2, 15327, 10321],
  [0, 0, 1, 2, -12528, 0],
  [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782],
  [0, 0, 3, 0, 10034, -23210],
  [4, 0, -2, 0, 8548, -21636],
  [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824],
  [1, 0, -1, 0, -5163, -8379],
  [1, 1, 0, 0, 4987, -16675],
  [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445],
  [4, 0, 0, 0, 3861, -11650],
  [2, 0, -3, 0, 3665, 14403],
  [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0],
  [2, -1, -2, 0, 2390, 10056],
  [1, 0, 1, 0, -2348, 6322],
  [2, -2, 0, 0, 2236, -9884],
];

// Periodic terms for latitude (Σb, 1e-6 deg): [D, M, M', F, sinCoeff].
const B_TERMS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 0, 1, 5128122],
  [0, 0, 1, 1, 280602],
  [0, 0, 1, -1, 277693],
  [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573],
  [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266],
  [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216],
  [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200],
  [2, 1, 0, -1, -3359],
  [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065],
  [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828],
  [0, 1, 0, 1, -1794],
];

export interface MoonEphemeris {
  /** Geocentric ecliptic longitude/latitude, degrees. */
  lambda: number;
  beta: number;
  distanceKm: number;
  /** Equatorial horizontal parallax, degrees. */
  parallax: number;
  ra: number;
  dec: number;
}

export interface MoonPosition extends MoonEphemeris {
  azimuth: number;
  /** Topocentric true altitude (geocentric altitude − parallax·cos alt). */
  altitude: number;
  apparentAltitude: number;
  /** Geocentric altitude — what the rise/set solver thresholds against. */
  geocentricAltitude: number;
}

/** Geocentric lunar coordinates for a TT-based Julian day. */
export function moonEphemeris(jde: number): MoonEphemeris {
  const T = julianCenturies(jde);
  // Fundamental arguments (Meeus 47.1–47.5), degrees.
  const Lp =
    218.3164477 +
    481_267.88123421 * T -
    0.0015786 * T * T +
    (T * T * T) / 538_841 -
    (T * T * T * T) / 65_194_000;
  const D =
    297.8501921 +
    445_267.1114034 * T -
    0.0018819 * T * T +
    (T * T * T) / 545_868 -
    (T * T * T * T) / 113_065_000;
  const M = 357.5291092 + 35_999.0502909 * T - 0.0001536 * T * T + (T * T * T) / 24_490_000;
  const Mp =
    134.9633964 +
    477_198.8675055 * T +
    0.0087414 * T * T +
    (T * T * T) / 69_699 -
    (T * T * T * T) / 14_712_000;
  const F =
    93.272095 +
    483_202.0175233 * T -
    0.0036539 * T * T -
    (T * T * T) / 3_526_000 +
    (T * T * T * T) / 863_310_000;
  // Eccentricity damping for terms involving M (Meeus 47.6).
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;

  let sumL = 0;
  let sumR = 0;
  for (const [d, m, mp, f, sl, sr] of LR_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const damp = m === 0 ? 1 : m === 1 || m === -1 ? E : E * E;
    sumL += sl * damp * sind(arg);
    sumR += sr * damp * cosd(arg);
  }
  let sumB = 0;
  for (const [d, m, mp, f, sb] of B_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F;
    const damp = m === 0 ? 1 : E;
    sumB += sb * damp * sind(arg);
  }
  // Additive terms (Venus/Jupiter perturbations, flattening).
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479_264.29 * T;
  const A3 = 313.45 + 481_266.484 * T;
  sumL += 3958 * sind(A1) + 1962 * sind(Lp - F) + 318 * sind(A2);
  sumB +=
    -2235 * sind(Lp) +
    382 * sind(A3) +
    175 * sind(A1 - F) +
    175 * sind(A1 + F) +
    127 * sind(Lp - Mp) -
    115 * sind(Lp + Mp);

  const lambda = normalizeDeg(Lp + sumL / 1e6);
  const beta = sumB / 1e6;
  const distanceKm = 385_000.56 + sumR / 1000;
  const parallax = asind(6378.14 / distanceKm);
  const { ra, dec } = eclipticToEquatorial(lambda, beta, meanObliquity(T));
  return { lambda, beta, distanceKm, parallax, ra, dec };
}

function geocentricAltAz(
  eph: MoonEphemeris,
  date: Date,
  loc: GeoLocation,
): { azimuth: number; altitude: number } {
  const st = lmst(toJulianDay(date), loc.lng);
  const eq: Equatorial = { ra: eph.ra, dec: eph.dec };
  return equatorialToHorizontal(eq, loc.lat, st);
}

/** Topocentric moon position for display. */
export function moonPosition(date: Date, loc: GeoLocation): MoonPosition {
  const eph = moonEphemeris(toJulianEphemerisDay(date));
  const { azimuth, altitude: geoAlt } = geocentricAltAz(eph, date, loc);
  // Parallax lowers the moon by up to ~1°; the simple cos-correction is
  // accurate to a few thousandths of a degree.
  const topoAlt = geoAlt - eph.parallax * cosd(geoAlt);
  return {
    ...eph,
    azimuth,
    altitude: topoAlt,
    apparentAltitude: topoAlt + refraction(topoAlt),
    geocentricAltitude: geoAlt,
  };
}

/** Geocentric true altitude — the rise/set solver's objective function. */
export function moonGeocentricAltitude(date: Date, loc: GeoLocation): number {
  const eph = moonEphemeris(toJulianEphemerisDay(date));
  return geocentricAltAz(eph, date, loc).altitude;
}

/**
 * Rise/set threshold for the geocentric altitude (Meeus ch.15):
 * h0 = 0.7275·parallax − 34′ (parallax varies with the moon's distance).
 */
export function moonRiseSetThreshold(date: Date): number {
  const eph = moonEphemeris(toJulianEphemerisDay(date));
  return 0.7275 * eph.parallax - 0.5667;
}
