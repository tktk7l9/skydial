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
  };
  sheet.addEventListener("animationend", done, { once: true });
  // An animation can be skipped entirely (a hidden tab never runs one), so
  // never leave the sheet stuck open waiting for an event.
  window.setTimeout(done, 400);
}
