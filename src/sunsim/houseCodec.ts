// Compact HouseModel transport codec, shared by ?house= and localStorage.
// Dot-separated base36 non-negative integers (URL-safe without percent
// encoding); obstacle offsets — the only signed fields — are zigzag-coded.
// Token 0 is the schema version; unknown versions and any malformed input
// decode to null (never throw), matching the urlState philosophy.

import { clampHouse } from "./house";
import type { HouseModel, Obstacle, RoofSpec, WindowSpec } from "./house";

const VERSION = 1;

function zigzag(n: number): number {
  return n >= 0 ? 2 * n : -2 * n - 1;
}

function unzigzag(n: number): number {
  return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
}

function cm(v: number): number {
  return Math.max(0, Math.round(v * 100));
}

class TokenReader {
  private i = 0;
  constructor(private readonly tokens: string[]) {}

  /** Next token as a non-negative integer, or null on exhaustion/garbage. */
  next(): number | null {
    if (this.i >= this.tokens.length) return null;
    const t = this.tokens[this.i++];
    if (!/^[0-9a-z]{1,8}$/.test(t)) return null;
    return parseInt(t, 36);
  }

  done(): boolean {
    return this.i === this.tokens.length;
  }
}

export function encodeHouse(m: HouseModel): string {
  const roofKind = m.roof.kind === "flat" ? 0 : m.roof.kind === "gable" ? 1 : 2;
  const pitch2 =
    m.roof.kind === "flat" ? 0 : Math.max(0, Math.round(m.roof.pitchSun * 2));
  const roofDir =
    m.roof.kind === "gable"
      ? m.roof.ridgeAxis === "w"
        ? 0
        : 1
      : m.roof.kind === "shed"
        ? m.roof.lowSide
        : 0;

  const parts: number[] = [
    VERSION,
    cm(m.width),
    cm(m.depth),
    cm(m.eaveH),
    roofKind,
    pitch2,
    roofDir,
    cm(m.eaveOut),
    Math.round(m.azimuthDeg),
    Math.round(m.albedo * 100),
    Math.round(m.turbidity * 10),
    Math.round(m.elevationM),
    m.windows.length,
  ];
  for (const w of m.windows) {
    parts.push(w.face, cm(w.w), cm(w.h), cm(w.sill), cm(w.off), Math.round(w.shgc * 100));
  }
  parts.push(m.obstacles.length);
  for (const o of m.obstacles) {
    parts.push(
      zigzag(Math.round(o.x * 100)),
      zigzag(Math.round(o.y * 100)),
      cm(o.w),
      cm(o.d),
      cm(o.h),
      Math.round(o.rotDeg),
    );
  }
  return parts.map((n) => n.toString(36)).join(".");
}

export function decodeHouse(s: string): HouseModel | null {
  if (s === "" || !/^[0-9a-z.]+$/.test(s)) return null;
  const r = new TokenReader(s.split("."));
  if (r.next() !== VERSION) return null;

  const width = r.next();
  const depth = r.next();
  const eaveH = r.next();
  const roofKind = r.next();
  const pitch2 = r.next();
  const roofDir = r.next();
  const eaveOut = r.next();
  const azimuth = r.next();
  const albedo = r.next();
  const tl = r.next();
  const elev = r.next();
  const nWin = r.next();
  if (
    width === null ||
    depth === null ||
    eaveH === null ||
    roofKind === null ||
    pitch2 === null ||
    roofDir === null ||
    eaveOut === null ||
    azimuth === null ||
    albedo === null ||
    tl === null ||
    elev === null ||
    nWin === null
  ) {
    return null;
  }

  const windows: WindowSpec[] = [];
  for (let i = 0; i < nWin; i++) {
    const face = r.next();
    const w = r.next();
    const h = r.next();
    const sill = r.next();
    const off = r.next();
    const shgc = r.next();
    if (face === null || w === null || h === null || sill === null || off === null || shgc === null) {
      return null;
    }
    windows.push({
      face: face as 0 | 1 | 2 | 3,
      w: w / 100,
      h: h / 100,
      sill: sill / 100,
      off: off / 100,
      shgc: shgc / 100,
    });
  }

  const nObs = r.next();
  if (nObs === null) return null;
  const obstacles: Obstacle[] = [];
  for (let i = 0; i < nObs; i++) {
    const x = r.next();
    const y = r.next();
    const w = r.next();
    const d = r.next();
    const h = r.next();
    const rot = r.next();
    if (x === null || y === null || w === null || d === null || h === null || rot === null) {
      return null;
    }
    obstacles.push({
      x: unzigzag(x) / 100,
      y: unzigzag(y) / 100,
      w: w / 100,
      d: d / 100,
      h: h / 100,
      rotDeg: rot,
    });
  }
  if (!r.done()) return null; // trailing garbage
  if (roofKind > 2) return null;

  const roof: RoofSpec =
    roofKind === 0
      ? { kind: "flat" }
      : roofKind === 1
        ? { kind: "gable", pitchSun: pitch2 / 2, ridgeAxis: roofDir === 1 ? "d" : "w" }
        : { kind: "shed", pitchSun: pitch2 / 2, lowSide: roofDir as 0 | 1 | 2 | 3 };

  return clampHouse({
    width: width / 100,
    depth: depth / 100,
    eaveH: eaveH / 100,
    roof,
    eaveOut: eaveOut / 100,
    azimuthDeg: azimuth,
    albedo: albedo / 100,
    turbidity: tl / 10,
    elevationM: elev,
    windows,
    obstacles,
  });
}
