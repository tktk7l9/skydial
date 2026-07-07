import {
  SUN_RISE_SET_ALTITUDE,
  classifyRiseSet,
  findCrossings,
  findTransit,
  sunDayEvents,
} from "./events";
import { SUN_DAY_FIXTURES, USNO_SUN_FIXTURES } from "./__fixtures__/ephemeris";

// The secondary API's twilights agree with USNO, but its rise/set run
// ~60–120s early (see the fixture file header) — hence the loose tolerance.
const TOLERANCE_S = 150;
const NOON_TOLERANCE_S = 120;
const USNO_TOLERANCE_S = 75; // minute rounding (±30s) + model differences

function expectClose(
  actual: Date | null,
  expectedIso: string | null,
  label: string,
  toleranceS = TOLERANCE_S,
): void {
  if (expectedIso === null) {
    expect(actual, label).toBeNull();
    return;
  }
  expect(actual, label).not.toBeNull();
  const diff = Math.abs((actual as Date).getTime() - Date.parse(expectedIso)) / 1000;
  expect(diff, `${label}: off by ${diff.toFixed(1)}s`).toBeLessThanOrEqual(toleranceS);
}

describe("sunDayEvents vs USNO fixtures (primary)", () => {
  for (const fx of USNO_SUN_FIXTURES) {
    it(fx.name, () => {
      const ev = sunDayEvents(new Date(fx.dayStartUtc), fx.loc);
      if (fx.kind === "alwaysDown") {
        expect(ev.riseSet.kind).toBe("alwaysDown");
      } else {
        expect(ev.riseSet.kind).toBe("normal");
        if (ev.riseSet.kind === "normal") {
          expectClose(ev.riseSet.rise, fx.rise, "rise", USNO_TOLERANCE_S);
          expectClose(ev.riseSet.set, fx.set, "set", USNO_TOLERANCE_S);
        }
      }
      if (fx.transit !== null) {
        const diff = Math.abs(ev.solarNoon.time.getTime() - Date.parse(fx.transit)) / 1000;
        expect(diff, `transit off by ${diff.toFixed(1)}s`).toBeLessThanOrEqual(
          USNO_TOLERANCE_S,
        );
      }
      expectClose(ev.civilDawn, fx.civilDawn, "civil dawn", USNO_TOLERANCE_S);
      expectClose(ev.civilDusk, fx.civilDusk, "civil dusk", USNO_TOLERANCE_S);
    });
  }
});

describe("sunDayEvents vs sunrise-sunset.org fixtures (secondary)", () => {
  for (const fx of SUN_DAY_FIXTURES) {
    it(fx.name, () => {
      const ev = sunDayEvents(new Date(fx.dayStartUtc), fx.loc);

      expect(ev.riseSet.kind).toBe(fx.kind);
      if (ev.riseSet.kind === "normal") {
        expectClose(ev.riseSet.rise, fx.sunrise, "sunrise");
        expectClose(ev.riseSet.set, fx.sunset, "sunset");
      }

      const noonDiff =
        Math.abs(ev.solarNoon.time.getTime() - Date.parse(fx.solarNoon)) / 1000;
      expect(noonDiff, `solar noon off by ${noonDiff.toFixed(1)}s`).toBeLessThanOrEqual(
        NOON_TOLERANCE_S,
      );

      expectClose(ev.civilDawn, fx.civilDawn, "civil dawn");
      expectClose(ev.civilDusk, fx.civilDusk, "civil dusk");
      expectClose(ev.nauticalDawn, fx.nauticalDawn, "nautical dawn");
      expectClose(ev.nauticalDusk, fx.nauticalDusk, "nautical dusk");
      expectClose(ev.astronomicalDawn, fx.astronomicalDawn, "astronomical dawn");
      expectClose(ev.astronomicalDusk, fx.astronomicalDusk, "astronomical dusk");
    });
  }
});

describe("solver primitives", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2026-01-02T00:00:00Z");
  const hours = (t: Date): number => (t.getTime() - start.getTime()) / 3_600_000;
  // Simple sinusoid: up-crossing of 0 at t=0h/24h, down at 12h, peak at 6h.
  const wave = (t: Date): number => Math.sin((hours(t) / 24) * 2 * Math.PI);

  it("findCrossings locates rising and setting to sub-second precision", () => {
    const { rising, setting } = findCrossings(wave, () => 0.5, start, end);
    expect(rising).toHaveLength(1);
    expect(setting).toHaveLength(1);
    // sin(2πx/24) = 0.5 at x = 2h (rising) and 10h (setting).
    expect(Math.abs(hours(rising[0]) - 2)).toBeLessThan(0.001);
    expect(Math.abs(hours(setting[0]) - 10)).toBeLessThan(0.001);
  });

  it("classifyRiseSet reports alwaysUp / alwaysDown / partial days", () => {
    expect(classifyRiseSet(wave, () => -2, start, end).kind).toBe("alwaysUp");
    expect(classifyRiseSet(wave, () => 2, start, end).kind).toBe("alwaysDown");
    const halfDay = classifyRiseSet(wave, () => 0.5, start, new Date("2026-01-01T06:00:00Z"));
    expect(halfDay.kind).toBe("normal");
    if (halfDay.kind === "normal") {
      expect(halfDay.rise).not.toBeNull();
      expect(halfDay.set).toBeNull(); // only the rise falls inside the window
    }
    // Mirror window: only the setting is inside.
    const laterHalf = classifyRiseSet(
      wave,
      () => 0.5,
      new Date("2026-01-01T06:00:00Z"),
      new Date("2026-01-01T18:00:00Z"),
    );
    expect(laterHalf.kind).toBe("normal");
    if (laterHalf.kind === "normal") {
      expect(laterHalf.rise).toBeNull();
      expect(laterHalf.set).not.toBeNull();
    }
  });

  it("findTransit finds the sinusoid peak", () => {
    const { time, altitude } = findTransit(wave, start, end);
    expect(Math.abs(hours(time) - 6)).toBeLessThan(0.01);
    expect(altitude).toBeCloseTo(1, 5);
  });

  it("sun rise/set threshold constant is -0.8333°", () => {
    expect(SUN_RISE_SET_ALTITUDE).toBeCloseTo(-0.8333, 4);
  });
});
