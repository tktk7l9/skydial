// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { openHousePanel } from "./housePanel";
import { createTestCtx } from "../../test-utils/testCtx";
import { clampHouse, defaultHouse } from "../../sunsim/house";

const TIME = new Date("2026-03-20T03:00:00Z");

function open(house = clampHouse(defaultHouse())) {
  const ctx = createTestCtx({ house, utcOffsetMin: 540 });
  openHousePanel(ctx, TIME);
  return ctx;
}

const totalLine = (): string =>
  (document.querySelector(".sheet .countdown")?.textContent ?? "").trim();

describe("insolation results panel", () => {
  afterEach(() => document.body.replaceChildren());

  it("does nothing while the house is off", () => {
    const ctx = createTestCtx({ house: null });
    openHousePanel(ctx, TIME);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a progress line, then one card per window and the total", async () => {
    open();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "日射取得(快晴)" })).toBeVisible();
    expect(within(dialog).getByText("計算中…")).toBeVisible();
    await waitFor(() => expect(within(dialog).queryByText("計算中…")).not.toBeInTheDocument());
    expect(dialog.querySelectorAll(".window-result")).toHaveLength(6);
    // Each card says which window it is, not only which way it faces (SHIG 12, 24).
    expect(within(dialog).getByText(/^窓1 · 南 · 1\.\d+×\d(\.\d+)? m$/)).toBeVisible();
    expect(within(dialog).getByText(/^窓6 · /)).toBeVisible();
    expect(totalLine()).toMatch(/^合計: \d+\.\d kWh$/);
    expect(within(dialog).getAllByText("直達").length).toBe(6);
    expect(within(dialog).getByText(/快晴を前提にした概算です/)).toBeVisible();
  });

  it("switches between today and the solstices", async () => {
    open();
    await waitFor(() => expect(totalLine()).not.toBe(""));
    const march = totalLine();
    const winter = screen.getByRole("button", { name: "冬至" });
    await userEvent.click(winter);
    expect(winter).toHaveClass("active");
    await waitFor(() => expect(totalLine()).not.toBe(""));
    const dec = totalLine();
    await userEvent.click(screen.getByRole("button", { name: "夏至" }));
    await waitFor(() => expect(totalLine()).not.toBe(""));
    const jun = totalLine();
    // A south-facing house gains more in winter than in summer.
    const kwh = (s: string): number => Number(/([\d.]+) kWh/.exec(s)![1]);
    expect(kwh(dec)).toBeGreaterThan(kwh(jun));
    expect(march).not.toBe("");
    expect(screen.getByRole("button", { name: "夏至" })).toHaveClass("active");
    expect(winter).not.toHaveClass("active");
  });

  it("explains a window whose light never reaches the floor", async () => {
    const shaded = {
      ...clampHouse(defaultHouse()),
      windows: [{ face: 2 as const, w: 0.6, h: 0.9, sill: 1.1, off: 2, shgc: 0.6 }],
    };
    open(shaded);
    await waitFor(() => expect(screen.getByText(/床に日射パッチなし/)).toBeVisible());
    // A north window in March gets no beam: said in words, not "0m" (SHIG 28).
    expect(screen.getByText(/日照: 直射なし/)).toBeVisible();
  });

  it("reuses cached results and evicts old ones", async () => {
    // Many distinct models exercise the bounded cache.
    for (let w = 0; w < 14; w++) {
      document.body.replaceChildren();
      open({ ...clampHouse(defaultHouse()), width: 8 + w * 0.5, windows: [] });
      await waitFor(() => expect(totalLine()).toBe("合計: 0.0 kWh"));
    }
    document.body.replaceChildren();
    open({ ...clampHouse(defaultHouse()), width: 8 + 13 * 0.5, windows: [] });
    await waitFor(() => expect(totalLine()).toBe("合計: 0.0 kWh"));
  });

  it("closes when the house is turned off before switching scenario", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const ctx = open();
    ctx.store.set({ house: null });
    screen.getByRole("button", { name: "冬至" }).click();
    vi.advanceTimersByTime(400);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
