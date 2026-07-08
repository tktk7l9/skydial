// HouseModel → triangle soup + window sampling geometry, in the dome's ENU
// frame: +x east, +y up, +z south (so dir(az) = [sin az, 0, −cos az], the
// same convention as views/dome/paths.toDome). Metres; house center at the
// origin, ground at y=0. Three.js-independent — the 3D layer and the
// shading engine both consume this single source of truth.

import { cosd, normalizeDeg, sind } from "../astro/angles";
import type { HouseModel, WindowSpec } from "./house";
import type { Tri, Vec3 } from "./raycast";

/** Horizontal unit vector toward a compass azimuth (N=0°, clockwise). */
export function azimuthDir(azDeg: number): Vec3 {
  return [sind(azDeg), 0, -cosd(azDeg)];
}

/** Unit vector toward the sun for an azimuth/altitude pair. */
export function sunDirection(azDeg: number, altDeg: number): Vec3 {
  return [sind(azDeg) * cosd(altDeg), sind(altDeg), -cosd(azDeg) * cosd(altDeg)];
}

const UP: Vec3 = [0, 1, 0];

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function crossV(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function quad(tris: Tri[], a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
  tris.push({ a, b, c }, { a, b: c, c: d });
}

export interface WindowGeo {
  spec: WindowSpec;
  /** World compass azimuth of the outward normal. */
  azimuthDeg: number;
  normal: Vec3;
  center: Vec3;
  areaM2: number;
  /** Grid sample points, offset 1 cm outward along the normal. */
  samples: Vec3[];
}

export interface HouseGeometry {
  triangles: Tri[];
  windows: WindowGeo[];
  /** Max horizontal distance of any vertex from the origin (for scaling). */
  horizontalRadius: number;
}

interface Face {
  normal: Vec3;
  /** Left→right axis as seen from outside (= up × normal). */
  hAxis: Vec3;
  /** Ground corner at the outside-viewer's left. */
  origin: Vec3;
  faceWidth: number;
}

function buildFaces(m: HouseModel): Face[] {
  const faces: Face[] = [];
  for (let i = 0 as 0 | 1 | 2 | 3; i < 4; i++) {
    const normal = azimuthDir(m.azimuthDeg + 90 * i);
    const hAxis = crossV(UP, normal);
    const outDist = i % 2 === 0 ? m.depth / 2 : m.width / 2;
    const faceWidth = i % 2 === 0 ? m.width : m.depth;
    const origin = add(scale(normal, outDist), scale(hAxis, -faceWidth / 2));
    faces.push({ normal, hAxis, origin, faceWidth });
  }
  return faces;
}

function facePoint(f: Face, s: number, t: number): Vec3 {
  return add(add(f.origin, scale(f.hAxis, s)), scale(UP, t));
}

/** Compass azimuth of a face's outward normal. */
export function faceAzimuth(m: HouseModel, face: 0 | 1 | 2 | 3): number {
  return normalizeDeg(m.azimuthDeg + 90 * face);
}

function buildRoof(m: HouseModel, faces: Face[], tris: Tri[]): void {
  const e = m.eaveOut;
  const W = m.width;
  const D = m.depth;
  const front = faces[0];

  if (m.roof.kind === "flat") {
    // Slab at eave height, overhanging e on all sides.
    const u = front.hAxis;
    const w = front.normal;
    const y = scale(UP, m.eaveH);
    const c = (su: number, sw: number): Vec3 =>
      add(add(scale(u, su), scale(w, sw)), y);
    quad(
      tris,
      c(-(W / 2 + e), D / 2 + e),
      c(W / 2 + e, D / 2 + e),
      c(W / 2 + e, -(D / 2 + e)),
      c(-(W / 2 + e), -(D / 2 + e)),
    );
    return;
  }

  const k = m.roof.pitchSun / 10;

  if (m.roof.kind === "gable") {
    // ridgeAxis "w": ridge parallel to the front face's width axis.
    const alongRidge = m.roof.ridgeAxis === "w" ? front.hAxis : front.normal;
    const alongSlope = m.roof.ridgeAxis === "w" ? front.normal : front.hAxis;
    const ridgeHalf = (m.roof.ridgeAxis === "w" ? W : D) / 2;
    const slopeHalf = (m.roof.ridgeAxis === "w" ? D : W) / 2;
    const ridgeH = m.eaveH + slopeHalf * k;
    const eaveLowY = m.eaveH - e * k;
    const p = (r: number, s: number, y: number): Vec3 =>
      add(add(scale(alongRidge, r), scale(alongSlope, s)), scale(UP, y));
    for (const sign of [1, -1]) {
      quad(
        tris,
        p(-(ridgeHalf + e), sign * (slopeHalf + e), eaveLowY),
        p(ridgeHalf + e, sign * (slopeHalf + e), eaveLowY),
        p(ridgeHalf + e, 0, ridgeH),
        p(-(ridgeHalf + e), 0, ridgeH),
      );
      // Gable-end wall triangle above the eave line.
      tris.push({
        a: p(sign * ridgeHalf, slopeHalf, m.eaveH),
        b: p(sign * ridgeHalf, -slopeHalf, m.eaveH),
        c: p(sign * ridgeHalf, 0, ridgeH),
      });
    }
    return;
  }

  // Shed roof: slopes down toward `lowSide`; the opposite wall is taller.
  const low = faces[m.roof.lowSide];
  const highIdx = ((m.roof.lowSide + 2) % 4) as 0 | 1 | 2 | 3;
  const span = m.roof.lowSide % 2 === 0 ? D : W;
  const breadth = low.faceWidth;
  const highY = m.eaveH + span * k;
  const p = (b: number, s: number, y: number): Vec3 =>
    add(add(scale(low.hAxis, b), scale(low.normal, s)), scale(UP, y));
  // Roof plane with overhang on all four edges.
  quad(
    tris,
    p(-(breadth / 2 + e), span / 2 + e, m.eaveH - e * k),
    p(breadth / 2 + e, span / 2 + e, m.eaveH - e * k),
    p(breadth / 2 + e, -(span / 2 + e), highY + e * k),
    p(-(breadth / 2 + e), -(span / 2 + e), highY + e * k),
  );
  // Taller wall above eave height on the high side.
  const high = faces[highIdx];
  quad(
    tris,
    facePoint(high, 0, m.eaveH),
    facePoint(high, high.faceWidth, m.eaveH),
    facePoint(high, high.faceWidth, highY),
    facePoint(high, 0, highY),
  );
  // Triangular side walls between low and high edges.
  for (const sign of [1, -1]) {
    tris.push({
      a: p(sign * (breadth / 2), span / 2, m.eaveH),
      b: p(sign * (breadth / 2), -span / 2, m.eaveH),
      c: p(sign * (breadth / 2), -span / 2, highY),
    });
  }
}

function buildObstacles(m: HouseModel, tris: Tri[]): void {
  for (const o of m.obstacles) {
    const u = azimuthDir(o.rotDeg + 90); // box "width" axis
    const w = azimuthDir(o.rotDeg);
    const center: Vec3 = [o.x, 0, -o.y]; // +y input is north = world −z
    const c = (su: number, sw: number, y: number): Vec3 =>
      add(add(add(center, scale(u, su)), scale(w, sw)), scale(UP, y));
    const hw = o.w / 2;
    const hd = o.d / 2;
    // 4 side walls + top (bottom face is irrelevant for sky rays).
    quad(tris, c(-hw, hd, 0), c(hw, hd, 0), c(hw, hd, o.h), c(-hw, hd, o.h));
    quad(tris, c(hw, -hd, 0), c(-hw, -hd, 0), c(-hw, -hd, o.h), c(hw, -hd, o.h));
    quad(tris, c(hw, hd, 0), c(hw, -hd, 0), c(hw, -hd, o.h), c(hw, hd, o.h));
    quad(tris, c(-hw, -hd, 0), c(-hw, hd, 0), c(-hw, hd, o.h), c(-hw, -hd, o.h));
    quad(tris, c(-hw, hd, o.h), c(hw, hd, o.h), c(hw, -hd, o.h), c(-hw, -hd, o.h));
  }
}

const SAMPLE_OFFSET_M = 0.01;

function buildWindow(m: HouseModel, faces: Face[], spec: WindowSpec): WindowGeo | null {
  const f = faces[spec.face];
  // Fit the opening inside the wall (silently clip odd inputs).
  const w = Math.min(spec.w, f.faceWidth);
  const off = Math.min(spec.off, f.faceWidth - w);
  const h = Math.min(spec.h, Math.max(0.1, m.eaveH - spec.sill));
  if (w <= 0 || h <= 0) return null;

  const nx = Math.min(6, Math.max(2, Math.ceil(w / 0.3)));
  const ny = Math.min(6, Math.max(2, Math.ceil(h / 0.3)));
  const lift = scale(f.normal, SAMPLE_OFFSET_M);
  const samples: Vec3[] = [];
  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      const s = off + ((ix + 0.5) / nx) * w;
      const t = spec.sill + ((iy + 0.5) / ny) * h;
      samples.push(add(facePoint(f, s, t), lift));
    }
  }
  return {
    spec,
    azimuthDeg: faceAzimuth(m, spec.face),
    normal: f.normal,
    center: add(facePoint(f, off + w / 2, spec.sill + h / 2), lift),
    areaM2: w * h,
    samples,
  };
}

export function buildHouseGeometry(m: HouseModel): HouseGeometry {
  const faces = buildFaces(m);
  const tris: Tri[] = [];
  for (const f of faces) {
    quad(
      tris,
      facePoint(f, 0, 0),
      facePoint(f, f.faceWidth, 0),
      facePoint(f, f.faceWidth, m.eaveH),
      facePoint(f, 0, m.eaveH),
    );
  }
  buildRoof(m, faces, tris);
  buildObstacles(m, tris);

  const windows: WindowGeo[] = [];
  for (const spec of m.windows) {
    const geo = buildWindow(m, faces, spec);
    if (geo !== null) windows.push(geo);
  }

  let radius = 0;
  for (const t of tris) {
    for (const v of [t.a, t.b, t.c]) {
      radius = Math.max(radius, Math.hypot(v[0], v[2]));
    }
  }
  return { triangles: tris, windows, horizontalRadius: radius };
}
