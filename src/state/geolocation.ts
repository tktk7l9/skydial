// GPS + persistence wrappers. Browser APIs are injected so the logic is
// fully testable in node (and the UI can pass the real ones).

import type { GeoLocation } from "../astro/types";

const STORAGE_KEY = "skydial:location";

export interface GeoProviderLike {
  getCurrentPosition(
    success: (pos: { coords: { latitude: number; longitude: number } }) => void,
    error: (err: unknown) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ): void;
}

/** Resolve the device location, or null on denial/timeout/absence. */
export function requestLocation(
  geo: GeoProviderLike | undefined,
  timeoutMs = 10_000,
): Promise<GeoLocation | null> {
  if (!geo) return Promise.resolve(null);
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 300_000 },
    );
  });
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function saveLocation(storage: StorageLike, loc: GeoLocation): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(loc));
}

export function loadSavedLocation(storage: Pick<Storage, "getItem">): GeoLocation | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as { lat?: unknown }).lat === "number" &&
      typeof (v as { lng?: unknown }).lng === "number" &&
      Math.abs((v as { lat: number }).lat) <= 90 &&
      Math.abs((v as { lng: number }).lng) <= 180
    ) {
      return { lat: (v as { lat: number }).lat, lng: (v as { lng: number }).lng };
    }
  } catch {
    // fall through — corrupt storage is treated as absent
  }
  return null;
}
