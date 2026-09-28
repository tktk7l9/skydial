import {
  clearSavedLocation,
  loadLocationName,
  loadSavedLocation,
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
