// Bottom-sheet settings: language, theme, map tiles, UTC offset, GPS.

import type { Locale, Theme, TileLayer } from "../state/appState";
import type { AppCtx } from "../app";
import { el, openSheet } from "./dom";
import { createGpsControl } from "./gpsControl";

const UTC_CHOICES: ReadonlyArray<number> = [-480, -300, 0, 60, 330, 480, 540, 600];

function offsetLabel(min: number): string {
  const sign = min < 0 ? "-" : "+";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}`;
}

/**
 * `animate: false` swaps the sheet in place — see `rebuild` below — and
 * `focusPill` names the choice that keyboard focus should land on again.
 */
export function openSettings(ctx: AppCtx, animate = true, focusPill?: string): void {
  const s = ctx.store.get();

  const { backdrop, sheet, close } = openSheet({
    title: ctx.tr("settings"),
    closeLabel: ctx.tr("close"),
    animate,
  });

  /** Commit + re-render with fresh state, without replaying the slide-up. */
  function rebuild(pillId: string): void {
    backdrop.remove();
    sheet.remove();
    openSettings(ctx, false, pillId);
  }

  function pills<T extends string | number>(
    group: string,
    label: string,
    current: T,
    choices: ReadonlyArray<{ value: T; label: string }>,
    apply: (v: T) => void,
  ): HTMLElement {
    const root = el("div", { class: "pillgroup", role: "group", "aria-label": label });
    for (const c of choices) {
      const pillId = `${group}:${c.value}`;
      const pill = el(
        "button",
        {
          type: "button",
          class: `pill${c.value === current ? " active" : ""}`,
          "aria-pressed": String(c.value === current),
          "data-pill": pillId,
          onclick: () => {
            apply(c.value);
            rebuild(pillId);
          },
        },
        c.label,
      );
      root.append(pill);
    }
    return root;
  }

  function row(label: string, control: HTMLElement): HTMLElement {
    return el("div", { class: "setting-row" }, el("span", { class: "lbl" }, label), control);
  }

  sheet.append(
    row(
      ctx.tr("language"),
      pills<Locale>(
        "locale",
        ctx.tr("language"),
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
        "theme",
        ctx.tr("theme"),
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
        "tiles",
        ctx.tr("mapTiles"),
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
        "utc",
        ctx.tr("utcOffset"),
        s.utcOffsetMin ?? -1,
        [
          { value: -1, label: ctx.tr("utcOffsetDevice") },
          ...UTC_CHOICES.map((m) => ({ value: m, label: offsetLabel(m) })),
        ],
        (v) => ctx.store.set({ utcOffsetMin: v === -1 ? null : v }),
      ),
    ),
  );

  const gpsControl = createGpsControl(ctx, { onLocated: close, onOpenMap: close });
  const locLine = el(
    "div",
    { class: "setting-row" },
    el(
      "span",
      { class: "lbl" },
      `${ctx.tr("location")}: ${s.location.lat.toFixed(4)}, ${s.location.lng.toFixed(4)}` +
        (s.locationSource === "manual" ? ` (${ctx.tr("manualLocation")})` : ""),
    ),
    gpsControl,
  );
  // A name of the user's own ("Home") replaces raw coordinates in the header.
  const nameInput = el("input", {
    type: "text",
    class: "num-input name-input",
    value: s.locationName ?? "",
    placeholder: ctx.tr("locationNamePlaceholder"),
    maxlength: "40",
    autocomplete: "off",
    onchange: () => {
      ctx.setLocationName(nameInput.value);
      // Show what was actually kept (trimmed, capped) rather than the raw entry.
      nameInput.value = ctx.store.get().locationName ?? "";
    },
  }) as HTMLInputElement;
  const nameRow = el(
    "label",
    { class: "setting-row" },
    el("span", { class: "lbl" }, ctx.tr("locationName")),
    nameInput,
  );
  sheet.append(locLine, nameRow, el("p", { class: "footnote" }, ctx.tr("accuracyNote")));

  if (focusPill !== undefined) {
    sheet.querySelector<HTMLElement>(`[data-pill="${focusPill}"]`)?.focus();
  }
}
