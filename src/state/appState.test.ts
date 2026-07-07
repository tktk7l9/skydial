import { DEFAULT_LOCATION, createStore, defaultState, effectiveTime } from "./appState";

describe("appState", () => {
  it("defaultState starts live at the default location", () => {
    const s = defaultState("ja");
    expect(s.location).toEqual(DEFAULT_LOCATION);
    expect(s.time).toBeNull();
    expect(s.tab).toBe("dashboard");
    expect(s.locale).toBe("ja");
    expect(s.theme).toBe("auto");
    expect(s.utcOffsetMin).toBeNull();
  });

  it("set patches state and notifies subscribers", () => {
    const store = createStore(defaultState("en"));
    const seen: string[] = [];
    const unsub = store.subscribe((s) => seen.push(s.tab));
    store.set({ tab: "dome" });
    store.set({ tab: "map" });
    expect(seen).toEqual(["dome", "map"]);
    expect(store.get().tab).toBe("map");
    expect(store.get().locale).toBe("en"); // untouched fields survive

    unsub();
    store.set({ tab: "ar" });
    expect(seen).toEqual(["dome", "map"]); // no longer notified
  });

  it("effectiveTime returns the scrubbed instant, or now when live", () => {
    const store = createStore(defaultState("en"));
    const fixed = new Date("2026-07-07T00:00:00Z");
    expect(effectiveTime(store.get(), () => fixed)).toBe(fixed);
    const scrubbed = new Date("2026-01-01T00:00:00Z");
    store.set({ time: scrubbed });
    expect(effectiveTime(store.get(), () => fixed)).toBe(scrubbed);
  });

  it("effectiveTime defaults to the real clock", () => {
    const before = Date.now();
    const t = effectiveTime(defaultState("en")).getTime();
    expect(Math.abs(t - before)).toBeLessThan(5000);
  });
});
