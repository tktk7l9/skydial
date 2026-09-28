// Transient notice with an optional undo action. Destructive-looking actions
// run immediately and offer a way back instead of asking first (SHIG 57, 54).

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
  document.body.append(root);
  current = { root, timer: window.setTimeout(dismissToast, opts.durationMs ?? DEFAULT_MS) };
}
