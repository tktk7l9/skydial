import { loadSavedLocation, requestLocation, saveLocation } from "./geolocation";

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
