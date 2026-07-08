// Parametric house model: types, limits and a representative default
// (a typical ~30-tsubo single-story with a south-facing gable — NOT anyone's
// real dimensions; personal models live only in localStorage / shared URLs).

export type RoofSpec =
  | { kind: "flat" }
  | { kind: "gable"; pitchSun: number; ridgeAxis: "w" | "d" }
  | { kind: "shed"; pitchSun: number; lowSide: 0 | 1 | 2 | 3 };

export interface WindowSpec {
  /** 0=front (faces `azimuthDeg`), 1=right, 2=back, 3=left. */
  face: 0 | 1 | 2 | 3;
  /** Opening size, m. */
  w: number;
  h: number;
  /** Sill height above ground, m. */
  sill: number;
  /** Distance from the face's left edge (seen from outside) to the window's left edge, m. */
  off: number;
  /** Solar heat gain coefficient η (0–1). */
  shgc: number;
}

export interface Obstacle {
  /** Box center offset from the house center: east(+x) / north(+y), m. */
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rotDeg: number;
}

export interface HouseModel {
  /** Frontage (間口) along the front face, m. */
  width: number;
  /** Depth (奥行), m. */
  depth: number;
  /** Eave (wall-top) height, m. */
  eaveH: number;
  roof: RoofSpec;
  /** Eave overhang (軒の出), m, uniform. */
  eaveOut: number;
  /** Azimuth the front face looks toward, N=0° clockwise. */
  azimuthDeg: number;
  albedo: number;
  /** Linke turbidity TL (≈2 pristine … 5.5 hazy). */
  turbidity: number;
  elevationM: number;
  windows: WindowSpec[];
  obstacles: Obstacle[];
}

export const HOUSE_LIMITS = {
  width: [2, 30],
  depth: [2, 30],
  eaveH: [2, 10],
  pitchSun: [0, 10],
  eaveOut: [0, 2],
  albedo: [0.05, 0.9],
  turbidity: [2, 5.5],
  elevationM: [0, 3000],
  windowW: [0.2, 6],
  windowH: [0.2, 4],
  sill: [0, 4],
  off: [0, 30],
  shgc: [0.01, 0.99],
  obstacleWD: [0.5, 40],
  obstacleH: [0.5, 30],
  obstacleXY: [-60, 60],
  maxWindows: 12,
  maxObstacles: 5,
} as const;

function clampNum(v: number, [lo, hi]: readonly [number, number], fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}

function wrapDeg(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return ((Math.round(v) % 360) + 360) % 360;
}

/** Clamp every field into its legal range (never throws). */
export function clampHouse(m: HouseModel): HouseModel {
  const L = HOUSE_LIMITS;
  const roof: RoofSpec =
    m.roof.kind === "flat"
      ? { kind: "flat" }
      : m.roof.kind === "gable"
        ? {
            kind: "gable",
            pitchSun: clampNum(m.roof.pitchSun, L.pitchSun, 4),
            ridgeAxis: m.roof.ridgeAxis === "d" ? "d" : "w",
          }
        : {
            kind: "shed",
            pitchSun: clampNum(m.roof.pitchSun, L.pitchSun, 2),
            lowSide: ([0, 1, 2, 3].includes(m.roof.lowSide) ? m.roof.lowSide : 2) as
              | 0
              | 1
              | 2
              | 3,
          };
  return {
    width: clampNum(m.width, L.width, 10),
    depth: clampNum(m.depth, L.depth, 9),
    eaveH: clampNum(m.eaveH, L.eaveH, 3),
    roof,
    eaveOut: clampNum(m.eaveOut, L.eaveOut, 0.6),
    azimuthDeg: wrapDeg(m.azimuthDeg),
    albedo: clampNum(m.albedo, L.albedo, 0.2),
    turbidity: clampNum(m.turbidity, L.turbidity, 3),
    elevationM: clampNum(m.elevationM, L.elevationM, 0),
    windows: m.windows.slice(0, L.maxWindows).map((w) => ({
      face: ([0, 1, 2, 3].includes(w.face) ? w.face : 0) as 0 | 1 | 2 | 3,
      w: clampNum(w.w, L.windowW, 1.65),
      h: clampNum(w.h, L.windowH, 1.1),
      sill: clampNum(w.sill, L.sill, 0.9),
      off: clampNum(w.off, L.off, 1),
      shgc: clampNum(w.shgc, L.shgc, 0.6),
    })),
    obstacles: m.obstacles.slice(0, L.maxObstacles).map((o) => ({
      x: clampNum(o.x, L.obstacleXY, 0),
      y: clampNum(o.y, L.obstacleXY, -12),
      w: clampNum(o.w, L.obstacleWD, 8),
      d: clampNum(o.d, L.obstacleWD, 8),
      h: clampNum(o.h, L.obstacleH, 6),
      rotDeg: wrapDeg(o.rotDeg),
    })),
  };
}

/** Representative starter model: south-facing single-story gable. */
export function defaultHouse(): HouseModel {
  return {
    width: 10.92, // 6間
    depth: 9.1, // 5間
    eaveH: 2.9,
    roof: { kind: "gable", pitchSun: 4, ridgeAxis: "w" },
    eaveOut: 0.6,
    azimuthDeg: 180,
    albedo: 0.2,
    turbidity: 3,
    elevationM: 0,
    windows: [
      { face: 0, w: 1.69, h: 2.0, sill: 0.05, off: 1.2, shgc: 0.6 }, // 掃き出し
      { face: 0, w: 1.69, h: 2.0, sill: 0.05, off: 4.2, shgc: 0.6 },
      { face: 0, w: 1.65, h: 1.1, sill: 0.9, off: 7.8, shgc: 0.6 }, // 腰窓
      { face: 1, w: 1.19, h: 1.1, sill: 0.9, off: 3.0, shgc: 0.6 },
      { face: 3, w: 0.6, h: 1.1, sill: 0.9, off: 2.0, shgc: 0.6 },
      { face: 2, w: 0.6, h: 0.9, sill: 1.1, off: 2.0, shgc: 0.6 },
    ],
    obstacles: [
      // Two-story neighbor 6 m south of the facade.
      { x: 0, y: -(9.1 / 2 + 6 + 4), w: 8, d: 8, h: 6.5, rotDeg: 0 },
    ],
  };
}
