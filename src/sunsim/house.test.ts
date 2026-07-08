import { clampHouse, defaultHouse } from "./house";
import type { HouseModel } from "./house";

describe("defaultHouse", () => {
  it("is a plausible 30-tsubo single-story and survives clamping unchanged", () => {
    const d = defaultHouse();
    expect(clampHouse(d)).toEqual(d);
    expect(d.windows.length).toBeGreaterThan(0);
    expect(d.obstacles).toHaveLength(1);
    expect(d.roof.kind).toBe("gable");
  });
});

describe("clampHouse", () => {
  const base = defaultHouse();

  it("clamps out-of-range numbers and NaN to safe values", () => {
    const dirty: HouseModel = {
      ...base,
      width: 500,
      depth: Number.NaN,
      eaveH: -3,
      eaveOut: 99,
      azimuthDeg: 725.4,
      albedo: 2,
      turbidity: 0,
      elevationM: 99_999,
    };
    const c = clampHouse(dirty);
    expect(c.width).toBe(30);
    expect(c.depth).toBe(9); // NaN → fallback
    expect(c.eaveH).toBe(2);
    expect(c.eaveOut).toBe(2);
    expect(c.azimuthDeg).toBe(5);
    expect(c.albedo).toBe(0.9);
    expect(c.turbidity).toBe(2);
    expect(c.elevationM).toBe(3000);
  });

  it("non-finite azimuths fall back to 0", () => {
    expect(clampHouse({ ...base, azimuthDeg: Number.NaN }).azimuthDeg).toBe(0);
    const rotNaN = clampHouse({
      ...base,
      obstacles: [{ x: 0, y: -12, w: 8, d: 8, h: 6, rotDeg: Number.POSITIVE_INFINITY }],
    });
    expect(rotNaN.obstacles[0].rotDeg).toBe(0);
  });

  it("keeps an explicit ridgeAxis 'd'", () => {
    expect(
      clampHouse({ ...base, roof: { kind: "gable", pitchSun: 3, ridgeAxis: "d" } }).roof,
    ).toEqual({ kind: "gable", pitchSun: 3, ridgeAxis: "d" });
  });

  it("normalizes every roof kind and bad enum values", () => {
    expect(clampHouse({ ...base, roof: { kind: "flat" } }).roof).toEqual({ kind: "flat" });
    expect(
      clampHouse({ ...base, roof: { kind: "gable", pitchSun: 99, ridgeAxis: "x" as "w" } })
        .roof,
    ).toEqual({ kind: "gable", pitchSun: 10, ridgeAxis: "w" });
    expect(
      clampHouse({ ...base, roof: { kind: "shed", pitchSun: -1, lowSide: 9 as 0 } }).roof,
    ).toEqual({ kind: "shed", pitchSun: 0, lowSide: 2 });
    expect(
      clampHouse({ ...base, roof: { kind: "shed", pitchSun: 2, lowSide: 1 } }).roof,
    ).toEqual({ kind: "shed", pitchSun: 2, lowSide: 1 });
  });

  it("truncates window/obstacle lists and sanitizes entries", () => {
    const many: HouseModel = {
      ...base,
      windows: Array.from({ length: 20 }, () => ({
        face: 7 as 0,
        w: 99,
        h: 0,
        sill: -1,
        off: 99,
        shgc: 5,
      })),
      obstacles: Array.from({ length: 9 }, () => ({
        x: 999,
        y: -999,
        w: 0,
        d: 999,
        h: 0,
        rotDeg: -90,
      })),
    };
    const c = clampHouse(many);
    expect(c.windows).toHaveLength(12);
    expect(c.windows[0]).toEqual({ face: 0, w: 6, h: 0.2, sill: 0, off: 30, shgc: 0.99 });
    expect(c.obstacles).toHaveLength(5);
    expect(c.obstacles[0]).toEqual({ x: 60, y: -60, w: 0.5, d: 40, h: 0.5, rotDeg: 270 });
  });
});
