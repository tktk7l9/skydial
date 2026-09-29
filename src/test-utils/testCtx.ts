// A real AppCtx for component tests: the same store, i18n and formatting as
// the app, with the side-effecting actions recorded instead of persisted.

import type { AppCtx } from "../app";
import { createStore, defaultState } from "../state/appState";
import type { AppState } from "../state/appState";
import {
  directionKey,
  formatDate,
  formatDeg,
  formatDuration,
  formatPercent,
  formatShortDate,
  formatTime,
  phaseNameKey,
  t,
} from "../i18n";

export function createTestCtx(
  patch: Partial<AppState> = {},
  overrides: Partial<AppCtx> = {},
): AppCtx {
  const store = createStore({ ...defaultState("ja"), ...patch });
  const ctx: AppCtx = {
    store,
    tr: (key, params) => t(store.get().locale, key, params),
    trDir: (az) => t(store.get().locale, directionKey(az)),
    phaseKey: phaseNameKey,
    fmtTime: (d, withSeconds) =>
      formatTime(d, store.get().locale, store.get().utcOffsetMin, withSeconds),
    fmtDate: (d) => formatDate(d, store.get().locale, store.get().utcOffsetMin),
    fmtShortDate: (d) => formatShortDate(d, store.get().locale, store.get().utcOffsetMin),
    fmtDeg: (v) => formatDeg(v, store.get().locale),
    fmtDur: (ms) => formatDuration(ms, store.get().locale),
    fmtPct: (v) => formatPercent(v, store.get().locale),
    setLocale: (l) => store.set({ locale: l }),
    setTheme: (v) => store.set({ theme: v }),
    setTiles: (v) => store.set({ tiles: v }),
    setLocation: (loc, source) =>
      store.set({ location: loc, locationSource: source, locationName: null }),
    restoreLocation: (snap) => store.set({ ...snap }),
    setLocationName: (raw) => store.set({ locationName: raw.trim() === "" ? null : raw.trim() }),
    setHouse: (house) => store.set({ house }),
    toggleHouse: () => undefined,
    requestGps: () => Promise.resolve(false),
    ...overrides,
  };
  return ctx;
}
