// Transient notice with an optional undo action. Destructive-looking actions
// run immediately and offer a way back instead of asking first (SHIG 57, 54).
// The notice stays while it is hovered or focused, so the undo cannot time out
// under a keyboard or pointer user who is about to press it.

import { el } from "./dom";

const DEFAULT_MS = 5000;
let current: { root: HTMLElement; timer: number } | null = null;

export function dismissToast(): void {
  if (current === null) return;
  clearTimeout(current.timer);
  current.root.remove();
  current = null;
}

export function showToast(opts: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}): void {
  dismissToast();
  const duration = opts.durationMs ?? DEFAULT_MS;
  const root = el(
    "div",
    { class: "notice", role: "status", "aria-live": "polite" },
    el("span", { class: "notice-msg" }, opts.message),
  );
  if (opts.actionLabel !== undefined && opts.onAction !== undefined) {
    const onAction = opts.onAction;
    root.append(
      el(
        "button",
        {
          type: "button",
          class: "notice-action",
          onclick: () => {
            dismissToast();
            onAction();
          },
        },
        opts.actionLabel,
      ),
    );
  }
  const entry = { root, timer: 0 };
  const hold = (): void => clearTimeout(entry.timer);
  const release = (): void => {
    clearTimeout(entry.timer);
    if (current !== entry) return; // already dismissed or replaced
    if (root.matches(":hover") || root.contains(document.activeElement)) return;
    entry.timer = window.setTimeout(dismissToast, duration);
  };
  root.addEventListener("pointerenter", hold);
  root.addEventListener("focusin", hold);
  root.addEventListener("pointerleave", release);
  root.addEventListener("focusout", () => setTimeout(release, 0));
  document.body.append(root);
  current = entry;
  release();
}
