// URL query persistence: pure encode/decode so a view (location, instant,
// tab) can be shared as a link. Defaults are omitted to keep URLs clean.

import type { AppState, Locale, Tab } from "./appState";
import { DEFAULT_LOCATION } from "./appState";
import { decodeHouse, encodeHouse } from "../sunsim/houseCodec";

const TABS: readonly Tab[] = ["dashboard", "dome", "map", "ar"];
const LOCALES: readonly Locale[] = ["ja", "en"];

/** Fields that travel in the URL (theme/tiles are device preferences). */
export type UrlState = Partial<
  Pick<AppState, "location" | "time" | "tab" | "locale" | "utcOffsetMin" | "house">
>;

function roundCoord(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

/** Serialize to a query string ("" when everything is at its default). */
export function encodeUrlState(state: AppState): string {
  const q = new URLSearchParams();
  const lat = roundCoord(state.location.lat);
  const lng = roundCoord(state.location.lng);
  if (lat !== DEFAULT_LOCATION.lat || lng !== DEFAULT_LOCATION.lng) {
    q.set("lat", String(lat));
    q.set("lng", String(lng));
  }
  if (state.time !== null) {
    // Minute precision keeps links tidy; seconds add nothing for sharing.
    q.set("t", state.time.toISOString().slice(0, 16) + "Z");
  }
  if (state.tab !== "dashboard") q.set("tab", state.tab);
  // locale is a device preference and is not emitted — but incoming links
  // may carry ?lang= to open the app in a specific language (see decode).
  if (state.utcOffsetMin !== null) q.set("utc", String(state.utcOffsetMin));
  if (state.house !== null) q.set("house", encodeHouse(state.house));
  const s = q.toString();
  return s === "" ? "" : `?${s}`;
}

/** Parse a query string; invalid values are dropped, not errors. */
export function decodeUrlState(query: string): UrlState {
  const q = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const out: UrlState = {};

  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  if (
    q.has("lat") &&
    q.has("lng") &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    out.location = { lat, lng };
  }

  const t = q.get("t");
  if (t !== null) {
    const ms = Date.parse(t);
    if (Number.isFinite(ms)) out.time = new Date(ms);
  }

  const tab = q.get("tab");
  if (tab !== null && (TABS as readonly string[]).includes(tab)) out.tab = tab as Tab;

  const lang = q.get("lang");
  if (lang !== null && (LOCALES as readonly string[]).includes(lang)) {
    out.locale = lang as Locale;
  }

  const utc = Number(q.get("utc"));
  if (q.has("utc") && Number.isInteger(utc) && Math.abs(utc) <= 14 * 60) {
    out.utcOffsetMin = utc;
  }

  const house = q.get("house");
  if (house !== null) {
    const decoded = decodeHouse(house);
    if (decoded !== null) out.house = decoded;
  }

  return out;
}
