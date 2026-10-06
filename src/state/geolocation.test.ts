import {
  clearSavedLocation,
  isValidLocation,
  loadLocationName,
  loadSavedLocation,
  nameLocation,
  requestLocation,
  saveLocation,
  saveLocationName,
} from "./geolocation";

function memoryStorage(initial: Record<string, string> = {}): {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
} {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("geolocation", () => {
  it("resolves coordinates from the provider", async () => {
    const loc = await requestLocation({
      getCurrentPosition: (success) =>
        success({ coords: { latitude: 35.1, longitude: 139.2 } }),
    });
    expect(loc).toEqual({ lat: 35.1, lng: 139.2 });
  });

  it("resolves null on provider error (denied/timeout)", async () => {
    const loc = await requestLocation({
      getCurrentPosition: (_s, error) => error(new Error("denied")),
    });
    expect(loc).toBeNull();
  });

  it("resolves null when the API is missing entirely", async () => {
    expect(await requestLocation(undefined)).toBeNull();
  });

  it("treats a non-finite or out-of-range fix from the provider as a failure", async () => {
    for (const coords of [
      { latitude: Number.NaN, longitude: 139.2 },
      { latitude: 35.1, longitude: Number.POSITIVE_INFINITY },
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: -181 },
    ]) {
      const loc = await requestLocation({
        getCurrentPosition: (success) => success({ coords }),
      });
      expect(loc, JSON.stringify(coords)).toBeNull();
    }
  });

  it("isValidLocation accepts only finite in-range numeric pairs", () => {
    expect(isValidLocation({ lat: 90, lng: -180 })).toBe(true);
    expect(isValidLocation({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidLocation(null)).toBe(false);
    expect(isValidLocation("35,139")).toBe(false);
    expect(isValidLocation({ lat: "35", lng: 139 })).toBe(false);
    expect(isValidLocation({ lat: 35 })).toBe(false);
    expect(isValidLocation({ lat: Number.NaN, lng: 139 })).toBe(false);
    expect(isValidLocation({ lat: 90.0001, lng: 0 })).toBe(false);
    expect(isValidLocation({ lat: 0, lng: 180.0001 })).toBe(false);
  });

  it("load copies only lat/lng out of stored JSON (extra keys never travel further)", () => {
    const stored = '{"lat":35.1,"lng":139.2,"__proto__":{"polluted":1},"extra":"x"}';
    const loc = loadSavedLocation(memoryStorage({ "skydial:location": stored }));
    expect(loc).toEqual({ lat: 35.1, lng: 139.2 });
    expect(Object.keys(loc ?? {})).toEqual(["lat", "lng"]);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
    expect(loadSavedLocation(memoryStorage({ "skydial:location": "[35,139]" }))).toBeNull();
  });

  it("save/load round-trips through storage", () => {
    const storage = memoryStorage();
    saveLocation(storage, { lat: -33.8688, lng: 151.2093 });
    expect(loadSavedLocation(storage)).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it("load returns null for absent, corrupt or out-of-range data", () => {
    expect(loadSavedLocation(memoryStorage())).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "skydial:location": "not json{" })),
    ).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "skydial:location": '{"lat":999,"lng":0}' })),
    ).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "skydial:location": '{"lat":"35","lng":139}' })),
    ).toBeNull();
    expect(
      loadSavedLocation(memoryStorage({ "skydial:location": "null" })),
    ).toBeNull();
  });
});

describe("saved location extras", () => {
  function fullStorage(initial: Record<string, string> = {}): Pick<
    Storage,
    "getItem" | "setItem" | "removeItem"
  > {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
  }

  it("clearSavedLocation forgets the location and its name", () => {
    const storage = fullStorage();
    saveLocation(storage, { lat: 1, lng: 2 });
    saveLocationName(storage, "Home");
    clearSavedLocation(storage);
    expect(loadSavedLocation(storage)).toBeNull();
    expect(loadLocationName(storage)).toBeNull();
  });

  it("saves, loads and removes a location name", () => {
    const storage = fullStorage();
    expect(loadLocationName(storage)).toBeNull();
    saveLocationName(storage, "自宅");
    expect(loadLocationName(storage)).toBe("自宅");
    saveLocationName(storage, null);
    expect(loadLocationName(storage)).toBeNull();
  });
});

describe("nameLocation", () => {
  function fullStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
  }

  it("regression: naming the default place persists it so the name survives a reload", () => {
    const storage = fullStorage();
    const patch = nameLocation(
      storage,
      { location: { lat: 35.68, lng: 139.65 }, locationSource: "default" },
      "  実家 ",
    );
    expect(patch).toEqual({ locationName: "実家", locationSource: "manual" });
    expect(loadSavedLocation(storage)).toEqual({ lat: 35.68, lng: 139.65 });
    expect(loadLocationName(storage)).toBe("実家");
  });

  it("keeps the source of a chosen location and only stores the name", () => {
    const storage = fullStorage();
    const patch = nameLocation(storage, { location: { lat: 1, lng: 2 }, locationSource: "gps" }, "Home");
    expect(patch).toEqual({ locationName: "Home", locationSource: "gps" });
    expect(loadSavedLocation(storage)).toBeNull();
    expect(loadLocationName(storage)).toBe("Home");
  });

  it("clears the name on a blank entry without adopting the default place", () => {
    const storage = fullStorage();
    saveLocationName(storage, "Old");
    const patch = nameLocation(
      storage,
      { location: { lat: 1, lng: 2 }, locationSource: "default" },
      "   ",
    );
    expect(patch).toEqual({ locationName: null, locationSource: "default" });
    expect(loadSavedLocation(storage)).toBeNull();
    expect(loadLocationName(storage)).toBeNull();
  });
});
