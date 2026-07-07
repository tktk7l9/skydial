import { autoUtcOffsetMin, deviceUtcOffsetMin, estimateUtcOffsetMin } from "./tzEstimate";

describe("estimateUtcOffsetMin", () => {
  it("maps longitudes to nautical hour offsets", () => {
    expect(estimateUtcOffsetMin(139.65)).toBe(540); // Tokyo → +9
    expect(estimateUtcOffsetMin(-0.13)).toBe(0); // London → 0
    expect(estimateUtcOffsetMin(151.21)).toBe(600); // Sydney → +10 (AEST)
    expect(estimateUtcOffsetMin(-74.01)).toBe(-300); // New York → -5
    expect(estimateUtcOffsetMin(-118.24)).toBe(-480); // LA → -8
    expect(estimateUtcOffsetMin(180)).toBe(720);
    expect(estimateUtcOffsetMin(-180)).toBe(-720);
  });
});

describe("autoUtcOffsetMin", () => {
  const JST = 540;

  it("applies the estimate for clearly remote locations", () => {
    expect(autoUtcOffsetMin(-0.13, JST)).toBe(0); // London from Japan
    expect(autoUtcOffsetMin(-74.01, JST)).toBe(-300); // New York from Japan
    expect(autoUtcOffsetMin(18.96, JST)).toBe(60); // Tromsø from Japan
  });

  it("keeps the device timezone within ±90 min (same-region taps)", () => {
    expect(autoUtcOffsetMin(139.65, JST)).toBeNull(); // Tokyo
    expect(autoUtcOffsetMin(124.15, JST)).toBeNull(); // Ishigaki (estimate +8, legal +9)
    expect(autoUtcOffsetMin(151.21, JST)).toBeNull(); // Sydney +10 est: 60min diff → device
  });

  it("works from other device zones too", () => {
    expect(autoUtcOffsetMin(139.65, 0)).toBe(540); // Tokyo from London
    expect(autoUtcOffsetMin(2.35, 60)).toBeNull(); // Paris from CET
  });
});

describe("deviceUtcOffsetMin", () => {
  it("matches the negated getTimezoneOffset of the given date", () => {
    const d = new Date("2026-07-08T00:00:00Z");
    expect(deviceUtcOffsetMin(d)).toBe(-d.getTimezoneOffset());
    expect(typeof deviceUtcOffsetMin()).toBe("number");
  });
});
