import { altitudeIntervals, blueHours, goldenHours } from "./goldenhour";
import { sunAltitude } from "./solar";
import { TOKYO, TROMSO } from "./__fixtures__/ephemeris";

describe("goldenhour", () => {
  const dayStart = new Date("2026-06-20T15:00:00Z"); // Tokyo local midnight

  it("Tokyo solstice: morning and evening golden hour bracket sunrise/sunset", () => {
    const gh = goldenHours(dayStart, TOKYO);
    expect(gh).toHaveLength(2);
    // Morning interval contains the fixture sunrise (alt -0.83 ∈ [-4, 6]).
    const sunrise = Date.parse("2026-06-20T19:24:23Z");
    expect(gh[0].start.getTime()).toBeLessThan(sunrise);
    expect(gh[0].end.getTime()).toBeGreaterThan(sunrise);
    // Evening interval contains the fixture sunset.
    const sunset = Date.parse("2026-06-21T10:01:53Z");
    expect(gh[1].start.getTime()).toBeLessThan(sunset);
    expect(gh[1].end.getTime()).toBeGreaterThan(sunset);
    // The sun altitude at interval bounds is at the band edges.
    expect(sunAltitude(gh[0].start, TOKYO)).toBeCloseTo(-4, 1);
    expect(sunAltitude(gh[0].end, TOKYO)).toBeCloseTo(6, 1);
  });

  it("Tokyo solstice: blue hour sits just below golden hour", () => {
    const bh = blueHours(dayStart, TOKYO);
    const gh = goldenHours(dayStart, TOKYO);
    expect(bh).toHaveLength(2);
    // Morning: blue hour ends where golden hour begins.
    expect(Math.abs(bh[0].end.getTime() - gh[0].start.getTime())).toBeLessThan(2000);
    expect(sunAltitude(bh[0].start, TOKYO)).toBeCloseTo(-6, 1);
  });

  it("Tromsø midnight sun: no golden hour (sun stays above 6°? no — stays in band around midnight)", () => {
    // On the June solstice at 69.6°N the sun dips to ~3.8° at midnight but
    // never below -4°: the band is entered around midnight only if the sun
    // drops under 6°. Verify intervals are consistent with the altitude curve.
    const start = new Date("2026-06-20T22:00:00Z");
    const gh = goldenHours(start, TROMSO);
    for (const iv of gh) {
      const mid = new Date((iv.start.getTime() + iv.end.getTime()) / 2);
      const alt = sunAltitude(mid, TROMSO);
      expect(alt).toBeGreaterThanOrEqual(-4.01);
      expect(alt).toBeLessThanOrEqual(6.01);
    }
    // And blue hour must be empty: the sun never goes below -4°.
    expect(blueHours(start, TROMSO)).toHaveLength(0);
  });

  it("altitudeIntervals returns the whole window when always in band", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T06:00:00Z");
    const flat = (): number => 1;
    const ivs = altitudeIntervals(flat, 0, 2, start, end);
    expect(ivs).toHaveLength(1);
    expect(ivs[0].start.getTime()).toBe(start.getTime());
    expect(ivs[0].end.getTime()).toBe(end.getTime());
  });

  it("altitudeIntervals returns nothing when never in band", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T06:00:00Z");
    expect(altitudeIntervals(() => 10, 0, 2, start, end)).toHaveLength(0);
  });

  it("altitudeIntervals merges segments split by a hairline out-of-band dip", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T01:00:00Z");
    // In band (value 1 ∈ [0,2]) except a 1-second dip centred on the 10-min
    // scan mark: crossings land ~1s apart, the sliver between them is out of
    // band, and the surviving neighbours are contiguous → must merge.
    const dip = (t: Date): number =>
      Math.abs(t.getTime() - (start.getTime() + 600_000)) < 500 ? -1 : 1;
    const ivs = altitudeIntervals(dip, 0, 2, start, end);
    expect(ivs).toHaveLength(1);
    expect(ivs[0].start.getTime()).toBe(start.getTime());
    expect(ivs[0].end.getTime()).toBe(end.getTime());
  });

  it("altitudeIntervals drops degenerate sub-second segments", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-01T01:00:00Z");
    // 0.4s dip → the out-of-band sliver between crossings is <1s wide.
    const dip = (t: Date): number =>
      Math.abs(t.getTime() - (start.getTime() + 600_000)) < 200 ? -1 : 1;
    const ivs = altitudeIntervals(dip, 0, 2, start, end);
    expect(ivs).toHaveLength(1);
  });
});
