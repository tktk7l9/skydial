// GPS + persistence wrappers. Browser APIs are injected so the logic is
// fully testable in node (and the UI can pass the real ones).

import type { GeoLocation } from "../astro/types";
import { normalizeLocationName } from "./locationInput";

const STORAGE_KEY = "skydial:location";
const NAME_KEY = "skydial:location-name";

/** True for a finite lat/lng pair inside the valid ranges (the only shape that
 *  may reach persistence or the shareable URL). */
export function isValidLocation(v: unknown): v is GeoLocation {
  if (typeof v !== "object" || v === null) return false;
  const { lat, lng } = v as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

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
      (pos) => {
        // A provider is not trusted to hand back a usable pair: anything
        // non-finite or out of range is treated like a failed fix instead of
        // being persisted and written into the shareable URL.
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(isValidLocation(loc) ? loc : null);
      },
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
    // Only the two coordinates are copied out, so extra keys in tampered
    // storage never travel further.
    if (isValidLocation(v)) return { lat: v.lat, lng: v.lng };
  } catch {
    // fall through — corrupt storage is treated as absent
  }
  return null;
}

/** Forget the saved location (and its name), e.g. when undoing a first pick. */
export function clearSavedLocation(storage: Pick<Storage, "removeItem">): void {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(NAME_KEY);
}

/** Persist the user's name for the current location; null removes it. */
export function saveLocationName(
  storage: Pick<Storage, "setItem" | "removeItem">,
  name: string | null,
): void {
  if (name === null) storage.removeItem(NAME_KEY);
  else storage.setItem(NAME_KEY, name);
}

export function loadLocationName(storage: Pick<Storage, "getItem">): string | null {
  return storage.getItem(NAME_KEY);
}

/**
 * Name the current location ("Home"; blank clears it) and return the state
 * patch. A name is only reloaded together with a saved location, so naming
 * the default place adopts it as the user's own; otherwise the name would
 * silently vanish on the next launch.
 */
export function nameLocation(
  storage: StorageLike & Pick<Storage, "removeItem">,
  current: { location: GeoLocation; locationSource: "default" | "gps" | "manual" },
  raw: string,
): { locationName: string | null; locationSource: "default" | "gps" | "manual" } {
  const name = normalizeLocationName(raw);
  saveLocationName(storage, name);
  if (name !== null && current.locationSource === "default") {
    saveLocation(storage, current.location);
    return { locationName: name, locationSource: "manual" };
  }
  return { locationName: name, locationSource: current.locationSource };
}
