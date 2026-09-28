// Lenient parsers for location input typed or pasted by the user. Full-width
// digits and punctuation, Unicode minus signs and brackets are normalized
// instead of rejected (SHIG 50, 46).

import type { GeoLocation } from "../astro/types";

const NAME_MAX = 24;

/** Parse "lat, lng" in any common spelling, or null when it is not one. */
export function parseLatLng(input: string): GeoLocation | null {
  const text = input
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/[、，]/g, ",")
    .replace(/[()[\]]/g, " ")
    .trim();
  const parts = text.split(/\s*,\s*|\s+/).filter((p) => p !== "");
  if (parts.length !== 2) return null;
  const [lat, lng] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Trim/collapse a user-given place name; null when nothing is left. */
export function normalizeLocationName(raw: string): string | null {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name === "") return null;
  return Array.from(name).slice(0, NAME_MAX).join("");
}
