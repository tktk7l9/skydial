// Daily solar-gain sweep: for one day window, integrate the plane-of-array
// irradiance on every window (10-min steps, mid-step sampling) with beam
// shading from the house/obstacle mesh and the per-window sky-view ratio.

import { sunPosition } from "../astro/solar";
import type { GeoLocation } from "../astro/types";
import { buildHouseGeometry, sunDirection } from "./geometry";
import type { HouseModel, WindowSpec } from "./house";
import {
  cosIncidence,
  extraterrestrialNormal,
  ineichenClearSky,
  poaComponents,
} from "./radiation";
import { directShadeFraction, skyViewFactorRatio } from "./shading";

/** WMO sunshine threshold: direct normal irradiance ≥ 120 W/m². */
const SUNSHINE_DNI_WM2 = 120;

export interface IrradiationBreakdown {
  direct: number;
  circumsolar: number;
  isotropic: number;
  reflected: number;
  total: number;
}

export interface WindowDayResult {
  spec: WindowSpec;
  azimuthDeg: number;
  areaM2: number;
  /** Sky-view ratio used for the isotropic component (0–1). */
  svfRatio: number;
  /** POA insolation on the glass over the day, kWh/m² (before η). */
  irradiationKwhM2: IrradiationBreakdown;
  /** Heat gained through the glazing over the day, kWh (η·A applied). */
  gainKwh: number;
  /** Minutes with DNI ≥ 120 W/m² and the window ≥ half lit. */
  sunshineMinutes: number;
}

export interface HouseDayResult {
  windows: WindowDayResult[];
  totalGainKwh: number;
  stepMinutes: number;
}

/** Integrate one day starting at `dayStart` (local midnight of the site). */
export function simulateDay(
  model: HouseModel,
  loc: GeoLocation,
  dayStart: Date,
  stepMinutes = 10,
): HouseDayResult {
  const geo = buildHouseGeometry(model);
  const stepH = stepMinutes / 60;
  const steps = Math.round((24 * 60) / stepMinutes);

  const results: WindowDayResult[] = geo.windows.map((w) => ({
    spec: w.spec,
    azimuthDeg: w.azimuthDeg,
    areaM2: w.areaM2,
    svfRatio: skyViewFactorRatio(w, geo.triangles),
    irradiationKwhM2: { direct: 0, circumsolar: 0, isotropic: 0, reflected: 0, total: 0 },
    gainKwh: 0,
    sunshineMinutes: 0,
  }));

  for (let i = 0; i < steps; i++) {
    const t = new Date(dayStart.getTime() + (i + 0.5) * stepMinutes * 60_000);
    const sun = sunPosition(t, loc);
    if (sun.apparentAltitude <= 0) continue;
    const zenith = 90 - sun.apparentAltitude;
    const dniExtra = extraterrestrialNormal(sun.distanceAU);
    const sky = ineichenClearSky(zenith, model.turbidity, model.elevationM, dniExtra);
    const sunDir = sunDirection(sun.azimuth, sun.apparentAltitude);

    for (let wi = 0; wi < geo.windows.length; wi++) {
      const win = geo.windows[wi];
      const out = results[wi];
      const cosTheta = cosIncidence(90, win.azimuthDeg, zenith, sun.azimuth);
      const fDirect =
        cosTheta > 0 ? directShadeFraction(win, sunDir, geo.triangles) : 0;
      const poa = poaComponents({
        sky,
        dniExtra,
        cosTheta,
        solarZenithDeg: zenith,
        surfaceTiltDeg: 90,
        albedo: model.albedo,
        directFraction: fDirect,
        svfRatio: out.svfRatio,
      });
      const b = out.irradiationKwhM2;
      b.direct += (poa.direct * stepH) / 1000;
      b.circumsolar += (poa.circumsolar * stepH) / 1000;
      b.isotropic += (poa.isotropic * stepH) / 1000;
      b.reflected += (poa.reflected * stepH) / 1000;
      b.total += (poa.total * stepH) / 1000;
      out.gainKwh += (win.spec.shgc * win.areaM2 * poa.total * stepH) / 1000;
      if (sky.dni >= SUNSHINE_DNI_WM2 && fDirect >= 0.5) {
        out.sunshineMinutes += stepMinutes;
      }
    }
  }

  return {
    windows: results,
    totalGainKwh: results.reduce((s, r) => s + r.gainKwh, 0),
    stepMinutes,
  };
}
