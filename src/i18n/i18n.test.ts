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
} from "./index";
import { en } from "./keys";
import { ja } from "./ja";

describe("i18n dictionaries", () => {
  it("ja covers every en key with a non-empty value", () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(ja[key], `ja missing ${key}`).toBeTruthy();
    }
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });
});

describe("detectLocale", () => {
  it("prefers the stored explicit choice", () => {
    expect(detectLocale("en-US", "ja")).toBe("ja");
    expect(detectLocale("ja-JP", "en")).toBe("en");
  });

  it("falls back to navigator.language, defaulting to en", () => {
    expect(detectLocale("ja", null)).toBe("ja");
    expect(detectLocale("ja-JP", null)).toBe("ja");
    expect(detectLocale("en-GB", null)).toBe("en");
    expect(detectLocale("fr", null)).toBe("en");
    expect(detectLocale(undefined, null)).toBe("en");
    expect(detectLocale("en", "de")).toBe("en"); // bogus stored value ignored
  });
});

describe("t", () => {
  it("translates in both locales", () => {
    expect(t("en", "sunrise")).toBe("Sunrise");
    expect(t("ja", "sunrise")).toBe("日の出");
  });

  it("substitutes placeholders", () => {
    expect(t("en", "moonAgeDays", { days: "13.2" })).toBe("13.2 days");
    expect(t("ja", "moonAgeDays", { days: "13.2" })).toBe("13.2");
  });
});

describe("directionKey", () => {
  it("maps azimuths to 16-wind names with wraparound", () => {
    expect(directionKey(0)).toBe("dirN");
    expect(directionKey(360)).toBe("dirN");
    expect(directionKey(-10)).toBe("dirN");
    expect(directionKey(11.24)).toBe("dirN");
    expect(directionKey(11.26)).toBe("dirNNE");
    expect(directionKey(90)).toBe("dirE");
    expect(directionKey(180)).toBe("dirS");
    expect(directionKey(270)).toBe("dirW");
    expect(directionKey(348.7)).toBe("dirNNW");
    expect(directionKey(354)).toBe("dirN");
  });
});

describe("phaseNameKey", () => {
  it("maps every phase to its message key", () => {
    expect(phaseNameKey("new")).toBe("phaseNew");
    expect(phaseNameKey("full")).toBe("phaseFull");
    expect(phaseNameKey("waxingCrescent")).toBe("phaseWaxingCrescent");
    expect(phaseNameKey("lastQuarter")).toBe("phaseLastQuarter");
  });
});

describe("formatters", () => {
  const d = new Date("2026-07-07T09:30:45Z");

  it("formatTime with a manual UTC offset renders that zone", () => {
    expect(formatTime(d, "en", 540)).toBe("18:30");
    expect(formatTime(d, "ja", 0)).toBe("09:30");
    expect(formatTime(d, "en", -330, true)).toBe("04:00:45");
  });

  it("formatTime without an offset uses the device timezone", () => {
    // The test env's tz is unknown — assert shape, not the value.
    expect(formatTime(d, "en", null)).toMatch(/^\d{2}:\d{2}$/);
  });

  it("formatDate renders date with weekday in the requested zone", () => {
    expect(formatDate(d, "en", 540)).toContain("Jul");
    expect(formatDate(d, "ja", 540)).toContain("7月");
    expect(formatDate(d, "en", null)).toContain("2026");
    // +15h offset pushes into July 8.
    expect(formatDate(d, "en", 900)).toContain("8");
  });

  it("formatDeg / formatDuration / formatPercent", () => {
    expect(formatDeg(123.456, "en")).toBe("123.5°");
    expect(formatDeg(-0.04, "en")).toBe("-0.0°");
    expect(formatDuration(14 * 3_600_000 + 37.4 * 60_000, "en")).toBe("14h 37m");
    expect(formatDuration(14 * 3_600_000 + 37.4 * 60_000, "ja")).toBe("14時間37分");
    expect(formatPercent(0.834, "en")).toBe("83%");
  });
});
