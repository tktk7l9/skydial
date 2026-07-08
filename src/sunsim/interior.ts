// Interior sunlight patch: where a window's beam lands on the floor.
//
// The house is treated as a single room (no interior partitions — the
// HouseModel carries none): the floor is the whole footprint rectangle at
// y=0, bounded by the exterior walls. A window opening is a planar
// rectangle; under parallel (sun) projection a rectangle maps to a
// parallelogram, so only its 4 corners need projecting. The result is
// clipped against the footprint rectangle (Sutherland–Hodgman) — this is
// the model's one simplification: a beam that would travel past the
// opposite wall is treated as reaching no floor patch there (physically it
// would light that wall instead; wall patches are out of scope for v1).
//
// This module is pure geometry: it does not know about beam shading
// (eaves/neighbors) — callers scale area by the window's directFraction
// from shading.ts and gate on it before treating a patch as "lit".

import { azimuthDir } from "./geometry";
import type { WindowGeo } from "./geometry";
import type { HouseModel } from "./house";
import { cross, dot, sub } from "./raycast";
import type { Vec3 } from "./raycast";

const UP: Vec3 = [0, 1, 0];
type Vec2 = readonly [number, number];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

/** The window opening's 4 corners in order (world ENU), CCW or CW — consistent. */
export function windowCorners(win: WindowGeo): Vec3[] {
  const hw = scale(win.hAxis, win.widthM / 2);
  const hh = scale(UP, win.heightM / 2);
  return [
    sub(sub(win.center, hw), hh),
    add(sub(win.center, hh), hw),
    add(add(win.center, hw), hh),
    add(sub(win.center, hw), hh),
  ];
}

/**
 * Project a point straight down to the floor (y=0) along the direction
 * light actually travels (away from the sun, i.e. −sunDir). Returns null
 * for a sun direction too close to the horizon to project meaningfully.
 */
export function projectToFloor(point: Vec3, sunDir: Vec3): Vec3 | null {
  if (sunDir[1] <= 1e-9) return null;
  const t = point[1] / sunDir[1];
  return [point[0] - t * sunDir[0], 0, point[2] - t * sunDir[2]];
}

function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function clipHalfPlane(
  poly: readonly Vec2[],
  inside: (p: Vec2) => boolean,
  boundary: (a: Vec2, b: Vec2) => number,
): Vec2[] {
  if (poly.length === 0) return [];
  const out: Vec2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i - 1 + poly.length) % poly.length];
    const currIn = inside(curr);
    const prevIn = inside(prev);
    if (currIn) {
      if (!prevIn) out.push(lerp2(prev, curr, boundary(prev, curr)));
      out.push(curr);
    } else if (prevIn) {
      out.push(lerp2(prev, curr, boundary(prev, curr)));
    }
  }
  return out;
}

/** Sutherland–Hodgman clip of a convex polygon against an axis-aligned rect. */
export function clipToRect(
  poly: readonly Vec2[],
  uMin: number,
  uMax: number,
  vMin: number,
  vMax: number,
): Vec2[] {
  let p: Vec2[] = poly.slice();
  p = clipHalfPlane(
    p,
    ([u]) => u >= uMin,
    (a, b) => (uMin - a[0]) / (b[0] - a[0]),
  );
  p = clipHalfPlane(
    p,
    ([u]) => u <= uMax,
    (a, b) => (uMax - a[0]) / (b[0] - a[0]),
  );
  p = clipHalfPlane(
    p,
    ([, v]) => v >= vMin,
    (a, b) => (vMin - a[1]) / (b[1] - a[1]),
  );
  p = clipHalfPlane(
    p,
    ([, v]) => v <= vMax,
    (a, b) => (vMax - a[1]) / (b[1] - a[1]),
  );
  return p;
}

/** Shoelace area of a (possibly non-convex-safe, but here always convex) polygon. */
function polygonArea(poly: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export interface FloorPatch {
  /** Clipped patch polygon on the floor (y=0), world ENU coordinates. */
  polygon: Vec3[];
  /** Patch area, m² (unshaded — callers scale by the beam's directFraction). */
  areaM2: number;
  /** Max inward penetration depth from the window's wall, m. */
  depthM: number;
}

/**
 * Geometric sunlight patch a window casts on the floor, clipped to the
 * house footprint. Returns null when the sun is behind the wall, too low
 * to project, or the (unclipped) beam never reaches the footprint at all
 * (it would hit the far wall first — out of scope for v1).
 */
export function computeFloorPatch(model: HouseModel, win: WindowGeo, sunDir: Vec3): FloorPatch | null {
  const cosTheta = dot(sunDir, win.normal);
  if (cosTheta <= 0) return null;

  const corners = windowCorners(win);
  const floorPoints: Vec3[] = [];
  for (const c of corners) {
    const p = projectToFloor(c, sunDir);
    if (p === null) return null;
    floorPoints.push(p);
  }

  const frontNormal = azimuthDir(model.azimuthDeg);
  const frontHAxis = cross(UP, frontNormal);
  const toUV = (p: Vec3): Vec2 => [dot(p, frontHAxis), dot(p, frontNormal)];
  const uv = floorPoints.map(toUV);

  const clipped = clipToRect(
    uv,
    -model.width / 2,
    model.width / 2,
    -model.depth / 2,
    model.depth / 2,
  );
  if (clipped.length < 3) return null;

  const areaM2 = polygonArea(clipped);
  if (areaM2 <= 1e-6) return null;

  const worldPolygon: Vec3[] = clipped.map(([u, v]) => [
    u * frontHAxis[0] + v * frontNormal[0],
    0,
    u * frontHAxis[2] + v * frontNormal[2],
  ]);
  let depthM = 0;
  for (const p of worldPolygon) {
    const d =
      -win.normal[0] * (p[0] - win.center[0]) - win.normal[2] * (p[2] - win.center[2]);
    if (d > depthM) depthM = d;
  }

  return { polygon: worldPolygon, areaM2, depthM };
}
