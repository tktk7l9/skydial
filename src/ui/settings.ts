// Bottom-sheet settings: language, theme, map tiles, UTC offset, GPS.

import type { Locale, Theme, TileLayer } from "../state/appState";
import type { AppCtx } from "../app";
import { el } from "./dom";

const UTC_CHOICES: ReadonlyArray<number> = [-480, -300, 0, 60, 330, 480, 540, 600];

function offsetLabel(min: number): string {
  const sign = min < 0 ? "-" : "+";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}`;
}

export function openSettings(ctx: AppCtx): void {
  const s = ctx.store.get();

  const backdrop = el("div", { class: "sheet-backdrop", onclick: close });
  const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true" });

  function close(): void {
    backdrop.remove();
    sheet.remove();
  }

  function pills<T extends string | number>(
    current: T,
    choices: ReadonlyArray<{ value: T; label: string }>,
    apply: (v: T) => void,
  ): HTMLElement {
    const group = el("div", { class: "pillgroup" });
    for (const c of choices) {
      const pill = el(
        "button",
        {
          type: "button",
          class: `pill${c.value === current ? " active" : ""}`,
          onclick: () => {
            apply(c.value);
            close();
            openSettings(ctx); // rebuild with fresh state
          },
        },
        c.label,
      );
      group.append(pill);
    }
    return group;
  }

  function row(label: string, control: HTMLElement): HTMLElement {
    return el("div", { class: "setting-row" }, el("span", { class: "lbl" }, label), control);
  }

  sheet.append(
    el("h2", {}, ctx.tr("settings")),
    row(
      ctx.tr("language"),
      pills<Locale>(
        s.locale,
        [
          { value: "ja", label: "日本語" },
          { value: "en", label: "English" },
        ],
        (v) => ctx.setLocale(v),
      ),
    ),
    row(
      ctx.tr("theme"),
      pills<Theme>(
        s.theme,
        [
          { value: "auto", label: ctx.tr("themeAuto") },
          { value: "light", label: ctx.tr("themeLight") },
          { value: "dark", label: ctx.tr("themeDark") },
        ],
        (v) => ctx.setTheme(v),
      ),
    ),
    row(
      ctx.tr("mapTiles"),
      pills<TileLayer>(
        s.tiles,
        [
          { value: "osm", label: ctx.tr("tilesOsm") },
          { value: "gsi", label: ctx.tr("tilesGsi") },
        ],
        (v) => ctx.setTiles(v),
      ),
    ),
    row(
      ctx.tr("utcOffset"),
      pills<number>(
        s.utcOffsetMin ?? -1,
        [
          { value: -1, label: ctx.tr("utcOffsetDevice") },
          ...UTC_CHOICES.map((m) => ({ value: m, label: offsetLabel(m) })),
        ],
        (v) => ctx.store.set({ utcOffsetMin: v === -1 ? null : v }),
      ),
    ),
  );

  const gpsBtn = el(
    "button",
    {
      type: "button",
      class: "btn primary",
      onclick: () => {
        void ctx.requestGps().then(close);
      },
    },
    ctx.tr("useGps"),
  );
  const locLine = el(
    "div",
    { class: "setting-row" },
    el(
      "span",
      { class: "lbl" },
      `${ctx.tr("location")}: ${s.location.lat.toFixed(4)}, ${s.location.lng.toFixed(4)}` +
        (s.locationSource === "manual" ? ` (${ctx.tr("manualLocation")})` : ""),
    ),
    gpsBtn,
  );
  sheet.append(locLine, el("p", { class: "footnote" }, ctx.tr("accuracyNote")));

  document.body.append(backdrop, sheet);
}
