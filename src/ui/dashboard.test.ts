// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createDashboard } from "./dashboard";
import { createTestCtx } from "../test-utils/testCtx";
import type { AppState } from "../state/appState";
import { sunPosition } from "../astro/solar";

const TOKYO = { lat: 35.6762, lng: 139.6503 };
const TROMSO = { lat: 69.65, lng: 18.96 };

function mount(patch: Partial<AppState>, ctxOverrides = {}) {
  const ctx = createTestCtx({ utcOffsetMin: 540, ...patch }, ctxOverrides);
  const dash = createDashboard(ctx);
  document.body.replaceChildren(dash.root);
  const render = (): void => {
    const s = ctx.store.get();
    dash.update(s, s.time ?? new Date());
  };
  ctx.store.subscribe(render);
  render();
  return { ctx, dash, render };
}

/** The value next to a time-row label. */
function row(label: string): string {
  const lbl = screen.getAllByText(label, { selector: ".lbl" })[0];
  return lbl.nextElementSibling?.textContent ?? "";
}

describe("dashboard", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows sun and moon positions and the day's times for a normal day", () => {
    mount({ time: new Date("2026-06-21T03:00:00Z"), location: TOKYO, locationSource: "gps" });
    expect(screen.getByRole("heading", { name: "太陽" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "月" })).toBeVisible();
    expect(row("日の出")).toMatch(/^04:2\d$/);
    expect(row("日の入り")).toMatch(/^19:0\d$/);
    expect(row("昼の長さ")).toMatch(/14/);
    expect(row("南中")).toMatch(/^11:4\d$/);
    // Noon sun is high: a shadow ratio is shown next to the altitude.
    expect(screen.getByText(/影 ×0\.\d/)).toBeVisible();
    expect(screen.getByText(/日の入りまで/)).toBeVisible();
    expect(screen.getByText(/航海など高精度用途には使えません/)).toBeVisible();
  });

  it("caps the shadow ratio at 99+ just above the horizon, and drops it below", () => {
    // Walk from before sunrise to the first instant the sun clears 0.1°
    // (shadow ratio > 99 below ~0.58°).
    let t = new Date("2026-06-20T19:00:00Z").getTime();
    while (sunPosition(new Date(t), TOKYO).apparentAltitude <= 0.15) t += 30_000;
    expect(sunPosition(new Date(t), TOKYO).apparentAltitude).toBeLessThan(0.5);
    const { ctx } = mount({ time: new Date(t), location: TOKYO, locationSource: "gps" });
    expect(screen.getByText(/影 ×99\+/)).toBeVisible();

    ctx.store.set({ time: new Date(t - 30 * 60_000) });
    expect(screen.queryByText(/影 ×/)).not.toBeInTheDocument();
  });

  it("asks for a location while the default (Tokyo) is in use", async () => {
    const { ctx } = mount({ time: new Date("2026-06-21T03:00:00Z") });
    const banner = screen.getByRole("note");
    expect(banner).toHaveTextContent("東京の時刻を表示しています");
    await userEvent.click(within(banner).getByRole("button", { name: "地図で選ぶ" }));
    expect(ctx.store.get().tab).toBe("map");

    ctx.store.set({ locationSource: "manual" });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("counts down to tomorrow's sunrise late at night", () => {
    // 23:30 JST: every event of the day is behind.
    mount({ time: new Date("2026-06-21T14:30:00Z"), location: TOKYO });
    expect(screen.getByText(/日の出まで/)).toBeVisible();
    expect(screen.getByText(/日の出まで/)).toHaveTextContent(/4/);
  });

  it("counts down to the end of golden and blue hours while inside them", () => {
    const { ctx } = mount({ time: new Date("2026-06-21T09:50:00Z"), location: TOKYO });
    // Walk through the evening in 5-minute steps and collect the banners.
    const seen = new Set<string>();
    for (let m = 0; m < 120; m += 5) {
      ctx.store.set({ time: new Date(Date.parse("2026-06-21T09:00:00Z") + m * 60_000) });
      const text = document.querySelector(".countdown")?.textContent ?? "";
      seen.add(text.replace(/[\d:時間分秒 hms]+$/u, "").trim());
    }
    expect(seen).toContain("ゴールデンアワー終了まで");
    expect(seen).toContain("ブルーアワー終了まで");
  });

  it("says so under the midnight sun and in polar night", () => {
    const { ctx } = mount({ time: new Date("2026-06-21T12:00:00Z"), location: TROMSO, utcOffsetMin: 120 });
    expect(screen.getByText("白夜 — 太陽が沈みません")).toBeVisible();
    ctx.store.set({ time: new Date("2026-12-21T12:00:00Z"), utcOffsetMin: 60 });
    expect(screen.getByText("極夜 — 太陽が昇りません")).toBeVisible();
    // No sunrise or sunset is left to count down to.
    expect(document.querySelector(".countdown")?.textContent ?? "").not.toMatch(/日の出まで|日の入りまで/);
  });

  it("jumps to the solstices and the next full/new moon, keeping the clock time", async () => {
    const { ctx } = mount({ time: new Date("2026-03-10T03:00:00Z"), location: TOKYO });
    await userEvent.click(screen.getByRole("button", { name: "夏至" }));
    expect(ctx.store.get().time?.toISOString()).toBe("2026-06-21T03:00:00.000Z");
    await userEvent.click(screen.getByRole("button", { name: "冬至" }));
    expect(ctx.store.get().time?.toISOString()).toBe("2026-12-22T03:00:00.000Z");
    const before = ctx.store.get().time!.getTime();
    await userEvent.click(screen.getByRole("button", { name: "次の満月" }));
    const full = ctx.store.get().time!.getTime();
    expect(full).toBeGreaterThan(before);
    expect(full - before).toBeLessThan(30 * 86_400_000);
    await userEvent.click(screen.getByRole("button", { name: "次の新月" }));
    expect(ctx.store.get().time!.getTime()).toBeGreaterThan(full - 30 * 86_400_000);
  });

  it("shows the moon age and phase name, and recomputes a new day", () => {
    const { ctx } = mount({ time: new Date("2026-01-03T12:00:00Z"), location: TOKYO });
    // 2026-01-03 is a full moon.
    expect(screen.getByText("満月")).toBeVisible();
    expect(Number(row("月齢"))).toBeGreaterThan(13);
    ctx.store.set({ time: new Date("2026-01-19T12:00:00Z") }); // new moon on 01-18
    expect(Number(row("月齢"))).toBeLessThan(2);
  });

  it("reports a day without moonrise or moonset", () => {
    const { ctx } = mount({ time: new Date("2026-06-01T03:00:00Z"), location: TOKYO });
    const dashes: string[] = [];
    for (let d = 0; d < 30; d++) {
      ctx.store.set({ time: new Date(Date.parse("2026-06-01T03:00:00Z") + d * 86_400_000) });
      dashes.push(row("月の出"), row("月の入り"));
    }
    expect(dashes).toContain("—");
  });

  it("shows when the moon never rises or never sets near the pole", () => {
    const { ctx } = mount({ time: new Date("2026-01-01T12:00:00Z"), location: TROMSO, utcOffsetMin: 60 });
    const notes = new Set<string>();
    for (let d = 0; d < 30; d++) {
      ctx.store.set({ time: new Date(Date.parse("2026-01-01T12:00:00Z") + d * 86_400_000) });
      for (const n of document.querySelectorAll(".polar-note")) notes.add(n.textContent ?? "");
    }
    expect(notes).toContain("月は一日中出ています");
    expect(notes).toContain("月は一日中地平線の下です");
  });

  it("dims a body below the horizon", () => {
    mount({ time: new Date("2026-06-21T15:00:00Z"), location: TOKYO });
    expect(document.querySelector(".body-card.sun")).toHaveClass("below-horizon");
  });
});
