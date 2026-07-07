import { sunAltitude, sunEphemeris, sunPosition } from "./solar";
import { HORIZONS_SUN_TOKYO, TOKYO } from "./__fixtures__/ephemeris";

describe("solar", () => {
  it("Meeus example 25.a: sun at 1992-10-13.0 TD", () => {
    const eph = sunEphemeris(2_448_908.5);
    expect(eph.lambda).toBeCloseTo(199.90895, 3);
    expect(eph.ra).toBeCloseTo(198.38083, 2);
    expect(eph.dec).toBeCloseTo(-7.78507, 2);
    expect(eph.distanceAU).toBeCloseTo(0.99766, 3);
  });

  it("sun is due south and high at Tokyo solar noon", () => {
    // Solar noon from the NOAA fixture for 2026-06-21.
    const pos = sunPosition(new Date("2026-06-21T02:43:08Z"), TOKYO);
    expect(Math.abs(pos.azimuth - 180)).toBeLessThan(1);
    // Solstice noon altitude ≈ 90 − lat + 23.44 ≈ 77.76°.
    expect(pos.altitude).toBeCloseTo(90 - TOKYO.lat + 23.44, 0);
    expect(pos.apparentAltitude).toBeGreaterThan(pos.altitude);
  });

  it("matches JPL Horizons airless az/el to ~0.01°", () => {
    for (const ref of HORIZONS_SUN_TOKYO) {
      const pos = sunPosition(new Date(ref.utc), TOKYO);
      expect(Math.abs(pos.altitude - ref.altitude), `alt @ ${ref.utc}`).toBeLessThan(0.01);
      expect(Math.abs(pos.azimuth - ref.azimuth), `az @ ${ref.utc}`).toBeLessThan(0.02);
    }
  });

  it("sunAltitude matches sunPosition's true altitude", () => {
    const d = new Date("2026-07-07T03:00:00Z");
    expect(sunAltitude(d, TOKYO)).toBeCloseTo(sunPosition(d, TOKYO).altitude, 9);
  });
});
