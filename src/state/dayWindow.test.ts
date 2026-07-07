import { dayFraction, dayStartFor } from "./dayWindow";

describe("dayWindow", () => {
  it("manual offset: midnight of the shifted calendar day", () => {
    // 2026-07-07T10:00Z at UTC+9 is 19:00 on Jul 7 → day starts 2026-07-06T15:00Z.
    const start = dayStartFor(new Date("2026-07-07T10:00:00Z"), 540);
    expect(start.toISOString()).toBe("2026-07-06T15:00:00.000Z");
    // Just before that local midnight belongs to the previous day.
    const before = dayStartFor(new Date("2026-07-06T14:59:59Z"), 540);
    expect(before.toISOString()).toBe("2026-07-05T15:00:00.000Z");
  });

  it("negative offsets shift the other way", () => {
    // 2026-07-07T02:00Z at UTC-5 is 21:00 on Jul 6 → day starts Jul 6 05:00Z.
    const start = dayStartFor(new Date("2026-07-07T02:00:00Z"), -300);
    expect(start.toISOString()).toBe("2026-07-06T05:00:00.000Z");
  });

  it("UTC offset 0 truncates to the UTC day", () => {
    const start = dayStartFor(new Date("2026-07-07T23:59:59Z"), 0);
    expect(start.toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });

  it("device timezone: midnight local, window covers the instant", () => {
    const instant = new Date("2026-07-07T10:00:00Z");
    const start = dayStartFor(instant, null);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(instant.getTime() - start.getTime()).toBeGreaterThanOrEqual(0);
    expect(instant.getTime() - start.getTime()).toBeLessThan(86_400_000);
  });

  it("dayFraction is 0 at midnight and ~0.5 at local noon", () => {
    expect(dayFraction(new Date("2026-07-06T15:00:00Z"), 540)).toBe(0);
    expect(dayFraction(new Date("2026-07-07T03:00:00Z"), 540)).toBeCloseTo(0.5, 9);
    expect(dayFraction(new Date("2026-07-07T14:59:00Z"), 540)).toBeLessThan(1);
  });
});
