// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { dismissToast, showToast } from "./toast";

describe("showToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    dismissToast();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("announces the message and disappears after the duration", () => {
    showToast({ message: "地点を変更しました", durationMs: 1000 });
    expect(screen.getByRole("status")).toHaveTextContent("地点を変更しました");
    vi.advanceTimersByTime(999);
    expect(screen.queryByRole("status")).toBeInTheDocument();
    vi.advanceTimersByTime(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("runs the undo action once and closes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onAction = vi.fn();
    showToast({ message: "窓を削除しました", actionLabel: "元に戻す", onAction });
    await user.click(screen.getByRole("button", { name: "元に戻す" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("窓を削除しました")).not.toBeInTheDocument();
  });

  it("shows no action button without both a label and a handler", () => {
    showToast({ message: "x", actionLabel: "元に戻す" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("replaces the previous notice instead of stacking", () => {
    showToast({ message: "first" });
    showToast({ message: "second" });
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("second");
  });

  it("stays while hovered and resumes the countdown on leave", () => {
    showToast({ message: "hold", durationMs: 1000 });
    const notice = screen.getByRole("status");
    notice.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(5000);
    expect(notice).toBeInTheDocument();
    notice.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(1000);
    expect(notice).not.toBeInTheDocument();
  });

  it("stays while its undo button has keyboard focus", () => {
    showToast({ message: "focus", actionLabel: "元に戻す", onAction: () => undefined, durationMs: 1000 });
    const button = screen.getByRole("button", { name: "元に戻す" });
    button.focus();
    vi.advanceTimersByTime(5000);
    expect(button).toBeInTheDocument();
    button.blur();
    vi.advanceTimersByTime(0); // focusout releases on the next task
    vi.advanceTimersByTime(1000);
    expect(button).not.toBeInTheDocument();
  });

  it("ignores a stale release after being replaced", () => {
    showToast({ message: "old", durationMs: 300 });
    const old = screen.getByRole("status");
    showToast({ message: "new", durationMs: 1000 });
    // A late pointerleave on the replaced notice must not arm its own
    // (shorter) timer, which would dismiss the new one early.
    old.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(500);
    expect(screen.getByRole("status")).toHaveTextContent("new");
    vi.advanceTimersByTime(500);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismissToast is a no-op with nothing showing", () => {
    expect(() => dismissToast()).not.toThrow();
  });
});
