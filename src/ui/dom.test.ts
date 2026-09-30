// @vitest-environment jsdom
import { closeSheet, el, openSheet } from "./dom";

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

describe("openSheet", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  function mountPage(): HTMLButtonElement {
    const opener = el("button", { type: "button" }, "open");
    document.body.append(el("div", { id: "app" }, opener));
    opener.focus();
    return opener;
  }

  it("names the dialog by its title, focuses it and makes the page behind inert", () => {
    const opener = mountPage();
    const { sheet } = openSheet({ title: "設定", closeLabel: "閉じる" });
    expect(sheet).toHaveAttribute("role", "dialog");
    expect(sheet).toHaveAccessibleName("設定");
    expect(sheet).toHaveFocus();
    expect(document.getElementById("app")).toHaveAttribute("inert");
    expect(opener.closest("#app")).toHaveAttribute("inert");
  });

  it("closes from Escape, its close button or the backdrop and gives focus back", () => {
    const opener = mountPage();
    const { sheet } = openSheet({ title: "設定", closeLabel: "閉じる" });
    sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(sheet).toHaveClass("closing");
    vi.advanceTimersByTime(400);
    expect(sheet).not.toBeInTheDocument();
    expect(document.getElementById("app")).not.toHaveAttribute("inert");
    expect(opener).toHaveFocus();

    const second = openSheet({ title: "家", closeLabel: "閉じる" });
    (second.sheet.querySelector(".sheet-close") as HTMLElement).click();
    vi.advanceTimersByTime(400);
    expect(second.sheet).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    const third = openSheet({ title: "日射", closeLabel: "閉じる" });
    third.backdrop.click();
    vi.advanceTimersByTime(400);
    expect(third.sheet).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("ignores other keys and keeps the page inert while another sheet stays open", () => {
    mountPage();
    const first = openSheet({ title: "A", closeLabel: "閉じる" });
    first.sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(first.sheet).not.toHaveClass("closing");
    const second = openSheet({ title: "B", closeLabel: "閉じる", animate: false });
    expect(second.sheet).toHaveClass("no-enter");
    second.close();
    vi.advanceTimersByTime(400);
    expect(document.getElementById("app")).toHaveAttribute("inert");
    first.close();
    vi.advanceTimersByTime(400);
    expect(document.getElementById("app")).not.toHaveAttribute("inert");
  });

  it("keeps the original opener when a sheet is rebuilt in place", () => {
    const opener = mountPage();
    const first = openSheet({ title: "A", closeLabel: "閉じる" });
    first.sheet.remove();
    first.backdrop.remove();
    expect(document.activeElement).toBe(document.body);
    const second = openSheet({ title: "A", closeLabel: "閉じる", animate: false });
    second.close();
    vi.advanceTimersByTime(400);
    expect(opener).toHaveFocus();
  });

  it("does not try to focus an opener that has since left the page", () => {
    const opener = mountPage();
    const { close } = openSheet({ title: "A", closeLabel: "閉じる" });
    opener.remove();
    close();
    vi.advanceTimersByTime(400);
    expect(document.activeElement).toBe(document.body);
  });
});
