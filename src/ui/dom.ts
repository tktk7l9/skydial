// Tiny DOM builder — keeps view code declarative without a framework.

type Attrs = Record<string, string | boolean | ((ev: Event) => void)>;
type Child = Node | string | null | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "function") {
      node.addEventListener(key.replace(/^on/, ""), value);
    } else if (typeof value === "boolean") {
      if (value) node.setAttribute(key, "");
    } else if (key === "class") {
      node.className = value;
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

let sheetSeq = 0;
/** The control that opened the first sheet; focus goes back to it at the end. */
let sheetOpener: HTMLElement | null = null;

/** Everything under `body` that is not a sheet or a notice. */
function pageChrome(): HTMLElement[] {
  return Array.from(document.body.children).filter(
    (n): n is HTMLElement =>
      n instanceof HTMLElement && !n.matches(".sheet, .sheet-backdrop, .notice, .toast"),
  );
}

/**
 * Build a modal bottom sheet and put it on the page: named by its title,
 * closable with Escape, the backdrop or its own close button, and with the
 * page behind it made inert so Tab stays inside (SHIG 60, 42). Focus lands
 * on the sheet and returns to the opener when the last sheet closes.
 *
 * `animate: false` swaps a sheet in place without replaying the slide-up.
 */
export function openSheet(opts: {
  title: string;
  closeLabel: string;
  animate?: boolean;
}): { backdrop: HTMLElement; sheet: HTMLElement; close(): void } {
  const enter = opts.animate === false ? " no-enter" : "";
  const titleId = `sheet-title-${++sheetSeq}`;
  const backdrop = el("div", { class: `sheet-backdrop${enter}`, onclick: close });
  const sheet = el("div", {
    class: `sheet${enter}`,
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": titleId,
    tabindex: "-1",
    onkeydown: (ev: Event) => {
      if ((ev as KeyboardEvent).key !== "Escape") return;
      ev.stopPropagation();
      close();
    },
  });
  sheet.append(
    el(
      "div",
      { class: "sheet-head" },
      el("h2", { id: titleId }, opts.title),
      el(
        "button",
        {
          type: "button",
          class: "sheet-close",
          "aria-label": opts.closeLabel,
          title: opts.closeLabel,
          onclick: close,
        },
        "✕",
      ),
    ),
  );

  function close(): void {
    closeSheet(backdrop, sheet);
  }

  // A sheet rebuilt in place has already removed its predecessor, leaving
  // focus on body; the original opener is kept for that case.
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body && !active.closest(".sheet")) {
    sheetOpener = active;
  }
  for (const node of pageChrome()) node.setAttribute("inert", "");
  document.body.append(backdrop, sheet);
  sheet.focus();
  return { backdrop, sheet, close };
}

/**
 * Dismiss a bottom sheet, letting the exit animation finish first. Shared by
 * every `.sheet` (settings, house editor, insolation results).
 */
export function closeSheet(backdrop: HTMLElement, sheet: HTMLElement): void {
  if (sheet.classList.contains("closing")) return;
  backdrop.classList.add("closing");
  sheet.classList.add("closing");
  const done = (): void => {
    backdrop.remove();
    sheet.remove();
    if (document.querySelector(".sheet") !== null) return;
    for (const node of pageChrome()) node.removeAttribute("inert");
    const opener = sheetOpener;
    sheetOpener = null;
    if (opener?.isConnected) opener.focus();
  };
  sheet.addEventListener("animationend", done, { once: true });
  // An animation can be skipped entirely (a hidden tab never runs one), so
  // never leave the sheet stuck open waiting for an event.
  window.setTimeout(done, 400);
}
