// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { createGpsControl } from "./gpsControl";
import { createTestCtx } from "../test-utils/testCtx";

function deferred(): { promise: Promise<boolean>; resolve(v: boolean): void } {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
}

describe("GPS control", () => {
  afterEach(() => document.body.replaceChildren());

  it("shows progress, blocks double presses, and reports success", async () => {
    const d = deferred();
    const onLocated = vi.fn();
    const ctx = createTestCtx({}, { requestGps: () => d.promise });
    document.body.append(createGpsControl(ctx, { onLocated }));

    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    const busy = screen.getByRole("button", { name: "取得中…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    d.resolve(true);
    await waitFor(() => expect(onLocated).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "現在地を使う" })).toBeEnabled();
    expect(screen.queryByText(/位置情報が使えません/)).not.toBeInTheDocument();
  });

  it("explains a failure and offers the map instead", async () => {
    const onOpenMap = vi.fn();
    const ctx = createTestCtx();
    document.body.append(createGpsControl(ctx, { primary: false, onOpenMap }));
    const button = screen.getByRole("button", { name: "現在地を使う" });
    expect(button).not.toHaveClass("primary");

    await userEvent.click(button);
    expect(await screen.findByText(/位置情報が使えません/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "地図を開く" }));
    expect(ctx.store.get().tab).toBe("map");
    expect(onOpenMap).toHaveBeenCalled();
  });

  it("works without callbacks", async () => {
    const ctx = createTestCtx({}, { requestGps: () => Promise.resolve(true) });
    document.body.append(createGpsControl(ctx));
    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "現在地を使う" })).toBeEnabled(),
    );
    const ctx2 = createTestCtx();
    document.body.replaceChildren(createGpsControl(ctx2));
    await userEvent.click(screen.getByRole("button", { name: "現在地を使う" }));
    await userEvent.click(await screen.findByRole("button", { name: "地図を開く" }));
    expect(ctx2.store.get().tab).toBe("map");
  });
});
