// App wiring: state store, URL sync, theme/locale binding, tab routing with
// lazy view loading, and the 1 Hz live ticker.

import { sunPosition } from "./astro/solar";
import {
  createStore,
  defaultState,
  effectiveTime,
} from "./state/appState";
import type { AppState, Locale, Store, Tab, Theme, TileLayer } from "./state/appState";
import { loadSavedLocation, requestLocation, saveLocation } from "./state/geolocation";
import { decodeUrlState, encodeUrlState } from "./state/urlState";
import {
  detectLocale,
  directionKey,
  formatDate,
  formatDeg,
  formatDuration,
  formatPercent,
  formatTime,
  phaseNameKey,
  t,
} from "./i18n";
import type { MsgKey } from "./i18n/keys";
import type { MoonPhaseName } from "./astro/moonphase";
import { clear, el } from "./ui/dom";
import { svgIcon } from "./ui/icons";
import { applySkyGradient } from "./ui/skyGradient";
import { createDashboard } from "./ui/dashboard";
import { createScrubber } from "./ui/scrubber";
import { createTabbar } from "./ui/tabs";
import { openSettings } from "./ui/settings";

export interface View {
  root: HTMLElement;
  update(state: AppState, time: Date): void;
  destroy?(): void;
}

export interface AppCtx {
  store: Store;
  tr(key: MsgKey, params?: Record<string, string | number>): string;
  trDir(azimuth: number): string;
  phaseKey(name: MoonPhaseName): MsgKey;
  fmtTime(d: Date, withSeconds?: boolean): string;
  fmtDate(d: Date): string;
  fmtDeg(v: number): string;
  fmtDur(ms: number): string;
  fmtPct(v: number): string;
  setLocale(l: Locale): void;
  setTheme(t: Theme): void;
  setTiles(t: TileLayer): void;
  requestGps(): Promise<void>;
}

const LS = {
  locale: "skydial:locale",
  theme: "skydial:theme",
  tiles: "skydial:tiles",
};

