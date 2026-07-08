import {
  azimuthDir,
  buildHouseGeometry,
  faceAzimuth,
  sunDirection,
} from "./geometry";
import { clampHouse, defaultHouse } from "./house";
import type { HouseModel } from "./house";

export function plainHouse(over: Partial<HouseModel> = {}): HouseModel {
  return {
    width: 10,
    depth: 8,
    eaveH: 3,
    roof: { kind: "flat" },
    eaveOut: 0,
    azimuthDeg: 180,
    albedo: 0.2,
    turbidity: 3,
    elevationM: 0,
    windows: [],
    obstacles: [],
    ...over,
  };
}

describe("direction helpers", () => {
  it("azimuthDir maps compass to ENU (+x east, +z south)", () => {
    expect(azimuthDir(0)[2]).toBeCloseTo(-1, 9); // north
    expect(azimuthDir(90)[0]).toBeCloseTo(1, 9); // east
    expect(azimuthDir(180)[2]).toBeCloseTo(1, 9); // south
  });

  it("sunDirection lifts by altitude", () => {
    const d = sunDirection(180, 45);
    expect(d[0]).toBeCloseTo(0, 9);
    expect(d[1]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(d[2]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(sunDirection(90, 0)).toEqual([
      expect.closeTo(1, 9),
      expect.closeTo(0, 9),
      expect.closeTo(0, 9),
    ]);
  });

  it("faceAzimuth walks clockwise from the front", () => {
    const m = plainHouse({ azimuthDeg: 180 });
    expect(faceAzimuth(m, 0)).toBe(180);
    expect(faceAzimuth(m, 1)).toBe(270);
    expect(faceAzimuth(m, 2)).toBe(0);
    expect(faceAzimuth(m, 3)).toBe(90);
  });
});

describe("buildHouseGeometry — triangle budget", () => {
  it("flat roof: 4 walls + slab = 10 triangles", () => {
    expect(buildHouseGeometry(plainHouse()).triangles).toHaveLength(10);
  });

  it("gable: walls + 2 slopes + 2 gable ends = 14 (both ridge axes)", () => {
    const w = plainHouse({ roof: { kind: "gable", pitchSun: 4, ridgeAxis: "w" } });
    const d = plainHouse({ roof: { kind: "gable", pitchSun: 4, ridgeAxis: "d" } });
    expect(buildHouseGeometry(w).triangles).toHaveLength(14);
    expect(buildHouseGeometry(d).triangles).toHaveLength(14);
  });

  it("shed: walls + roof + high wall + 2 side gussets = 14", () => {
    const m = plainHouse({ roof: { kind: "shed", pitchSun: 2, lowSide: 0 } });
    expect(buildHouseGeometry(m).triangles).toHaveLength(14);
    // Odd lowSide spans the width instead of the depth.
    const side = plainHouse({ roof: { kind: "shed", pitchSun: 2, lowSide: 1 } });
    expect(buildHouseGeometry(side).triangles).toHaveLength(14);
  });

  it("each obstacle adds 10 triangles (5 quads, no bottom)", () => {
    const m = plainHouse({
      obstacles: [{ x: 0, y: -12, w: 8, d: 8, h: 6, rotDeg: 0 }],
    });
    expect(buildHouseGeometry(m).triangles).toHaveLength(20);
  });

  it("default house builds with its windows and neighbor", () => {
    const g = buildHouseGeometry(clampHouse(defaultHouse()));
    expect(g.triangles).toHaveLength(24);
    expect(g.windows).toHaveLength(6);
  });
});

describe("buildHouseGeometry — windows", () => {
  it("window carries area, world azimuth and a bounded sample grid", () => {
    const m = plainHouse({
      windows: [{ face: 0, w: 1.69, h: 2.0, sill: 0.05, off: 1, shgc: 0.6 }],
    });
    const [win] = buildHouseGeometry(m).windows;
    expect(win.azimuthDeg).toBe(180);
    expect(win.areaM2).toBeCloseTo(3.38, 9);
    // ceil(1.69/0.3)=6 × ceil(2/0.3)=7→6 → 36 samples.
    expect(win.samples).toHaveLength(36);
    // Samples sit just outside the south wall plane (z = depth/2 + 0.01).
    for (const p of win.samples) expect(p[2]).toBeCloseTo(4.01, 9);
  });

  it("windows wider than the wall are clipped, absurd ones dropped", () => {
    const m = plainHouse({
      windows: [
        { face: 0, w: 100, h: 1, sill: 0.9, off: 0, shgc: 0.6 },
        { face: 0, w: 1, h: 1, sill: 0.9, off: 100, shgc: 0.6 },
      ],
    });
    const g = buildHouseGeometry(m);
    expect(g.windows[0].areaM2).toBeCloseTo(10 * 1, 6); // clipped to wall width
    // Second window's offset is pulled back inside the wall.
    expect(g.windows).toHaveLength(2);
  });

  it("zero-width windows are dropped entirely", () => {
    const m = plainHouse({
      windows: [{ face: 0, w: 0, h: 1, sill: 0.9, off: 1, shgc: 0.6 }],
    });
    expect(buildHouseGeometry(m).windows).toHaveLength(0);
  });

  it("tall windows are clipped to the eave height", () => {
    const m = plainHouse({
      windows: [{ face: 0, w: 1, h: 4, sill: 2, off: 1, shgc: 0.6 }],
    });
    const [win] = buildHouseGeometry(m).windows;
    expect(win.areaM2).toBeCloseTo(1 * 1, 6); // 3.0 eave − 2.0 sill
  });

  it("horizontalRadius covers the farthest obstacle corner", () => {
    const g = buildHouseGeometry(
      plainHouse({ obstacles: [{ x: 0, y: -20, w: 4, d: 4, h: 5, rotDeg: 0 }] }),
    );
    expect(g.horizontalRadius).toBeGreaterThan(21.9);
    expect(g.horizontalRadius).toBeLessThan(23.5);
  });
});
