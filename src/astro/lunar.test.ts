import {
  moonEphemeris,
  moonGeocentricAltitude,
  moonPosition,
  moonRiseSetThreshold,
} from "./lunar";
import { moonDayEvents } from "./events";
import { TOKYO, USNO_MOON_FIXTURES } from "./__fixtures__/ephemeris";

// USNO rounds to the minute; the truncated series adds up to ~0.05° (≈ 2 min
// near the horizon at mid-latitudes, more when the moon crosses obliquely).
const TOLERANCE_S = 240;

describe("lunar ephemeris", () => {
  it("Meeus example 47.a: moon at 1992-04-12.0 TD", () => {
    const eph = moonEphemeris(2_448_724.5);
    expect(eph.lambda).toBeCloseTo(133.162655, 1);
    expect(Math.abs(eph.lambda - 133.162655)).toBeLessThan(0.02);
    expect(Math.abs(eph.beta - -3.229126)).toBeLessThan(0.02);
    expect(Math.abs(eph.distanceKm - 368_409.7)).toBeLessThan(50);
    expect(eph.parallax).toBeCloseTo(0.99199, 3);
  });

  it("distance stays within the lunar orbit's physical range", () => {
    for (let m = 0; m < 12; m++) {
      const eph = moonEphemeris(2_461_041.5 + m * 29.53);
      expect(eph.distanceKm).toBeGreaterThan(354_000);
      expect(eph.distanceKm).toBeLessThan(407_000);
    }
  });

  it("topocentric altitude sits below the geocentric one by ~parallax", () => {
    const pos = moonPosition(new Date("2026-06-21T08:15:00Z"), TOKYO);
    expect(pos.altitude).toBeLessThan(pos.geocentricAltitude);
    expect(pos.geocentricAltitude - pos.altitude).toBeLessThan(1.05);
    expect(pos.apparentAltitude).toBeGreaterThanOrEqual(pos.altitude);
  });

  it("rise/set threshold tracks parallax (~+0.13° at mean distance)", () => {
    const h0 = moonRiseSetThreshold(new Date("2026-06-21T00:00:00Z"));
    expect(h0).toBeGreaterThan(0);
    expect(h0).toBeLessThan(0.3);
  });
});

describe("moonDayEvents vs USNO fixtures", () => {
  const expectClose = (
    actual: Date | null,
    iso: string | null | undefined,
    label: string,
  ): void => {
    if (iso === undefined) return; // deliberately not asserted (borderline)
    if (iso === null) {
      expect(actual, label).toBeNull();
      return;
    }
    expect(actual, label).not.toBeNull();
    const diff = Math.abs((actual as Date).getTime() - Date.parse(iso)) / 1000;
    expect(diff, `${label}: off by ${diff.toFixed(1)}s`).toBeLessThanOrEqual(TOLERANCE_S);
  };

  for (const fx of USNO_MOON_FIXTURES) {
    it(fx.name, () => {
      const ev = moonDayEvents(new Date(fx.dayStartUtc), fx.loc);
      expect(ev.riseSet.kind).toBe(fx.kind);
      if (ev.riseSet.kind === "normal") {
        expectClose(ev.riseSet.rise, fx.rise, "moonrise");
        expectClose(ev.riseSet.set, fx.set, "moonset");
      }
      if (fx.transit !== null) {
        expect(ev.transit).not.toBeNull();
        const diff =
          Math.abs((ev.transit as { time: Date }).time.getTime() - Date.parse(fx.transit)) /
          1000;
        expect(diff, `transit off by ${diff.toFixed(1)}s`).toBeLessThanOrEqual(TOLERANCE_S);
      }
    });
  }

  it("July 2026 at Tokyo: exactly one skip day for rise and for set", () => {
    // The moon rises ~25–65 min later each day, so a 30-day span contains
    // exactly one day without a moonrise and one without a moonset, and
    // successive rises are one lunar day (24h20m–25h20m at Tokyo) apart.
    const rises: Date[] = [];
    let noRiseDays = 0;
    let noSetDays = 0;
    for (let d = 0; d < 30; d++) {
      const dayStart = new Date(Date.parse("2026-06-30T15:00:00Z") + d * 86_400_000);
      const ev = moonDayEvents(dayStart, TOKYO);
      expect(ev.riseSet.kind).toBe("normal");
      if (ev.riseSet.kind !== "normal") continue;
      if (ev.riseSet.rise === null) noRiseDays++;
      else rises.push(ev.riseSet.rise);
      if (ev.riseSet.set === null) noSetDays++;
    }
    expect(noRiseDays).toBe(1);
    expect(noSetDays).toBe(1);
    for (let i = 1; i < rises.length; i++) {
      const gapMin = (rises[i].getTime() - rises[i - 1].getTime()) / 60_000;
      expect(gapMin).toBeGreaterThan(24 * 60 + 20);
      expect(gapMin).toBeLessThan(25 * 60 + 20);
    }
  });

  it("Tromsø 2026-12-09: moon continuously below the horizon (USNO)", () => {
    // Near the new moon the moon shares the polar-night sun's low
    // declination; USNO reports "Object continuously below the Horizon".
    const ev = moonDayEvents(new Date("2026-12-08T23:00:00Z"), {
      lat: 69.6492,
      lng: 18.9553,
    });
    expect(ev.riseSet.kind).toBe("alwaysDown");
    expect(ev.transit).toBeNull();
  });

  it("geocentric altitude function agrees with moonPosition", () => {
    const d = new Date("2026-07-07T10:00:00Z");
    expect(moonGeocentricAltitude(d, TOKYO)).toBeCloseTo(
      moonPosition(d, TOKYO).geocentricAltitude,
      9,
    );
  });
});
