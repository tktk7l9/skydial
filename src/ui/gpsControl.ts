// "Use my location" button with in-place progress and a constructive failure
// message next to it (SHIG 58, 55, 66): the button says it is locating and
// cannot be pressed twice; on failure it points to the map instead.

import type { AppCtx } from "../app";
import { el } from "./dom";

export function createGpsControl(
  ctx: AppCtx,
  opts: { primary?: boolean; onLocated?: () => void; onOpenMap?: () => void } = {},
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
        void ctx.requestGps().then((ok) => {
          button.disabled = false;
          button.textContent = label;
          button.removeAttribute("aria-busy");
          if (ok) {
            opts.onLocated?.();
            return;
          }
          status.replaceChildren(
            el("span", {}, ctx.tr("gpsDenied")),
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
          status.hidden = false;
        });
      },
    },
    label,
  );
  return el("div", { class: "gps-control" }, button, status);
}
