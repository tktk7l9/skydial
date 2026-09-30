// Map view: sun/moon direction rays and sunrise/sunset bearings over
// OSM / GSI tiles. Loaded lazily — Leaflet stays out of the initial bundle.

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { moonDayEvents, sunDayEvents } from "../../astro/events";
import type { MoonDayEvents } from "../../astro/events";
import { moonPosition } from "../../astro/lunar";
import { sunPosition } from "../../astro/solar";
import type { GeoLocation } from "../../astro/types";
import { dayStartFor } from "../../state/dayWindow";
import type { AppState, TileLayer } from "../../state/appState";
import type { AppCtx, View } from "../../app";
import { locationSnapshot } from "../../state/appState";
import { parseLatLng } from "../../state/locationInput";
import { el } from "../../ui/dom";
import { showToast } from "../../ui/toast";
import { rayLine } from "./rays";

const RAY_KM = 150;
const COLORS = {
  sun: "#ffb347",
  moon: "#dfe6fb",
  sunrise: "#ff8c42",
  sunset: "#b06ae8",
  moonrise: "#9fb4ec",
  moonset: "#6f82c9",
};

const TILE_DEFS: Record<TileLayer, { url: string; attribution: string }> = {
  osm: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  gsi: {
    url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
  },
};

const PIN_SVG =
  '<svg viewBox="0 0 32 32" width="32" height="32"><path d="M16 30S6 21.6 6 13.8A10 10 0 0 1 16 4a10 10 0 0 1 10 9.8C26 21.6 16 30 16 30z" fill="#ffb347" stroke="#1a2142" stroke-width="2"/><circle cx="16" cy="13.6" r="3.6" fill="#1a2142"/></svg>';

