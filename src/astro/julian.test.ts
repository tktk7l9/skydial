import {
  J2000,
  deltaTSeconds,
  fromJulianDay,
  julianCenturies,
  toJulianDay,
  toJulianEphemerisDay,
} from "./julian";

describe("julian", () => {
  it("J2000.0 epoch is JD 2451545.0", () => {
    expect(toJulianDay(new Date("2000-01-01T12:00:00Z"))).toBeCloseTo(J2000, 9);
  });

  it("Meeus example 7.a: 1987-01-27T00:00Z = JD 2446822.5", () => {
    expect(toJulianDay(new Date("1987-01-27T00:00:00Z"))).toBeCloseTo(2_446_822.5, 9);
  });

  it("Unix epoch is JD 2440587.5", () => {
    expect(toJulianDay(new Date(0))).toBeCloseTo(2_440_587.5, 9);
  });

  it("fromJulianDay round-trips to the millisecond", () => {
    const d = new Date("2026-07-07T12:34:56.789Z");
    expect(fromJulianDay(toJulianDay(d)).getTime()).toBe(d.getTime());
  });

  it("julianCenturies is 0 at J2000 and 0.24 in early 2024", () => {
    expect(julianCenturies(J2000)).toBe(0);
    expect(julianCenturies(toJulianDay(new Date("2024-01-01T00:00:00Z")))).toBeCloseTo(
      0.24,
      2,
    );
  });

  it("deltaT is ~69s for 2020 and ~73s for 2026", () => {
    expect(deltaTSeconds(2020)).toBeGreaterThan(67);
    expect(deltaTSeconds(2020)).toBeLessThan(72);
    expect(deltaTSeconds(2026)).toBeGreaterThan(70);
    expect(deltaTSeconds(2026)).toBeLessThan(76);
  });

  it("deltaT clamps outside 2005–2050", () => {
    expect(deltaTSeconds(1990)).toBe(deltaTSeconds(2005));
    expect(deltaTSeconds(2120)).toBe(deltaTSeconds(2050));
  });

  it("JDE runs ahead of JD by ΔT", () => {
    const d = new Date("2026-07-07T00:00:00Z");
    const ahead = (toJulianEphemerisDay(d) - toJulianDay(d)) * 86_400;
    // JD is ~2.4e6, so float64 granularity is ~4e-5 s — compare at ms precision.
    expect(ahead).toBeCloseTo(deltaTSeconds(2026), 3);
  });
});
