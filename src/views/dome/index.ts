import type { AppCtx, View } from "../../app";
import { el } from "../../ui/dom";

export function createDomeView(ctx: AppCtx): View {
  const root = el(
    "div",
    { class: "view-fill" },
    el("div", { class: "card view-center-card" }, el("p", {}, ctx.tr("domeDragHint"))),
  );
  return { root, update: () => {} };
}
