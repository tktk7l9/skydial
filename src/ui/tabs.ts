import type { AppState, Tab } from "../state/appState";
import type { AppCtx } from "../app";
import { el } from "./dom";
import { svgIcon } from "./icons";
import type { IconName } from "./icons";
import type { MsgKey } from "../i18n/keys";

const TAB_DEFS: ReadonlyArray<{ tab: Tab; icon: IconName; label: MsgKey }> = [
  { tab: "dashboard", icon: "sunHorizon", label: "tabDashboard" },
  { tab: "dome", icon: "dome", label: "tabDome" },
  { tab: "map", icon: "map", label: "tabMap" },
  { tab: "ar", icon: "ar", label: "tabAr" },
];

export function createTabbar(ctx: AppCtx): { root: HTMLElement; update(s: AppState): void } {
  const buttons = new Map<Tab, HTMLButtonElement>();
  const root = el("nav", { class: "tabbar", "aria-label": "tabs" });
  for (const def of TAB_DEFS) {
    const btn = el("button", {
      type: "button",
      onclick: () => ctx.store.set({ tab: def.tab }),
    });
    btn.innerHTML = svgIcon(def.icon);
    btn.append(el("span", {}, ctx.tr(def.label)));
    buttons.set(def.tab, btn);
    root.append(btn);
  }
  return {
    root,
    update(s) {
      for (const [tab, btn] of buttons) {
        btn.classList.toggle("active", tab === s.tab);
        btn.setAttribute("aria-current", tab === s.tab ? "page" : "false");
      }
    },
  };
}
