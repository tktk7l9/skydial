import {
  clipToRect,
  computeFloorPatch,
  projectToFloor,
  windowCorners,
} from "./interior";
import { buildHouseGeometry, sunDirection } from "./geometry";
import type { WindowGeo } from "./geometry";
import { plainHouse } from "./geometry.test";

function area(poly: ReadonlyArray<readonly [number, number]>): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

describe("windowCorners", () => {
  it("returns the 4 corners of the opening, centered on `center`", () => {
    const win: WindowGeo = {
      spec: { face: 0, w: 2, h: 1, sill: 1, off: 4, shgc: 0.6 },
      azimuthDeg: 180,
      normal: [0, 0, 1],
      hAxis: [1, 0, 0],
      center: [0, 1.5, 4],
      widthM: 2,
      heightM: 1,
      areaM2: 2,
      samples: [],
    };
    const corners = windowCorners(win);
    expect(corners).toHaveLength(4);
    // bottom-left, bottom-right, top-right, top-left (x=±1, y=1 or 2, z=4).
    expect(corners[0]).toEqual([-1, 1, 4]);
    expect(corners[1]).toEqual([1, 1, 4]);
    expect(corners[2]).toEqual([1, 2, 4]);
    expect(corners[3]).toEqual([-1, 2, 4]);
  });
});

describe("projectToFloor", () => {
  it("projects along the light's travel direction (opposite the sun)", () => {
    // Sun due south at 45°: dir=[0, √2/2, √2/2]. A point at height 1 lands
    // 1 m north of its own (x,z) (light travels away from the sun).
    const dir = sunDirection(180, 45);
    const p = projectToFloor([0, 1, 4], dir);
    expect(p).not.toBeNull();
    expect(p![1]).toBe(0);
    expect(p![0]).toBeCloseTo(0, 9);
    expect(p![2]).toBeCloseTo(3, 9);
  });

  it("returns null for a sun direction at/below the horizon", () => {
    expect(projectToFloor([0, 1, 4], [0, 0, 1])).toBeNull();
    expect(projectToFloor([0, 1, 4], [0, -0.1, 1])).toBeNull();
  });
});

describe("clipToRect", () => {
  const RECT = [0, 10, 0, 10] as const;

  it("passes a fully-inside polygon through unchanged", () => {
    const square = [
      [2, 2],
      [8, 2],
      [8, 8],
      [2, 8],
    ] as const;
    expect(clipToRect(square, ...RECT)).toEqual(square);
  });

  it("clips a fully-outside polygon to empty", () => {
    const square = [
      [20, 20],
      [28, 20],
      [28, 28],
      [20, 28],
    ] as const;
    expect(clipToRect(square, ...RECT)).toEqual([]);
  });

  it("clips a polygon straddling one edge to the exact rectangle", () => {
    const square = [
      [5, 3],
      [15, 3],
      [15, 7],
      [5, 7],
    ] as const;
    const clipped = clipToRect(square, ...RECT);
    for (const [u] of clipped) expect(u).toBeLessThanOrEqual(10);
    expect(area(clipped)).toBeCloseTo(5 * 4, 9); // u:5..10, v:3..7
  });

  it("clips a polygon straddling the min edges (left/bottom)", () => {
    const square = [
      [-3, -3],
      [5, -3],
      [5, 5],
      [-3, 5],
    ] as const;
    const clipped = clipToRect(square, ...RECT);
    for (const [u, v] of clipped) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(area(clipped)).toBeCloseTo(5 * 5, 9); // u:0..5, v:0..5
  });

  it("clips a diamond straddling a corner to a smaller convex polygon", () => {
    const diamond = [
      [10, 5],
      [15, 10],
      [10, 15],
      [5, 10],
    ] as const;
    const clipped = clipToRect(diamond, ...RECT);
    expect(clipped.length).toBeGreaterThanOrEqual(3);
    for (const [u, v] of clipped) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    }
    const clippedArea = area(clipped);
    expect(clippedArea).toBeGreaterThan(0);
    expect(clippedArea).toBeLessThan(50); // full diamond area = ½·10·10
  });
});

