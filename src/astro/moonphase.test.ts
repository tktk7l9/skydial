import { SYNODIC_MONTH_DAYS, moonGlyph, moonPhase } from "./moonphase";
import type { MoonPhaseName } from "./moonphase";
import { USNO_MOON_FIXTURES, USNO_MOON_PHASES } from "./__fixtures__/ephemeris";

describe("moonphase", () => {
  it("full moon 2026-12-24T01:28Z: illumination ≈ 1, name=full, waning after", () => {
    const p = moonPhase(new Date(USNO_MOON_PHASES.full));
    expect(p.illumination).toBeGreaterThan(0.99);
    expect(p.name).toBe("full");
    expect(p.phaseAngle).toBeLessThan(12);
    const dayAfter = moonPhase(new Date(Date.parse(USNO_MOON_PHASES.full) + 86_400_000));
    expect(dayAfter.waxing).toBe(false);
  });

  it("first quarter 2026-06-21T21:55Z: illumination ≈ 0.5 waxing", () => {
    const p = moonPhase(new Date(USNO_MOON_PHASES.firstQuarter));
    expect(Math.abs(p.illumination - 0.5)).toBeLessThan(0.03);
    expect(p.waxing).toBe(true);
    expect(p.name).toBe("firstQuarter");
  });

  it("last quarter 2026-07-07T19:29Z: illumination ≈ 0.5 waning", () => {
    const p = moonPhase(new Date(USNO_MOON_PHASES.lastQuarter));
    expect(Math.abs(p.illumination - 0.5)).toBeLessThan(0.03);
    expect(p.waxing).toBe(false);
    expect(p.name).toBe("lastQuarter");
  });

  it("matches USNO fracillum for the day fixtures (±5%)", () => {
    for (const fx of USNO_MOON_FIXTURES) {
      if (fx.illumination === null) continue;
      // USNO's fracillum is quoted for the local day; compare at local noon.
      const localNoon = new Date(Date.parse(fx.dayStartUtc) + 12 * 3600 * 1000);
      const p = moonPhase(localNoon);
      expect(
        Math.abs(p.illumination - fx.illumination),
        `${fx.name}: got ${p.illumination.toFixed(3)}`,
      ).toBeLessThan(0.05);
    }
  });

  it("age advances ~1 day per day and wraps within a synodic month", () => {
    const d0 = new Date("2026-07-01T00:00:00Z");
    const p0 = moonPhase(d0);
    const p1 = moonPhase(new Date(d0.getTime() + 86_400_000));
    const delta = (p1.ageDays - p0.ageDays + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
    expect(delta).toBeGreaterThan(0.8);
    expect(delta).toBeLessThan(1.25);
    expect(p0.ageDays).toBeGreaterThanOrEqual(0);
    expect(p0.ageDays).toBeLessThan(SYNODIC_MONTH_DAYS);
  });

  it("phase names cycle through all 8 over a month, with matching glyphs", () => {
    const seen = new Set<MoonPhaseName>();
    const start = Date.parse("2026-07-01T00:00:00Z");
    for (let h = 0; h < 24 * 31; h += 6) {
      const p = moonPhase(new Date(start + h * 3_600_000));
      seen.add(p.name);
      expect(moonGlyph(p.name)).toBeTruthy();
    }
    expect(seen.size).toBe(8);
  });

  it("elongation and phase angle are complementary at the extremes", () => {
    const full = moonPhase(new Date(USNO_MOON_PHASES.full));
    expect(Math.abs(full.elongation - 180)).toBeLessThan(10);
  });
});
