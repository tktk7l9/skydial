// @vitest-environment jsdom
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import type { AppCtx, View } from "./app";
import { startApp } from "./app";
import { el } from "./ui/dom";
import { dismissToast } from "./ui/toast";

// The clock assertions describe a device in Japan, whatever zone runs the tests.
vi.hoisted(() => {
  (globalThis as unknown as { process: { env: Record<string, string> } }).process.env.TZ =
    "Asia/Tokyo";
});

// The lazy tabs pull in WebGL / Leaflet / camera code that has their own
// tests; here they are stand-ins that show which tab is mounted.
const lazy = vi.hoisted(() => ({
  ctx: null as AppCtx | null,
  created: [] as string[],
  destroyed: [] as string[],
  /** Names whose next creation throws (a chunk that failed to load). */
  failing: new Set<string>(),
}));
function fakeView(name: string) {
  return (ctx: AppCtx): View => {
    if (lazy.failing.has(name)) {
      lazy.failing.delete(name);
      throw new Error(`${name} chunk failed`);
    }
    lazy.ctx = ctx;
    lazy.created.push(name);
    const root = el("section", { "aria-label": `${name}-view` });
    return {
      root,
      update: (s) => {
        root.textContent = `${name} ${s.locale}`;
      },
      destroy: () => lazy.destroyed.push(name),
    };
  };
}
vi.mock("./views/dome/index", () => ({ createDomeView: fakeView("dome") }));
vi.mock("./views/map/index", () => ({ createMapView: fakeView("map") }));
vi.mock("./views/ar/index", () => ({ createArView: fakeView("ar") }));

const NOW = new Date("2026-06-21T03:00:00Z");

const reload = vi.fn();
function boot(search = ""): HTMLElement {
  history.replaceState(null, "", `/${search}`);
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  startApp(root, { reload });
  return root;
}

const tabbar = () => within(screen.getByRole("navigation"));
const locChip = () => screen.getByRole("button", { name: /^地点:/ });

async function flushLazy(): Promise<void> {
  await vi.dynamicImportSettled();
  await Promise.resolve();
}

describe("app shell (real timers)", () => {
  beforeEach(() => localStorage.clear());
  it("marks the background live after the first frames", async () => {
    boot();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.documentElement).toHaveClass("bg-live");
  });
});

let user: ReturnType<typeof userEvent.setup>;

