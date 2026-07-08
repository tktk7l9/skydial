// Clear-sky radiation model.
//
// DNI/GHI/DHI: Ineichen & Perez (2002) Linke-turbidity clear-sky model,
// transcribed from pvlib-python `clearsky.ineichen` (BSD-3-Clause,
// https://github.com/pvlib/pvlib-python, perez_enhancement=False) and
// validated against pvlib-generated fixtures to 0.1%.
// Airmass: Kasten & Young (1989); pressure: pvlib `atmosphere.alt2pres`.
// Plane-of-array: Hay & Davies (1980) anisotropic diffuse (coefficient-free)
// + isotropic ground reflection.
//
// The Linke turbidity TL is the single free parameter (≈2 pristine …
// 5+ polluted); with no weather data this models a *clear* day.

import { cosd, sind } from "../astro/angles";

/** Total solar irradiance, W/m² (Kopp & Lean 2011). */
export const SOLAR_CONSTANT = 1361;

/** Extraterrestrial normal irradiance for an earth–sun distance in AU. */
export function extraterrestrialNormal(distanceAU: number): number {
  return SOLAR_CONSTANT / (distanceAU * distanceAU);
}

/** Kasten & Young (1989) relative airmass for an apparent zenith angle. */
export function relativeAirmass(apparentZenithDeg: number): number {
  const z = Math.min(apparentZenithDeg, 89.999);
  return 1 / (cosd(z) + 0.50572 * Math.pow(6.07995 + (90 - z), -1.6364));
}

/** Site pressure (Pa) from altitude (m) — pvlib `alt2pres`. */
export function altitudePressure(altitudeM: number): number {
  return 100 * Math.pow((44331.514 - altitudeM) / 11880.516, 1 / 0.1902632);
}

export interface ClearSky {
  /** Global horizontal irradiance, W/m². */
  ghi: number;
  /** Direct normal irradiance, W/m². */
  dni: number;
  /** Diffuse horizontal irradiance, W/m². */
  dhi: number;
}

/**
 * Ineichen–Perez clear-sky irradiance. Returns zeros once the sun is at or
 * below the horizon.
 */
export function ineichenClearSky(
  apparentZenithDeg: number,
  linkeTurbidity: number,
  altitudeM: number,
  dniExtra: number,
): ClearSky {
  const cosZenith = Math.max(cosd(apparentZenithDeg), 0);
  // cosd(90) is ~6e-17 in floats — treat anything below 1e-12 as nighttime.
  if (cosZenith <= 1e-12) return { ghi: 0, dni: 0, dhi: 0 };

  const tl = linkeTurbidity;
  const amAbs =
    relativeAirmass(apparentZenithDeg) * (altitudePressure(altitudeM) / 101_325);

  const fh1 = Math.exp(-altitudeM / 8000);
  const fh2 = Math.exp(-altitudeM / 1250);
  const cg1 = 5.09e-5 * altitudeM + 0.868;
  const cg2 = 3.92e-5 * altitudeM + 0.0387;

  const ghi =
    cg1 *
    dniExtra *
    cosZenith *
    Math.max(Math.exp(-cg2 * amAbs * (fh1 + fh2 * (tl - 1))), 0);

  const b = 0.664 + 0.163 / fh1;
  const bnci = dniExtra * Math.max(b * Math.exp(-0.09 * amAbs * (tl - 1)), 0);
  const bnci2 =
    ghi *
    Math.min(
      Math.max((1 - (0.1 - 0.2 * Math.exp(-tl)) / (0.1 + 0.882 / fh1)) / cosZenith, 0),
      1e20,
    );

  const dni = Math.min(bnci, bnci2);
  return { ghi, dni, dhi: ghi - dni * cosZenith };
}

/**
 * Cosine of the angle of incidence on a tilted surface (pvlib
 * `aoi_projection`), clipped to [-1, 1]. Azimuths N=0° clockwise;
 * tilt 0=horizontal, 90=vertical.
 */
export function cosIncidence(
  surfaceTiltDeg: number,
  surfaceAzimuthDeg: number,
  solarZenithDeg: number,
  solarAzimuthDeg: number,
): number {
  const projection =
    cosd(surfaceTiltDeg) * cosd(solarZenithDeg) +
    sind(surfaceTiltDeg) *
      sind(solarZenithDeg) *
      cosd(solarAzimuthDeg - surfaceAzimuthDeg);
  return Math.min(1, Math.max(-1, projection));
}

export interface PoaComponents {
  /** Beam on the surface (already shade-weighted), W/m². */
  direct: number;
  /** Hay–Davies circumsolar diffuse (follows beam shading), W/m². */
  circumsolar: number;
  /** Isotropic sky diffuse (sky-view weighted), W/m². */
  isotropic: number;
  /** Ground-reflected, W/m². */
  reflected: number;
  total: number;
}

export interface PoaInput {
  sky: ClearSky;
  dniExtra: number;
  /** cos of angle of incidence on the surface (≤0 → sun behind). */
  cosTheta: number;
  solarZenithDeg: number;
  surfaceTiltDeg: number;
  albedo: number;
  /** Fraction of the beam reaching the surface (0–1, from shading). */
  directFraction: number;
  /** Isotropic-diffuse sky-view ratio vs the unobstructed case (0–1). */
  svfRatio: number;
}

/**
 * Plane-of-array irradiance, Hay–Davies + isotropic ground reflection.
 * With tilt=0, no shading and cosTheta=cos(z) the total reduces exactly
 * to GHI (verified in tests).
 */
export function poaComponents(p: PoaInput): PoaComponents {
  const { sky, dniExtra, surfaceTiltDeg, albedo } = p;
  const cosTheta = Math.max(0, p.cosTheta);
  // pvlib clamps the projection denominator at cos(89°)≈0.01745.
  const rb = cosTheta / Math.max(cosd(p.solarZenithDeg), 0.01745);
  const ai = dniExtra > 0 ? sky.dni / dniExtra : 0;

  const direct = sky.dni * cosTheta * p.directFraction;
  const circumsolar = Math.max(sky.dhi * ai * rb, 0) * p.directFraction;
  const isotropic =
    Math.max(sky.dhi * (1 - ai) * ((1 + cosd(surfaceTiltDeg)) / 2), 0) * p.svfRatio;
  const reflected = sky.ghi * albedo * ((1 - cosd(surfaceTiltDeg)) / 2);
  return {
    direct,
    circumsolar,
    isotropic,
    reflected,
    total: direct + circumsolar + isotropic + reflected,
  };
}
