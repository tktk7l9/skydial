// @vitest-environment jsdom
import { within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createTabbar } from "./tabs";
import { createTestCtx } from "../test-utils/testCtx";

describe("tab bar", () => {
  it("switches tabs and marks the current one", async () => {
    const ctx = createTestCtx();
    const bar = createTabbar(ctx);
    document.body.replaceChildren(bar.root);
    ctx.store.subscribe((s) => bar.update(s));
    bar.update(ctx.store.get());
    const nav = within(bar.root);
    expect(nav.getByRole("button", { name: "ホーム" })).toHaveAttribute("aria-current", "page");

    await userEvent.click(nav.getByRole("button", { name: "地図" }));
    expect(ctx.store.get().tab).toBe("map");
    expect(nav.getByRole("button", { name: "地図" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("button", { name: "ホーム" })).toHaveAttribute("aria-current", "false");
  });
});
