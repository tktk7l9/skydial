// Moon phase, illuminated fraction and age (Meeus ch.48).

import { atan2d, cosd, normalizeDeg, sind } from "./angles";
import { toJulianEphemerisDay } from "./julian";
import { moonEphemeris } from "./lunar";
import { sunEphemeris } from "./solar";

export const SYNODIC_MONTH_DAYS = 29.530588853;
const AU_KM = 149_597_870.7;

export type MoonPhaseName =
  | "new"
  | "waxingCrescent"
  | "firstQuarter"
  | "waxingGibbous"
  | "full"
  | "waningGibbous"
  | "lastQuarter"
  | "waningCrescent";

export interface MoonPhase {
  /** Illuminated fraction of the disk, 0–1. */
  illumination: number;
  /** Phase angle (sun–moon–earth), degrees; 0=full, 180=new. */
  phaseAngle: number;
  /** Sun→moon elongation along the ecliptic, degrees 0–360; 0=new, 180=full. */
  elongation: number;
  waxing: boolean;
  /** Approximate days since new moon (from mean elongation). */
  ageDays: number;
  name: MoonPhaseName;
}

function phaseName(elongation: number): MoonPhaseName {
  const names: MoonPhaseName[] = [
    "new",
    "waxingCrescent",
    "firstQuarter",
    "waxingGibbous",
    "full",
    "waningGibbous",
    "lastQuarter",
    "waningCrescent",
  ];
  // 8 sectors of 45°, centred on the principal phases.
  return names[Math.floor(normalizeDeg(elongation + 22.5) / 45) % 8];
}

export function moonPhase(date: Date): MoonPhase {
  const jde = toJulianEphemerisDay(date);
  const sun = sunEphemeris(jde);
  const moon = moonEphemeris(jde);

  // Geocentric elongation ψ from equatorial coordinates (Meeus 48.2).
  const cosPsi =
    sind(sun.dec) * sind(moon.dec) +
    cosd(sun.dec) * cosd(moon.dec) * cosd(sun.ra - moon.ra);
  const psi = Math.acos(Math.min(1, Math.max(-1, cosPsi))) * (180 / Math.PI);

  // Phase angle i (Meeus 48.3): the sun–earth distance dwarfs the lunar one.
  const sunKm = sun.distanceAU * AU_KM;
  // sin ψ ≥ 0 for ψ∈[0°,180°], so atan2 already lands in [0°,180°].
  const phaseAngle = atan2d(sunKm * sind(psi), moon.distanceKm - sunKm * cosd(psi));
  const illumination = (1 + cosd(phaseAngle)) / 2;

  const elongation = normalizeDeg(moon.lambda - sun.lambda);
  const waxing = elongation < 180;
  const ageDays = (elongation / 360) * SYNODIC_MONTH_DAYS;

  return {
    illumination,
    phaseAngle,
    elongation,
    waxing,
    ageDays,
    name: phaseName(elongation),
  };
}

/** Unicode moon glyph for the phase (northern-hemisphere orientation). */
export function moonGlyph(name: MoonPhaseName): string {
  const glyphs: Record<MoonPhaseName, string> = {
    new: "\u{1F311}",
    waxingCrescent: "\u{1F312}",
    firstQuarter: "\u{1F313}",
    waxingGibbous: "\u{1F314}",
    full: "\u{1F315}",
    waningGibbous: "\u{1F316}",
    lastQuarter: "\u{1F317}",
    waningCrescent: "\u{1F318}",
  };
  return glyphs[name];
}
