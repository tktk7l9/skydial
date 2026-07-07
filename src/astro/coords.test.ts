import {
  eclipticToEquatorial,
  equatorialToHorizontal,
  meanObliquity,
  refraction,
} from "./coords";

describe("coords", () => {
  it("mean obliquity at J2000 is ~23.4393°", () => {
    expect(meanObliquity(0)).toBeCloseTo(23.4392911, 6);
  });

  it("Meeus example 13.a: Pollux ecliptic → equatorial", () => {
    const { ra, dec } = eclipticToEquatorial(113.21563, 6.68417, 23.4392911);
    expect(ra).toBeCloseTo(116.328942, 5);
    expect(dec).toBeCloseTo(28.026183, 5);
  });

  it("Meeus example 13.b: Venus from Washington, azimuth north-based", () => {
    // H = 64.352133°, so lmst = H + ra. Meeus gives A=68.0337 (from south),
    // h=15.1249 → north-based azimuth 248.0337.
    const ra = 347.3193375;
    const dec = -6.719892;
    const lat = 38.9213889;
    const { azimuth, altitude } = equatorialToHorizontal(
      { ra, dec },
      lat,
      64.352133 + ra,
    );
    expect(azimuth).toBeCloseTo(248.0337, 3);
    expect(altitude).toBeCloseTo(15.1249, 3);
  });

  it("horizontal coords: object on celestial equator transits at 90−lat", () => {
    const { azimuth, altitude } = equatorialToHorizontal(
      { ra: 100, dec: 0 },
      35,
      100, // hour angle 0 = transit
    );
    expect(altitude).toBeCloseTo(55, 9);
    expect(azimuth).toBeCloseTo(180, 6);
  });

  it("refraction is ~0.48° at the horizon, ~1′ at 45°, ~0 at zenith", () => {
    expect(refraction(0)).toBeCloseTo(0.483, 2);
    expect(refraction(45)).toBeCloseTo(0.0169, 3);
    expect(refraction(90)).toBeGreaterThanOrEqual(0);
    expect(refraction(90)).toBeLessThan(0.001);
  });

  it("refraction clamps below -1° instead of blowing up", () => {
    expect(refraction(-5)).toBe(refraction(-1));
  });
});
