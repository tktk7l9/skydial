// Möller–Trumbore ray-triangle intersection (any-hit occlusion query).

export type Vec3 = readonly [number, number, number];

export interface Tri {
  a: Vec3;
  b: Vec3;
  c: Vec3;
}

const EPS_DET = 1e-12;
/** Minimum hit distance: 0.1 mm — sample points sit 1 cm off their wall. */
const EPS_T = 1e-4;

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** True when the ray (origin, dir) hits the triangle at t > EPS_T. */
export function rayIntersectsTri(origin: Vec3, dir: Vec3, tri: Tri): boolean {
  const e1 = sub(tri.b, tri.a);
  const e2 = sub(tri.c, tri.a);
  const p = cross(dir, e2);
  const det = dot(e1, p);
  if (Math.abs(det) < EPS_DET) return false; // parallel
  const inv = 1 / det;
  const s = sub(origin, tri.a);
  const u = dot(s, p) * inv;
  if (u < 0 || u > 1) return false;
  const q = cross(s, e1);
  const v = dot(dir, q) * inv;
  if (v < 0 || u + v > 1) return false;
  return dot(e2, q) * inv > EPS_T;
}

/** Any-hit occlusion test against a triangle soup. */
export function anyHit(origin: Vec3, dir: Vec3, tris: readonly Tri[]): boolean {
  for (const tri of tris) {
    if (rayIntersectsTri(origin, dir, tri)) return true;
  }
  return false;
}
