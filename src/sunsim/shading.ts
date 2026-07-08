// Shading queries against the house/obstacle triangle soup.

import type { WindowGeo } from "./geometry";
import { sunDirection } from "./geometry";
import { anyHit, dot } from "./raycast";
import type { Tri, Vec3 } from "./raycast";

/**
 * Fraction of the window's sample grid that sees the sun (0–1).
 * Returns 0 outright when the sun is behind the wall.
 */
export function directShadeFraction(
  win: WindowGeo,
  sunDir: Vec3,
  tris: readonly Tri[],
): number {
  if (dot(sunDir, win.normal) <= 0) return 0;
  let visible = 0;
  for (const p of win.samples) {
    if (!anyHit(p, sunDir, tris)) visible++;
  }
  return visible / win.samples.length;
}

// Stratified sky directions: az 0..345 step 15° × alt 5..85 step 10° = 216.
const SKY_DIRS: Array<{ dir: Vec3; cosAlt: number }> = [];
for (let alt = 5; alt < 90; alt += 10) {
  for (let az = 0; az < 360; az += 15) {
    SKY_DIRS.push({ dir: sunDirection(az, alt), cosAlt: Math.cos((alt * Math.PI) / 180) });
  }
}

/**
 * Ratio of the isotropic-sky flux actually visible from the window center
 * vs the unobstructed half-dome in front of the wall (0–1). The weight
 * max(0, dir·n̂)·cos(alt) is the integrand of the tilted-surface isotropic
 * view factor, so an unobstructed window yields exactly 1.
 */
export function skyViewFactorRatio(win: WindowGeo, tris: readonly Tri[]): number {
  let total = 0;
  let open = 0;
  for (const { dir, cosAlt } of SKY_DIRS) {
    const w = Math.max(0, dot(dir, win.normal)) * cosAlt;
    if (w <= 0) continue;
    total += w;
    if (!anyHit(win.center, dir, tris)) open += w;
  }
  return total === 0 ? 1 : open / total;
}
