// "Use my location" button with in-place progress and a constructive failure
// message next to it (SHIG 58, 55, 66): the button says it is locating and
// cannot be pressed twice; on failure it points to the map instead. A fix
// that replaces a place the user had set is undoable, like a map pick
// (SHIG 54, 57).

import type { AppCtx } from "../app";
import { locationSnapshot } from "../state/appState";
import { el } from "./dom";
import { showToast } from "./toast";

export function createGpsControl(
  ctx: AppCtx,
  opts: {
    primary?: boolean;
    /** false where the map is already on screen (the link would do nothing). */
    mapLink?: boolean;
    onLocated?: () => void;
    onOpenMap?: () => void;
  } = {},
): HTMLElement {
  const label = ctx.tr("useGps");
  const status = el("p", { class: "gps-status", role: "status", "aria-live": "polite" });
  status.hidden = true;
  const button = el(
    "button",
    {
      type: "button",
      class: opts.primary === false ? "btn" : "btn primary",
      onclick: () => {
        button.disabled = true;
        button.textContent = ctx.tr("gpsLocating");
        button.setAttribute("aria-busy", "true");
        status.hidden = true;
        const before = locationSnapshot(ctx.store.get());
        void ctx.requestGps().then((ok) => {
          button.disabled = false;
          button.textContent = label;
          button.removeAttribute("aria-busy");
          if (ok) {
            // The first fix replaces only the built-in default; nothing to undo.
            if (before.locationSource !== "default") {
              showToast({
                message: ctx.tr("locationChanged"),
                actionLabel: ctx.tr("undo"),
                onAction: () => ctx.restoreLocation(before),
              });
            }
            opts.onLocated?.();
            return;
          }
          status.replaceChildren(el("span", {}, ctx.tr("gpsDenied")));
          if (opts.mapLink !== false) {
            status.append(
              el(
                "button",
                {
                  type: "button",
                  class: "link-btn",
                  onclick: () => {
                    ctx.store.set({ tab: "map" });
                    opts.onOpenMap?.();
                  },
                },
                ctx.tr("openMap"),
              ),
            );
          }
          status.hidden = false;
        });
      },
    },
    label,
  );
  return el("div", { class: "gps-control" }, button, status);
}