export function createMapView(ctx: AppCtx): View {
  // A named region: a bare div may not carry aria-label (axe
  // aria-prohibited-attr), and Leaflet makes the host focusable.
  const host = el("div", {
    class: "leaflet-host",
    role: "region",
    "aria-label": ctx.tr("tapMapToSet"),
  });
  const legend = el("div", { class: "legend" });
  // Coordinates can be typed or pasted in any common spelling (SHIG 50, 51).
  // Place-name search would need an external geocoder, which the strict CSP
  // deliberately does not allow, so this starts with coordinates only.
  const coordInput = el("input", {
    type: "text",
    class: "num-input coord-input",
    inputmode: "decimal",
    autocomplete: "off",
    placeholder: ctx.tr("coordInputPlaceholder"),
    "aria-label": ctx.tr("coordInputLabel"),
  }) as HTMLInputElement;
  const coordError = el("p", { class: "coord-error", role: "status", "aria-live": "polite" });
  coordError.hidden = true;
  const coordForm = el(
    "form",
    {
      class: "coord-form",
      onsubmit: (ev: Event) => {
        ev.preventDefault();
        const loc = parseLatLng(coordInput.value);
        if (loc === null) {
          coordError.textContent = ctx.tr("coordInvalid");
          coordError.hidden = false;
          coordInput.setAttribute("aria-invalid", "true");
          return;
        }
        coordError.hidden = true;
        coordInput.removeAttribute("aria-invalid");
        coordInput.value = "";
        moveWithUndo(loc);
      },
    },
    coordError,
    el(
      "div",
      { class: "coord-row" },
      coordInput,
      el("button", { type: "submit", class: "btn primary" }, ctx.tr("coordGo")),
    ),
  );
  const root = el("div", { class: "view-fill" }, host, legend, coordForm);

  /** Move the location right away; a stray tap is one "Undo" away (15, 54, 57). */
  function moveWithUndo(loc: GeoLocation): void {
    const before = locationSnapshot(ctx.store.get());
    ctx.setLocation(loc, "manual");
    showToast({
      message: ctx.tr("locationChanged"),
      actionLabel: ctx.tr("undo"),
      onAction: () => ctx.restoreLocation(before),
    });
  }

  const item = (color: string, label: string): HTMLElement => {
    const sw = el("span", { class: "sw" });
    sw.style.background = color;
    return el("div", { class: "li" }, sw, el("span", {}, label));
  };
  legend.append(
    item(COLORS.sun, ctx.tr("sunDirection")),
    item(COLORS.moon, ctx.tr("moonDirection")),
    item(COLORS.sunrise, ctx.tr("sunriseDirection")),
    item(COLORS.sunset, ctx.tr("sunsetDirection")),
    item(COLORS.moonrise, ctx.tr("moonriseDirection")),
    item(COLORS.moonset, ctx.tr("moonsetDirection")),
    el("div", { class: "li" }, el("span", {}, ctx.tr("tapMapToSet"))),
  );

  const map = L.map(host, { zoomControl: false, attributionControl: true });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  let tileLayer: L.TileLayer | null = null;
  let tileKind: TileLayer | null = null;

  const marker = L.marker([0, 0], {
    icon: L.divIcon({ html: PIN_SVG, className: "", iconSize: [32, 32], iconAnchor: [16, 30] }),
    keyboard: false,
  }).addTo(map);

  const mkLine = (color: string, dashed = false): L.Polyline =>
    L.polyline([], {
      color,
      weight: 3,
      opacity: 0.9,
      dashArray: dashed ? "6 6" : undefined,
      interactive: false,
    }).addTo(map);
  const sunRay = mkLine(COLORS.sun);
  const moonRay = mkLine(COLORS.moon);
  const sunriseRay = mkLine(COLORS.sunrise, true);
  const sunsetRay = mkLine(COLORS.sunset, true);
  const moonriseRay = mkLine(COLORS.moonrise, true);
  const moonsetRay = mkLine(COLORS.moonset, true);

  map.on("click", (ev: L.LeafletMouseEvent) => {
    moveWithUndo({ lat: ev.latlng.lat, lng: ev.latlng.lng });
  });

  const observer = new ResizeObserver(() => map.invalidateSize());
  observer.observe(root);

  let centeredKey = "";
  let eventsKey = "";
  let cachedEvents: ReturnType<typeof sunDayEvents> | null = null;
  let cachedMoonEvents: MoonDayEvents | null = null;

  return {
    root,
    update(s: AppState, time: Date) {
      if (tileKind !== s.tiles) {
        tileKind = s.tiles;
        if (tileLayer !== null) tileLayer.remove();
        const def = TILE_DEFS[s.tiles];
        tileLayer = L.tileLayer(def.url, { attribution: def.attribution, maxZoom: 18 }).addTo(
          map,
        );
      }

      const loc = s.location;
      const locKey = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
      if (centeredKey !== locKey) {
        const first = centeredKey === "";
        centeredKey = locKey;
        map.setView([loc.lat, loc.lng], first ? 11 : map.getZoom());
      }
      marker.setLatLng([loc.lat, loc.lng]);

      const sun = sunPosition(time, loc);
      const moon = moonPosition(time, loc);
      sunRay.setLatLngs(sun.altitude > -0.834 ? rayLine(loc, sun.azimuth, RAY_KM) : []);
      moonRay.setLatLngs(moon.altitude > 0 ? rayLine(loc, moon.azimuth, RAY_KM * 0.75) : []);

      const dayStart = dayStartFor(time, s.utcOffsetMin);
      const evKey = `${dayStart.getTime()}:${locKey}`;
      if (eventsKey !== evKey) {
        eventsKey = evKey;
        cachedEvents = sunDayEvents(dayStart, loc);
        cachedMoonEvents = moonDayEvents(dayStart, loc);
      }
      const rs = cachedEvents?.riseSet;
      if (rs !== undefined && rs.kind === "normal") {
        sunriseRay.setLatLngs(
          rs.rise !== null ? rayLine(loc, sunPosition(rs.rise, loc).azimuth, RAY_KM) : [],
        );
        sunsetRay.setLatLngs(
          rs.set !== null ? rayLine(loc, sunPosition(rs.set, loc).azimuth, RAY_KM) : [],
        );
      } else {
        sunriseRay.setLatLngs([]);
        sunsetRay.setLatLngs([]);
      }
      const mrs = cachedMoonEvents?.riseSet;
      if (mrs !== undefined && mrs.kind === "normal") {
        moonriseRay.setLatLngs(
          mrs.rise !== null
            ? rayLine(loc, moonPosition(mrs.rise, loc).azimuth, RAY_KM * 0.75)
            : [],
        );
        moonsetRay.setLatLngs(
          mrs.set !== null
            ? rayLine(loc, moonPosition(mrs.set, loc).azimuth, RAY_KM * 0.75)
            : [],
        );
      } else {
        moonriseRay.setLatLngs([]);
        moonsetRay.setLatLngs([]);
      }
    },
    destroy() {
      observer.disconnect();
      map.remove();
    },
  };
}