describe("app shell", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });
    vi.setSystemTime(NOW);
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.clear();
    localStorage.setItem("skydial:locale", "ja");
    lazy.ctx = null;
    lazy.created.length = 0;
    lazy.destroyed.length = 0;
    lazy.failing.clear();
    reload.mockClear();
  });
  afterEach(() => {
    dismissToast();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.replaceChildren();
    document.documentElement.removeAttribute("data-theme");
  });

  it("paints the dashboard for the default location on first load", () => {
    boot();
    expect(document.documentElement.lang).toBe("ja");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Skydial");
    expect(locChip()).toHaveTextContent("35.68, 139.65");
    expect(locChip()).toHaveAccessibleName("地点: 35.68, 139.65 — 地図で地点を変更");
    expect(screen.getByRole("button", { name: "設定" })).toBeVisible();
    expect(tabbar().getByRole("button", { name: "ホーム" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("note")).toHaveTextContent("東京の時刻を表示しています");
    expect(document.documentElement.style.getPropertyValue("--sky-top")).toMatch(/^rgb/);
    expect(document.documentElement.dataset.sky).toBe("bright");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("opens the map from the location chip and loads the tab lazily once", async () => {
    boot();
    await user.click(locChip());
    await flushLazy();
    expect(screen.getByRole("region", { name: "map-view" })).toHaveTextContent("map ja");
    expect(document.querySelector("main")).toHaveClass("wide");

    await user.click(tabbar().getByRole("button", { name: "ホーム" }));
    expect(screen.queryByRole("region", { name: "map-view" })).not.toBeInTheDocument();
    expect(document.querySelector("main")).not.toHaveClass("wide");
    await user.click(tabbar().getByRole("button", { name: "地図" }));
    expect(screen.getByRole("region", { name: "map-view" })).toBeInTheDocument();
    expect(lazy.created).toEqual(["map"]);
  });

  it("answers a tab tap at once with a loading note (SHIG 65, 66)", async () => {
    boot();
    tabbar().getByRole("button", { name: "ドーム" }).click();
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中…");
    expect(screen.queryByRole("note")).not.toBeInTheDocument(); // the dashboard is gone
    await flushLazy();
    expect(screen.queryByText("読み込み中…")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "dome-view" })).toBeInTheDocument();
  });

  it("says when a view could not load and retries on request (SHIG 55, 58)", async () => {
    lazy.failing.add("map");
    boot();
    tabbar().getByRole("button", { name: "地図" }).click();
    await flushLazy();
    expect(screen.getByText("読み込めませんでした")).toBeVisible();
    // Browsers remember a failed module fetch, so a retry is a reload; the
    // URL (tab, time, place) and localStorage bring the state back. The URL
    // is written before the reload even if its debounce has not run yet.
    expect(location.search).not.toContain("tab=map");
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(location.search).toContain("tab=map");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("drops a failure notice the user has already left behind", async () => {
    lazy.failing.add("ar");
    boot();
    const tabs = tabbar();
    tabs.getByRole("button", { name: "AR" }).click();
    tabs.getByRole("button", { name: "ホーム" }).click();
    await flushLazy();
    expect(screen.queryByText("読み込めませんでした")).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("does not start a second load while one is pending, and skips a stale mount", async () => {
    boot();
    const tabs = tabbar();
    tabs.getByRole("button", { name: "ドーム" }).click();
    tabs.getByRole("button", { name: "ホーム" }).click();
    tabs.getByRole("button", { name: "ドーム" }).click();
    tabs.getByRole("button", { name: "ホーム" }).click();
    await flushLazy();
    expect(lazy.created).toEqual(["dome"]);
    // The user had moved on: the dashboard stays.
    expect(screen.queryByRole("region", { name: "dome-view" })).not.toBeInTheDocument();
    tabs.getByRole("button", { name: "ドーム" }).click();
    expect(screen.getByRole("region", { name: "dome-view" })).toBeInTheDocument();
  });

  it("switching language rebuilds the chrome and every view", async () => {
    boot("?tab=ar");
    await flushLazy();
    expect(screen.getByRole("region", { name: "ar-view" })).toHaveTextContent("ar ja");
    await user.click(screen.getByRole("button", { name: "設定" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "English" }));
    await flushLazy();
    expect(localStorage.getItem("skydial:locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(tabbar().getByRole("button", { name: "Home" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
    expect(lazy.destroyed).toEqual(["ar"]);
    expect(screen.getByRole("region", { name: "ar-view" })).toHaveTextContent("ar en");
  });

  it("keeps theme and tile choices across launches", async () => {
    boot();
    await user.click(screen.getByRole("button", { name: "設定" }));
    const sheet = within(screen.getByRole("dialog"));
    await user.click(sheet.getByRole("button", { name: "ダーク" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "地理院地図" }));

    boot();
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(screen.getByRole("button", { name: "設定" }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "地理院地図" })).toHaveClass("active");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "ダーク" })).toHaveClass("active");
  });

  it("restores a saved, named location", () => {
    localStorage.setItem("skydial:location", JSON.stringify({ lat: 34.99, lng: 135.76 }));
    localStorage.setItem("skydial:location-name", "自宅");
    boot();
    expect(locChip()).toHaveTextContent("自宅");
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("opens a shared link with its place, time, tab and offset", async () => {
    localStorage.setItem("skydial:location-name", "自宅");
    localStorage.setItem("skydial:location", JSON.stringify({ lat: 34.99, lng: 135.76 }));
    boot("?lat=51.5&lng=-0.12&t=2026-12-21T12:00Z&tab=map&utc=0&lang=en");
    await flushLazy();
    // A shared place is shown by its coordinates, not the local nickname.
    expect(screen.getByRole("button", { name: /^Location:/ })).toHaveTextContent("51.50, -0.12");
    expect(screen.getByRole("region", { name: "map-view" })).toHaveTextContent("map en");
    expect(screen.getByRole("button", { name: /Dec/ })).toHaveTextContent("12:00");
  });

  it("estimates the offset for a shared remote place without ?utc", () => {
    boot("?lat=51.5&lng=-0.12&t=2026-12-21T12:00Z");
    expect(screen.getByText("12:00")).toBeVisible();
  });

  it("mirrors state into the URL after a short pause", async () => {
    boot();
    expect(location.search).toBe("");
    await user.click(screen.getByRole("button", { name: "夏至" }));
    vi.advanceTimersByTime(300);
    expect(location.search).toContain("t=2026-06-21T");
    await user.click(screen.getByRole("button", { name: "今に戻る" }));
    vi.advanceTimersByTime(300);
    expect(location.search).toBe("");
  });

  it("ticks the clock once a second while live and visible", () => {
    boot();
    const clock = () => document.querySelector(".scrubber .t span")!.textContent;
    expect(clock()).toBe("12:00");
    vi.advanceTimersByTime(60_000);
    expect(clock()).toBe("12:01");

    // Hidden tabs and scrubbed times do not tick.
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    vi.advanceTimersByTime(60_000);
    expect(clock()).toBe("12:01");
    delete (document as unknown as { hidden?: boolean }).hidden;
  });

  it("uses a GPS fix: stores it, names nothing, and hides the banner", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: 43.06, longitude: 141.35 } }),
      },
    });
    boot();
    await user.click(within(screen.getByRole("note")).getByRole("button", { name: "現在地を使う" }));
    await vi.waitFor(() => expect(locChip()).toHaveTextContent("43.06, 141.35"));
    expect(JSON.parse(localStorage.getItem("skydial:location")!)).toEqual({ lat: 43.06, lng: 141.35 });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("reports an unavailable GPS", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    boot();
    await user.click(within(screen.getByRole("note")).getByRole("button", { name: "現在地を使う" }));
    expect(await screen.findByText(/位置情報が使えません/)).toBeVisible();
  });

  it("names a place and restores an earlier location on undo", async () => {
    boot("?tab=map");
    await flushLazy();
    const ctx = lazy.ctx!;
    const before = { ...ctx.store.get() };

    ctx.setLocation({ lat: 34.7, lng: 135.5 }, "manual");
    ctx.setLocationName("  実家 ");
    expect(locChip()).toHaveTextContent("実家");
    expect(localStorage.getItem("skydial:location-name")).toBe("実家");

    // Undoing a first pick forgets the location entirely.
    ctx.restoreLocation(before);
    expect(locChip()).toHaveTextContent("35.68, 139.65");
    expect(localStorage.getItem("skydial:location")).toBeNull();

    ctx.setLocation({ lat: 34.7, lng: 135.5 }, "manual");
    ctx.setLocationName("実家");
    const named = { ...ctx.store.get() };
    ctx.setLocation({ lat: 26.2, lng: 127.7 }, "manual");
    ctx.restoreLocation(named);
    expect(locChip()).toHaveTextContent("実家");
    expect(localStorage.getItem("skydial:location-name")).toBe("実家");
  });

  it("hides the house without losing it and brings the same model back", async () => {
    boot("?tab=dome");
    await flushLazy();
    const ctx = lazy.ctx!;
    ctx.toggleHouse(); // on: the representative default
    const shown = ctx.store.get().house!;
    ctx.setHouse({ ...shown, width: 7 });
    ctx.toggleHouse(); // off
    expect(ctx.store.get().house).toBeNull();
    expect(localStorage.getItem("skydial:house-visible")).toBe("0");
    ctx.toggleHouse(); // on again
    expect(ctx.store.get().house?.width).toBe(7);
  });

  it("follows the system theme in auto mode", () => {
    const listeners: Array<() => void> = [];
    let dark = true;
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      get matches() {
        return q.includes("dark") ? dark : false;
      },
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    })) as unknown as typeof window.matchMedia;
    boot();
    expect(document.documentElement.dataset.theme).toBe("dark");
    dark = false;
    for (const fn of listeners) fn();
    expect(document.documentElement.dataset.theme).toBe("light");
    window.matchMedia = original;
  });

});
