import { defaultState } from "./appState";
import { decodeUrlState, encodeUrlState } from "./urlState";

describe("urlState", () => {
  it("all-default state encodes to an empty string", () => {
    expect(encodeUrlState(defaultState("ja"))).toBe("");
  });

  it("round-trips location, time, tab and utc offset", () => {
    const state = {
      ...defaultState("en"),
      location: { lat: 51.5074, lng: -0.1278 },
      time: new Date("2026-07-07T09:30:00Z"),
      tab: "dome" as const,
      utcOffsetMin: 60,
    };
    const q = encodeUrlState(state);
    expect(q.startsWith("?")).toBe(true);
    const decoded = decodeUrlState(q);
    expect(decoded.location).toEqual({ lat: 51.5074, lng: -0.1278 });
    expect(decoded.time?.getTime()).toBe(Date.parse("2026-07-07T09:30:00Z"));
    expect(decoded.tab).toBe("dome");
    expect(decoded.utcOffsetMin).toBe(60);
  });

  it("time is encoded to minute precision", () => {
    const state = { ...defaultState("en"), time: new Date("2026-07-07T09:30:45.123Z") };
    const q = encodeUrlState(state);
    expect(q).toContain("t=2026-07-07T09%3A30Z");
    expect(decodeUrlState(q).time?.toISOString()).toBe("2026-07-07T09:30:00.000Z");
  });

  it("coordinates are rounded to 4 decimals and defaults omitted", () => {
    const q = encodeUrlState({
      ...defaultState("ja"),
      location: { lat: 35.12345678, lng: 139.98765432 },
    });
    const params = new URLSearchParams(q.slice(1));
    expect(params.get("lat")).toBe("35.1235");
    expect(params.get("lng")).toBe("139.9877");
    expect(params.has("tab")).toBe(false);
    expect(params.has("t")).toBe(false);
  });

  it("decode drops invalid values instead of failing", () => {
    const d = decodeUrlState("?lat=999&lng=10&t=not-a-date&tab=bogus&lang=fr&utc=1e3");
    expect(d.location).toBeUndefined(); // |lat| > 90
    expect(d.time).toBeUndefined();
    expect(d.tab).toBeUndefined();
    expect(d.locale).toBeUndefined();
    expect(d.utcOffsetMin).toBeUndefined();
  });

  it("decode requires both lat and lng", () => {
    expect(decodeUrlState("?lat=35").location).toBeUndefined();
    expect(decodeUrlState("lng=139").location).toBeUndefined(); // also without ?
  });

  it("decode accepts an explicit ?lang= for shared links", () => {
    expect(decodeUrlState("?lang=en").locale).toBe("en");
    expect(decodeUrlState("?lang=ja").locale).toBe("ja");
  });

  it("utc offset must be an integer within ±14h", () => {
    expect(decodeUrlState("?utc=540").utcOffsetMin).toBe(540);
    expect(decodeUrlState("?utc=-720").utcOffsetMin).toBe(-720);
    expect(decodeUrlState("?utc=900").utcOffsetMin).toBeUndefined();
    expect(decodeUrlState("?utc=1.5").utcOffsetMin).toBeUndefined();
  });
});
