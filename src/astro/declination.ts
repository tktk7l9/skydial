// Magnetic declination for the Japan region — GSI (国土地理院) 2020.0 epoch
// approximation. Source: https://vldb.gsi.go.jp/sokuchi/geomag/menu_04/
//   D2020.0 = 8°15.822′ + 18.462′Δφ − 7.726′Δλ
//             + 0.007′Δφ² − 0.007′ΔφΔλ − 0.655′Δλ²
//   Δφ = φ − 37°N, Δλ = λ − 138°E, west-positive.
// Outside the model's stated range (20–50°N, 120–154°E) this returns null
// and callers fall back to uncorrected magnetic headings.

import type { GeoLocation } from "./types";

/**
 * West-positive magnetic declination in degrees, or null outside Japan.
 * True heading = magnetic heading − declination.
 */
export function declinationWestDeg(loc: GeoLocation): number | null {
  if (loc.lat < 20 || loc.lat > 50 || loc.lng < 120 || loc.lng > 154) return null;
  const dphi = loc.lat - 37;
  const dlam = loc.lng - 138;
  const minutes =
    8 * 60 +
    15.822 +
    18.462 * dphi -
    7.726 * dlam +
    0.007 * dphi * dphi -
    0.007 * dphi * dlam -
    0.655 * dlam * dlam;
  return minutes / 60;
}
