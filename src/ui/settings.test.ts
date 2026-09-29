// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { openSettings } from "./settings";
import { createTestCtx } from "../test-utils/testCtx";

const dialog = (): HTMLElement => screen.getByRole("dialog");

describe("settings sheet", () => {
  afterEach(() => document.body.replaceChildren());

  it("marks the current choices and applies a picked theme in place", async () => {
    const ctx = createTestCtx();
    openSettings(ctx);
    expect(within(dialog()).getByRole("heading", { name: "設定" })).toBeVisible();
    expect(within(dialog()).getByRole("button", { name: "自動" })).toHaveClass("active");

    await userEvent.click(within(dialog()).getByRole("button", { name: "ダーク" }));
    expect(ctx.store.get().theme).toBe("dark");
    // Rebuilt without replaying the slide-up, and only one sheet stays open.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(dialog()).toHaveClass("no-enter");
    expect(within(dialog()).getByRole("button", { name: "ダーク" })).toHaveClass("active");
  });

  it("switches language, tiles and UTC offset", async () => {
    const ctx = createTestCtx();
    openSettings(ctx);
    await userEvent.click(within(dialog()).getByRole("button", { name: "地理院地図" }));
    expect(ctx.store.get().tiles).toBe("gsi");
    await userEvent.click(within(dialog()).getByRole("button", { name: "UTC+5:30" }));
    expect(ctx.store.get().utcOffsetMin).toBe(330);
    await userEvent.click(within(dialog()).getByRole("button", { name: "UTC-8" }));
    expect(ctx.store.get().utcOffsetMin).toBe(-480);
    await userEvent.click(within(dialog()).getByRole("button", { name: "端末に合わせる" }));
    expect(ctx.store.get().utcOffsetMin).toBeNull();
    await userEvent.click(within(dialog()).getByRole("button", { name: "English" }));
    expect(ctx.store.get().locale).toBe("en");
    expect(within(dialog()).getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  it("shows the location and saves a trimmed name", async () => {
    const ctx = createTestCtx({
      location: { lat: 35.25, lng: 139.5 },
      locationSource: "manual",
    });
    openSettings(ctx);
    expect(within(dialog()).getByText("地点: 35.2500, 139.5000 (手動)")).toBeVisible();
    const name = within(dialog()).getByRole("textbox", { name: "地点の名前" });
    await userEvent.type(name, "  自宅  ");
    name.blur();
    expect(ctx.store.get().locationName).toBe("自宅");
    expect(name).toHaveValue("自宅");
  });

  it("closes from the backdrop", async () => {
    vi.useFakeTimers();
    const ctx = createTestCtx();
    openSettings(ctx);
    (document.querySelector(".sheet-backdrop") as HTMLElement).click();
    vi.advanceTimersByTime(400);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("closes itself once GPS locates the device", async () => {
    const ctx = createTestCtx({}, { requestGps: () => Promise.resolve(true) });
    openSettings(ctx);
    await userEvent.click(within(dialog()).getByRole("button", { name: "現在地を使う" }));
    await waitFor(() => expect(dialog()).toHaveClass("closing"));
  });
});
