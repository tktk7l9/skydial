// Bottom-sheet results panel: per-window daily solar gain for today / the
// summer solstice / the winter solstice, computed on demand and cached.

import { solsticeInstant } from "../../astro/phaseevents";
import { dayStartFor } from "../../state/dayWindow";
import { encodeHouse } from "../../sunsim/houseCodec";
import { simulateDay } from "../../sunsim/simulate";
import type { HouseDayResult } from "../../sunsim/simulate";
import type { AppCtx } from "../../app";
import { el, openSheet } from "../../ui/dom";

type Scenario = "today" | "jun" | "dec";

const CACHE_LIMIT = 12;
const cache = new Map<string, HouseDayResult>();

function cacheKey(houseStr: string, lat: number, lng: number, dayStartMs: number): string {
  return `${houseStr}:${lat.toFixed(3)}:${lng.toFixed(3)}:${dayStartMs}`;
}

function getOrCompute(
  houseStr: string,
  model: Parameters<typeof simulateDay>[0],
  loc: Parameters<typeof simulateDay>[1],
  dayStart: Date,
): HouseDayResult {
  const key = cacheKey(houseStr, loc.lat, loc.lng, dayStart.getTime());
  const hit = cache.get(key);
  if (hit) return hit;
  const result = simulateDay(model, loc, dayStart);
  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return result;
}

function bar(label: string, kwh: number, max: number, color: string): HTMLElement {
  // The bar repeats the number beside it, so it is decoration for AT.
  const track = el("div", { class: "gain-bar-track", "aria-hidden": "true" });
  const fill = el("div", { class: "gain-bar-fill" });
  fill.style.width = `${max > 0 ? Math.min(100, (kwh / max) * 100) : 0}%`;
  fill.style.background = color;
  track.append(fill);
  return el(
    "div",
    { class: "gain-bar-row" },
    el("span", { class: "gain-bar-label" }, label),
    track,
    el("span", { class: "gain-bar-value" }, `${kwh.toFixed(1)} kWh`),
  );
}

export function openHousePanel(ctx: AppCtx, time: Date): void {
  const house = ctx.store.get().house;
  if (house === null) return;

  const { sheet, close } = openSheet({
    title: ctx.tr("houseResultsTitle"),
    closeLabel: ctx.tr("close"),
  });
  const body = el("div", {});
  let scenario: Scenario = "today";

  function scenarioDayStart(s: Scenario): Date {
    const state = ctx.store.get();
    if (s === "today") return dayStartFor(time, state.utcOffsetMin);
    const year = dayStartFor(time, state.utcOffsetMin).getFullYear();
    const instant = solsticeInstant(year, s);
    return dayStartFor(instant, state.utcOffsetMin);
  }

  function render(): void {
    const state = ctx.store.get();
    const currentHouse = state.house;
    if (currentHouse === null) {
      close();
      return;
    }
    body.replaceChildren(el("p", { class: "footnote" }, ctx.tr("resComputing")));

    requestAnimationFrame(() => {
      const dayStart = scenarioDayStart(scenario);
      const result = getOrCompute(
        encodeHouse(currentHouse),
        currentHouse,
        state.location,
        dayStart,
      );
      body.replaceChildren();

      const maxKwh = Math.max(0.1, ...result.windows.map((w) => w.irradiationKwhM2.total));
      result.windows.forEach((w, i) => {
        // "Window 1 · S · 1.7×2 m": which window, not only which way (SHIG 12, 24).
        const dir = `${ctx.tr("windowLabel", { n: i + 1 })} · ${ctx.trDir(w.azimuthDeg)} · ${w.spec.w}×${w.spec.h} m`;
        const b = w.irradiationKwhM2;
        const sunshine =
          w.sunshineMinutes === 0
            ? ctx.tr("resNoSunshine")
            : ctx.fmtDur(w.sunshineMinutes * 60_000);
        const card = el(
          "div",
          { class: "card window-result" },
          el(
            "div",
            { class: "window-result-head" },
            el("span", { class: "window-result-dir" }, dir),
            el(
              "span",
              { class: "window-result-gain" },
              `${w.gainKwh.toFixed(1)} kWh`,
            ),
          ),
          el(
            "div",
            { class: "footnote" },
            `${ctx.tr("resSunshine")}: ${sunshine} · ${ctx.tr("resTotal")}: ${b.total.toFixed(1)} kWh/m²`,
          ),
          bar(ctx.tr("resDirect"), b.direct, maxKwh, "var(--accent-sun)"),
          bar(ctx.tr("resDiffuse"), b.isotropic + b.circumsolar, maxKwh, "var(--accent-blue)"),
          bar(ctx.tr("resReflected"), b.reflected, maxKwh, "var(--accent-golden)"),
          el(
            "div",
            { class: "footnote room-patch-line" },
            w.maxPatchAreaM2 > 0
              ? `${ctx.tr("resRoomDepth")}: ${w.maxPatchDepthM.toFixed(1)}m · ` +
                `${ctx.tr("resRoomArea")}: ${w.maxPatchAreaM2.toFixed(1)}m² · ` +
                `${ctx.tr("resRoomHours")}: ${ctx.fmtDur(w.interiorLitMinutes * 60_000)}`
              : ctx.tr("resNoFloorPatch"),
          ),
        );
        body.append(card);
      });
      body.append(
        el(
          "div",
          { class: "card countdown" },
          `${ctx.tr("resTotal")}: ${result.totalGainKwh.toFixed(1)} kWh`,
        ),
      );
      body.append(
        el("p", { class: "footnote" }, ctx.tr("houseNote")),
        el("p", { class: "footnote" }, ctx.tr("houseInteriorNote")),
      );
    });
  }

  const chipButtons = new Map<Scenario, HTMLButtonElement>();
  const chips = el("div", { class: "pillgroup chips", role: "group" });
  for (const s of ["today", "jun", "dec"] as Scenario[]) {
    const btn = el(
      "button",
      {
        type: "button",
        class: `pill${scenario === s ? " active" : ""}`,
        "aria-pressed": String(scenario === s),
        onclick: () => {
          scenario = s;
          for (const b of chipButtons.values()) {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          }
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
          render();
        },
      },
      s === "today"
        ? ctx.fmtDate(time)
        : ctx.tr(s === "jun" ? "domeSummerSolstice" : "domeWinterSolstice"),
    );
    chipButtons.set(s, btn);
    chips.append(btn);
  }

  sheet.append(chips, body);
  render();
}
