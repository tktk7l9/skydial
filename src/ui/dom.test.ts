// @vitest-environment jsdom
import { closeSheet, el } from "./dom";

describe("el", () => {
  it("builds attributes, boolean flags, classes, listeners and children", () => {
    const onClick = vi.fn();
    const node = el(
      "button",
      { class: "btn", type: "button", disabled: true, hidden: false, onclick: onClick },
      "OK",
      null,
      undefined,
      el("span", {}, "!"),
    );
    expect(node).toHaveClass("btn");
    expect(node).toHaveAttribute("type", "button");
    expect(node).toBeDisabled();
    expect(node).not.toHaveAttribute("hidden");
    expect(node).toHaveTextContent("OK!");
    node.disabled = false;
    node.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("closeSheet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("removes the sheet after its exit animation", () => {
    const backdrop = el("div", {});
    const sheet = el("div", { role: "dialog" });
    document.body.append(backdrop, sheet);
    closeSheet(backdrop, sheet);
    expect(sheet).toHaveClass("closing");
    sheet.dispatchEvent(new Event("animationend"));
    expect(sheet).not.toBeInTheDocument();
    expect(backdrop).not.toBeInTheDocument();
  });

  it("still closes when the animation never runs, and ignores a second close", () => {
    const backdrop = el("div", {});
    const sheet = el("div", {});
    document.body.append(backdrop, sheet);
    closeSheet(backdrop, sheet);
    closeSheet(backdrop, sheet);
    vi.advanceTimersByTime(400);
    expect(sheet).not.toBeInTheDocument();
  });
});