export function startApp(root: HTMLElement): void {
  // ----- Initial state: defaults ← localStorage ← URL -----
  const locale = detectLocale(navigator.language, localStorage.getItem(LS.locale));
  const initial: AppState = { ...defaultState(locale) };
  const storedTheme = localStorage.getItem(LS.theme);
  if (storedTheme === "light" || storedTheme === "dark") initial.theme = storedTheme;
  const storedTiles = localStorage.getItem(LS.tiles);
  if (storedTiles === "gsi") initial.tiles = "gsi";
  const saved = loadSavedLocation(localStorage);
  if (saved !== null) {
    initial.location = saved;
    initial.locationSource = "manual";
  }
  const fromUrl = decodeUrlState(location.search);
  if (fromUrl.location) {
    initial.location = fromUrl.location;
    initial.locationSource = "manual";
  }
  if (fromUrl.time !== undefined) initial.time = fromUrl.time;
  if (fromUrl.tab !== undefined) initial.tab = fromUrl.tab;
  if (fromUrl.locale !== undefined) initial.locale = fromUrl.locale;
  if (fromUrl.utcOffsetMin !== undefined) initial.utcOffsetMin = fromUrl.utcOffsetMin;

  const store = createStore(initial);

  // ----- Context -----
  const ctx: AppCtx = {
    store,
    tr: (key, params) => t(store.get().locale, key, params),
    trDir: (az) => t(store.get().locale, directionKey(az)),
    phaseKey: phaseNameKey,
    fmtTime: (d, withSeconds) =>
      formatTime(d, store.get().locale, store.get().utcOffsetMin, withSeconds),
    fmtDate: (d) => formatDate(d, store.get().locale, store.get().utcOffsetMin),
    fmtDeg: (v) => formatDeg(v, store.get().locale),
    fmtDur: (ms) => formatDuration(ms, store.get().locale),
    fmtPct: (v) => formatPercent(v, store.get().locale),
    setLocale: (l) => {
      localStorage.setItem(LS.locale, l);
      store.set({ locale: l });
    },
    setTheme: (v) => {
      localStorage.setItem(LS.theme, v);
      store.set({ theme: v });
    },
    setTiles: (v) => {
      localStorage.setItem(LS.tiles, v);
      store.set({ tiles: v });
    },
    requestGps: async () => {
      const loc = await requestLocation(navigator.geolocation);
      if (loc !== null) {
        saveLocation(localStorage, loc);
        store.set({ location: loc, locationSource: "gps" });
      }
    },
  };

  // ----- Theme -----
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = (): void => {
    const { theme } = store.get();
    const dark = theme === "auto" ? darkQuery.matches : theme === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };
  darkQuery.addEventListener("change", applyTheme);

  // ----- Shell -----
  const locChip = el("button", { type: "button", class: "loc-chip", onclick: () => openSettings(ctx) });
  const gearBtn = el("button", {
    type: "button",
    class: "icon-btn",
    "aria-label": "settings",
    onclick: () => openSettings(ctx),
  });
  gearBtn.innerHTML = svgIcon("gear");
  const topbar = el(
    "header",
    { class: "topbar" },
    el("span", { class: "brand" }, "Skydial"),
    locChip,
    gearBtn,
  );
  const content = el("main", { class: "content" });
  let scrubber = createScrubber(ctx);
  let tabbar = createTabbar(ctx);
  clear(root);
  root.append(topbar, content, scrubber.root, tabbar.root);

  // ----- Views (dashboard eager, the rest lazy) -----
  const views = new Map<Tab, View>();
  views.set("dashboard", createDashboard(ctx));
  const loaders: Record<Exclude<Tab, "dashboard">, () => Promise<View>> = {
    dome: () => import("./views/dome/index.js").then((m) => m.createDomeView(ctx)),
    map: () => import("./views/map/index.js").then((m) => m.createMapView(ctx)),
    ar: () => import("./views/ar/index.js").then((m) => m.createArView(ctx)),
  };
  let loadingTab: Tab | null = null;

  function mountView(view: View, s: AppState): void {
    clear(content);
    content.classList.toggle("wide", s.tab !== "dashboard");
    content.append(view.root);
    view.update(s, effectiveTime(s));
  }

  function showTab(s: AppState): void {
    const existing = views.get(s.tab);
    if (existing) {
      mountView(existing, s);
      return;
    }
    if (s.tab === "dashboard" || loadingTab === s.tab) return;
    loadingTab = s.tab;
    const tab = s.tab;
    void loaders[tab]().then((view) => {
      loadingTab = null;
      views.set(tab, view);
      if (store.get().tab === tab) mountView(view, store.get());
    });
  }

  // ----- Rendering -----
  let mountedTab: Tab | null = null;
  let lastLocale: Locale = initial.locale;

  function renderAll(s: AppState): void {
    document.documentElement.lang = s.locale;
    applyTheme();
    const time = effectiveTime(s);
    applySkyGradient(sunPosition(time, s.location).altitude);
    locChip.textContent = `${s.location.lat.toFixed(2)}, ${s.location.lng.toFixed(2)}`;
    scrubber.update(s);
    tabbar.update(s);
    views.get(s.tab)?.update(s, time);
  }

  store.subscribe((s) => {
    if (s.locale !== lastLocale) {
      // Locale switch: rebuild chrome and drop cached views so every string
      // re-renders; lazy views re-import instantly from the module cache.
      lastLocale = s.locale;
      for (const view of views.values()) view.destroy?.();
      views.clear();
      views.set("dashboard", createDashboard(ctx));
      const freshScrubber = createScrubber(ctx);
      scrubber.root.replaceWith(freshScrubber.root);
      scrubber = freshScrubber;
      const freshTabbar = createTabbar(ctx);
      tabbar.root.replaceWith(freshTabbar.root);
      tabbar = freshTabbar;
      mountedTab = null;
    }
    if (s.tab !== mountedTab) {
      mountedTab = s.tab;
      showTab(s);
    }
    renderAll(s);
    syncUrl(s);
  });

  // ----- URL sync (debounced replaceState) -----
  let urlTimer: number | undefined;
  function syncUrl(s: AppState): void {
    clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      const q = encodeUrlState(s);
      history.replaceState(null, "", q === "" ? location.pathname : q);
    }, 300);
  }

  // ----- Live ticker (1 Hz while live and visible) -----
  window.setInterval(() => {
    const s = store.get();
    if (s.time !== null || document.hidden) return;
    renderAll(s);
  }, 1000);

  // ----- First paint -----
  mountedTab = initial.tab;
  showTab(initial);
  renderAll(initial);
  syncUrl(initial);
}
