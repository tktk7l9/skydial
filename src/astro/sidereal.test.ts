import { toJulianDay } from "./julian";
import { gmst, lmst } from "./sidereal";

describe("sidereal", () => {
  it("Meeus example 12.a: GMST at 1987-04-10T00:00Z is 13h10m46.3668s", () => {
    const deg = gmst(toJulianDay(new Date("1987-04-10T00:00:00Z")));
    expect(deg).toBeCloseTo(197.693195, 4);
  });

  it("Meeus example 12.b: GMST at 1987-04-10T19:21:00Z is 128.737873°", () => {
    const deg = gmst(toJulianDay(new Date("1987-04-10T19:21:00Z")));
    expect(deg).toBeCloseTo(128.737873, 4);
  });

  it("lmst adds east longitude", () => {
    const jd = toJulianDay(new Date("2026-07-07T00:00:00Z"));
    expect(lmst(jd, 139.65)).toBeCloseTo((gmst(jd) + 139.65) % 360, 9);
    expect(lmst(jd, -0.13)).toBeCloseTo((gmst(jd) - 0.13 + 360) % 360, 9);
  });
});