describe("computeFloorPatch", () => {
  // width=10, depth=8, flat roof, azimuthDeg=180 (south front) — this makes
  // the local (u,v) frame coincide with world (x,z), so the math is
  // hand-checkable: front wall sits at v=depth/2 (+ a 1cm exterior lift).
  const model = plainHouse({ width: 10, depth: 8, eaveH: 3 });

  it("unclipped patch: exact area/depth for a due-south window at 45°", () => {
    const geo = buildHouseGeometry(
      plainHouse({
        width: 10,
        depth: 8,
        eaveH: 3,
        windows: [{ face: 0, w: 2, h: 1, sill: 1, off: 4, shgc: 0.6 }],
      }),
    );
    const sunDir = sunDirection(180, 45);
    const patch = computeFloorPatch(model, geo.windows[0], sunDir);
    expect(patch).not.toBeNull();
    // u spans -1..1 (2 m); v spans wall-1 .. wall-2 (1 m) → area exactly 2.
    expect(patch!.areaM2).toBeCloseTo(2, 6);
    // Depth to the nearer (higher) edge is 2 m; the 1cm exterior lift
    // cancels out of the depth difference exactly.
    expect(patch!.depthM).toBeCloseTo(2, 6);
    expect(patch!.polygon).toHaveLength(4);
    for (const p of patch!.polygon) expect(p[1]).toBe(0);
  });

  it("grazing sun clips the patch at the far wall (depth capped at room depth)", () => {
    const geo = buildHouseGeometry(
      plainHouse({
        width: 10,
        depth: 8,
        eaveH: 3,
        windows: [{ face: 0, w: 2, h: 2, sill: 0.05, off: 4, shgc: 0.6 }],
      }),
    );
    const sunDir = sunDirection(180, 10);
    const patch = computeFloorPatch(model, geo.windows[0], sunDir);
    expect(patch).not.toBeNull();
    // Capped at (depth/2 + lift) − (−depth/2) ≈ depth + lift.
    expect(patch!.depthM).toBeGreaterThan(7.9);
    expect(patch!.depthM).toBeLessThanOrEqual(8.02);
    expect(patch!.areaM2).toBeGreaterThan(10);
    expect(patch!.areaM2).toBeLessThan(16);
    // Width (u-extent) is untouched by the v-only clip: still 2 m.
    const us = patch!.polygon.map((p) => p[0]);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(2, 6);
  });

  it("sun behind the wall yields no patch", () => {
    const geo = buildHouseGeometry(
      plainHouse({
        width: 10,
        depth: 8,
        eaveH: 3,
        windows: [{ face: 0, w: 2, h: 1, sill: 1, off: 4, shgc: 0.6 }],
      }),
    );
    const sunDir = sunDirection(0, 45); // due north — behind the south window
    expect(computeFloorPatch(model, geo.windows[0], sunDir)).toBeNull();
  });

  it("a beam so low it would hit the far wall first yields no floor patch", () => {
    const geo = buildHouseGeometry(
      plainHouse({
        width: 10,
        depth: 8,
        eaveH: 3,
        windows: [{ face: 0, w: 1, h: 0.5, sill: 2, off: 4.5, shgc: 0.6 }],
      }),
    );
    const sunDir = sunDirection(180, 2); // very low, high window
    expect(computeFloorPatch(model, geo.windows[0], sunDir)).toBeNull();
  });

  it("degenerate at-horizon sun direction returns null", () => {
    const geo = buildHouseGeometry(
      plainHouse({
        width: 10,
        depth: 8,
        eaveH: 3,
        windows: [{ face: 0, w: 2, h: 1, sill: 1, off: 4, shgc: 0.6 }],
      }),
    );
    expect(computeFloorPatch(model, geo.windows[0], [0, 0, 1])).toBeNull();
  });

  it("a vanishingly thin window yields no meaningful patch (near-zero area guard)", () => {
    const sliver: WindowGeo = {
      spec: { face: 0, w: 2, h: 1e-9, sill: 1.5, off: 4, shgc: 0.6 },
      azimuthDeg: 180,
      normal: [0, 0, 1],
      hAxis: [1, 0, 0],
      center: [0, 1.5, 4.01],
      widthM: 2,
      heightM: 1e-9,
      areaM2: 2e-9,
      samples: [],
    };
    expect(computeFloorPatch(model, sliver, sunDirection(180, 45))).toBeNull();
  });

  it("works for a rotated house and a side-facing window (general u/v transform)", () => {
    const rotated = plainHouse({ width: 12, depth: 10, eaveH: 3, azimuthDeg: 205 });
    const geo = buildHouseGeometry({
      ...rotated,
      windows: [{ face: 1, w: 1.5, h: 1.2, sill: 0.8, off: 2, shgc: 0.6 }],
    });
    // Face 1's azimuth is 205+90=295°; aim the sun roughly at it.
    const sunDir = sunDirection(295, 35);
    const patch = computeFloorPatch(rotated, geo.windows[0], sunDir);
    expect(patch).not.toBeNull();
    expect(patch!.areaM2).toBeGreaterThan(0);
    expect(Number.isFinite(patch!.depthM)).toBe(true);
    // Every floor point must lie within the (possibly rotated) footprint.
    for (const p of patch!.polygon) {
      expect(Math.hypot(p[0], p[2])).toBeLessThan(Math.hypot(12, 10));
    }
  });
});
