// Locale detection, message lookup and Intl-based formatting. All functions
// are pure (locale passed in); the stateful binding lives in the UI layer.

import type { Locale } from "../state/appState";
import type { MoonPhaseName } from "../astro/moonphase";
import type { MsgKey } from "./keys";
import { en } from "./keys";
import { ja } from "./ja";

const DICTS: Record<Locale, Record<MsgKey, string>> = { en, ja };

export function detectLocale(navLang: string | undefined, stored: string | null): Locale {
  if (stored === "ja" || stored === "en") return stored;
  return navLang?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

/** Translate, substituting `{name}` placeholders from params. */
export function t(
  locale: Locale,
  key: MsgKey,
  params?: Record<string, string | number>,
): string {
  let msg = DICTS[locale][key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replaceAll(`{${k}}`, String(v));
    }
  }
  return msg;
}

const PHASE_KEYS: Record<MoonPhaseName, MsgKey> = {
  new: "phaseNew",
  waxingCrescent: "phaseWaxingCrescent",
  firstQuarter: "phaseFirstQuarter",
  waxingGibbous: "phaseWaxingGibbous",
  full: "phaseFull",
  waningGibbous: "phaseWaningGibbous",
  lastQuarter: "phaseLastQuarter",
  waningCrescent: "phaseWaningCrescent",
};

export function phaseNameKey(name: MoonPhaseName): MsgKey {
  return PHASE_KEYS[name];
}

const DIR_KEYS: readonly MsgKey[] = [
  "dirN",
  "dirNNE",
  "dirNE",
  "dirENE",
  "dirE",
  "dirESE",
  "dirSE",
  "dirSSE",
  "dirS",
  "dirSSW",
  "dirSW",
  "dirWSW",
  "dirW",
  "dirWNW",
  "dirNW",
  "dirNNW",
];

/** 16-wind compass name for an azimuth (N=0°, clockwise). */
export function directionKey(azimuthDeg: number): MsgKey {
  const idx = Math.round((((azimuthDeg % 360) + 360) % 360) / 22.5) % 16;
  return DIR_KEYS[idx];
}

/**
 * Format a time-of-day. With a manual UTC offset the date is shifted and
 * rendered as UTC (tz names for arbitrary offsets aren't portable).
 */
export function formatTime(
  date: Date,
  locale: Locale,
  utcOffsetMin: number | null,
  withSeconds = false,
): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
    hour12: false,
  };
  if (utcOffsetMin === null) {
    return new Intl.DateTimeFormat(locale, opts).format(date);
  }
  const shifted = new Date(date.getTime() + utcOffsetMin * 60_000);
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(shifted);
}

/** Format a calendar date (weekday short form). */
export function formatDate(date: Date, locale: Locale, utcOffsetMin: number | null): string {
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  };
  if (utcOffsetMin === null) {
    return new Intl.DateTimeFormat(locale, opts).format(date);
  }
  const shifted = new Date(date.getTime() + utcOffsetMin * 60_000);
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(shifted);
}

/** Degrees with one decimal and the ° suffix, using locale digits rules. */
export function formatDeg(value: number, locale: Locale): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}°`;
}

/** A duration in ms as "13h 24m". */
export function formatDuration(ms: number, locale: Locale): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return locale === "ja" ? `${h}時間${m}分` : `${h}h ${m}m`;
}

/** Percent with no decimals ("83%"). */
export function formatPercent(fraction: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(fraction);
}
