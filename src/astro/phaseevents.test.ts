import {
  accurateMoonAge,
  nextPrincipalPhase,
  previousNewMoon,
  solsticeInstant,
} from "./phaseevents";
import { sunEphemeris } from "./solar";
import { toJulianEphemerisDay } from "./julian";
import { USNO_MOON_PHASES } from "./__fixtures__/ephemeris";

const TOLERANCE_MIN = 10; // USNO minute precision + truncated-series error

function expectWithin(actual: Date, expectedIso: string, label: string): void {
  const diffMin = Math.abs(actual.getTime() - Date.parse(expectedIso)) / 60_000;
  expect(diffMin, `${label}: off by ${diffMin.toFixed(1)} min`).toBeLessThanOrEqual(
    TOLERANCE_MIN,
  );
}

describe("nextPrincipalPhase vs USNO", () => {
  it("first quarter 2026-06-21T21:55Z", () => {
    expectWithin(
      nextPrincipalPhase(new Date("2026-06-15T00:00:00Z"), "firstQuarter"),
      USNO_MOON_PHASES.firstQuarter,
      "first quarter",
    );
  });

  it("last quarter 2026-07-07T19:29Z", () => {
    expectWithin(
      nextPrincipalPhase(new Date("2026-07-01T00:00:00Z"), "lastQuarter"),
      USNO_MOON_PHASES.lastQuarter,
      "last quarter",
    );
  });

  it("full moon 2026-12-24T01:28Z", () => {
    expectWithin(
      nextPrincipalPhase(new Date("2026-12-01T00:00:00Z"), "full"),
      USNO_MOON_PHASES.full,
      "full moon",
    );
  });

  it("finds a phase even when the search starts moments after one", () => {
    const full = nextPrincipalPhase(new Date("2026-12-01T00:00:00Z"), "full");
    const next = nextPrincipalPhase(new Date(full.getTime() + 60_000), "full");
    const gapDays = (next.getTime() - full.getTime()) / 86_400_000;
    expect(gapDays).toBeGreaterThan(29);
    expect(gapDays).toBeLessThan(30.5);
  });
});

describe("previousNewMoon / accurateMoonAge", () => {
  it("age is ~0 right after the new moon and grows ~1/day", () => {
    const newMoon = nextPrincipalPhase(new Date("2026-07-01T00:00:00Z"), "new");
    const justAfter = new Date(newMoon.getTime() + 3_600_000);
    expect(previousNewMoon(justAfter).getTime()).toBeCloseTo(newMoon.getTime(), -4);
    expect(accurateMoonAge(justAfter)).toBeLessThan(0.05);
    expect(accurateMoonAge(new Date(newMoon.getTime() + 5 * 86_400_000))).toBeCloseTo(
      5,
      1,
    );
  });

  it("age at the quarters/full sits in the physical range", () => {
    const fq = new Date(USNO_MOON_PHASES.firstQuarter);
    expect(accurateMoonAge(fq)).toBeGreaterThan(6.4);
    expect(accurateMoonAge(fq)).toBeLessThan(8.6);
    const full = new Date(USNO_MOON_PHASES.full);
    expect(accurateMoonAge(full)).toBeGreaterThan(13.5);
    expect(accurateMoonAge(full)).toBeLessThan(16.5);
  });
});

describe("solsticeInstant", () => {
  it("June solstice 2026: apparent longitude hits exactly 90°", () => {
    const t = solsticeInstant(2026, "jun");
    expect(t.toISOString().slice(0, 10)).toMatch(/2026-06-2[01]/);
    const lambda = sunEphemeris(toJulianEphemerisDay(t)).lambda;
    expect(Math.abs(lambda - 90)).toBeLessThan(0.001);
    // Declination is at its maximum: lower 12h on either side.
    const dec = (d: Date): number => sunEphemeris(toJulianEphemerisDay(d)).dec;
    expect(dec(t)).toBeGreaterThan(dec(new Date(t.getTime() - 12 * 3_600_000)));
    expect(dec(t)).toBeGreaterThan(dec(new Date(t.getTime() + 12 * 3_600_000)));
  });

  it("December solstice 2026: longitude 270°, minimum declination", () => {
    const t = solsticeInstant(2026, "dec");
    expect(t.toISOString().slice(0, 10)).toMatch(/2026-12-2[12]/);
    const lambda = sunEphemeris(toJulianEphemerisDay(t)).lambda;
    expect(Math.abs(lambda - 270)).toBeLessThan(0.001);
    const dec = (d: Date): number => sunEphemeris(toJulianEphemerisDay(d)).dec;
    expect(dec(t)).toBeLessThan(dec(new Date(t.getTime() - 12 * 3_600_000)));
    expect(dec(t)).toBeLessThan(dec(new Date(t.getTime() + 12 * 3_600_000)));
  });
});
