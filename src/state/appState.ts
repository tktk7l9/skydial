// Single app-wide store with a subscribe/notify contract. The UI re-renders
// from snapshots; views subscribe to the slices they care about.

import type { GeoLocation } from "../astro/types";
import type { HouseModel } from "../sunsim/house";

export type Tab = "dashboard" | "dome" | "map" | "ar";
export type Theme = "auto" | "light" | "dark";
export type Locale = "ja" | "en";
export type TileLayer = "osm" | "gsi";

export interface AppState {
  location: GeoLocation;
  locationSource: "default" | "gps" | "manual";
  /** Selected instant; null = live ("now", ticking). */
  time: Date | null;
  tab: Tab;
  locale: Locale;
  theme: Theme;
  tiles: TileLayer;
  /** Manual UTC offset in minutes for remote locations; null = device tz. */
  utcOffsetMin: number | null;
  /** Parametric house for the insolation study; null = feature off. */
  house: HouseModel | null;
}

/** Tokyo — a sensible default until GPS or a manual pick lands. */
export const DEFAULT_LOCATION: GeoLocation = { lat: 35.6762, lng: 139.6503 };

export function defaultState(locale: Locale): AppState {
  return {
    location: DEFAULT_LOCATION,
    locationSource: "default",
    time: null,
    tab: "dashboard",
    locale,
    theme: "auto",
    tiles: "osm",
    utcOffsetMin: null,
    house: null,
  };
}

export type Listener = (state: AppState) => void;

export interface Store {
  get(): AppState;
  set(patch: Partial<AppState>): void;
  subscribe(fn: Listener): () => void;
}

export function createStore(initial: AppState): Store {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...patch };
      for (const fn of listeners) fn(state);
    },
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** The instant the app should render: the scrubbed time, or live now. */
export function effectiveTime(state: AppState, now: () => Date = () => new Date()): Date {
  return state.time ?? now();
}
