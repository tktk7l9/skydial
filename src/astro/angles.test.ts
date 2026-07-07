import {
  asind,
  atan2d,
  cosd,
  deg2rad,
  normalizeDeg,
  normalizeDeg180,
  rad2deg,
  sind,
  tand,
} from "./angles";

describe("angles", () => {
  it("deg2rad / rad2deg round-trip", () => {
    expect(deg2rad(180)).toBeCloseTo(Math.PI, 12);
    expect(rad2deg(Math.PI / 2)).toBeCloseTo(90, 12);
    expect(rad2deg(deg2rad(123.456))).toBeCloseTo(123.456, 10);
  });

  it("normalizeDeg maps into [0, 360)", () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(725)).toBeCloseTo(5, 12);
    expect(normalizeDeg(-30)).toBeCloseTo(330, 12);
  });

  it("normalizeDeg180 maps into [-180, 180)", () => {
    expect(normalizeDeg180(190)).toBeCloseTo(-170, 12);
    expect(normalizeDeg180(-190)).toBeCloseTo(170, 12);
    expect(normalizeDeg180(45)).toBeCloseTo(45, 12);
    expect(normalizeDeg180(180)).toBeCloseTo(-180, 12);
  });

  it("degree trig matches radian trig", () => {
    expect(sind(30)).toBeCloseTo(0.5, 12);
    expect(cosd(60)).toBeCloseTo(0.5, 12);
    expect(tand(45)).toBeCloseTo(1, 12);
    expect(asind(1)).toBeCloseTo(90, 12);
    expect(atan2d(1, 1)).toBeCloseTo(45, 12);
  });
});
