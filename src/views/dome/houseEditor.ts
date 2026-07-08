// Bottom-sheet editor for the parametric house model. Every committed change
// runs through clampHouse and ctx.setHouse, so the 3D layer, URL and
// localStorage stay in sync while the sheet is open.

import { clampHouse } from "../../sunsim/house";
import type { HouseModel, Obstacle, WindowSpec } from "../../sunsim/house";
import { faceAzimuth } from "../../sunsim/geometry";
import type { AppCtx } from "../../app";
import { el } from "../../ui/dom";
import type { MsgKey } from "../../i18n/keys";

export function openHouseEditor(ctx: AppCtx): void {
  const initial = ctx.store.get().house;
  if (initial === null) return;
  let model: HouseModel = initial;

  const backdrop = el("div", { class: "sheet-backdrop", onclick: close });
  const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true" });
  const body = el("div", {});

  function close(): void {
    backdrop.remove();
    sheet.remove();
  }

  function apply(next: HouseModel): void {
    model = clampHouse(next);
    ctx.setHouse(model);
  }

  /** Apply + rebuild the sheet (for structural changes). */
  function applyRebuild(next: HouseModel): void {
    apply(next);
    render();
  }

  function numField(
    labelKey: MsgKey,
    value: number,
    step: number,
    onCommit: (v: number) => void,
    width = 88,
  ): HTMLElement {
    const input = el("input", {
      type: "number",
      step: String(step),
      value: String(value),
      class: "num-input",
      onchange: () => onCommit(Number(input.value)),
    }) as HTMLInputElement;
    input.style.width = `${width}px`;
    return el(
      "label",
      { class: "num-field" },
      el("span", { class: "lbl" }, ctx.tr(labelKey)),
      input,
    );
  }

  function pills<T extends string | number>(
    current: T,
    choices: Array<{ value: T; label: string }>,
    onPick: (v: T) => void,
  ): HTMLElement {
    const group = el("div", { class: "pillgroup" });
    for (const c of choices) {
      group.append(
        el(
          "button",
          {
            type: "button",
            class: `pill${c.value === current ? " active" : ""}`,
            onclick: () => onPick(c.value),
          },
          c.label,
        ),
      );
    }
    return group;
  }

  const faceLabel = (i: 0 | 1 | 2 | 3): string => ctx.trDir(faceAzimuth(model, i));

  function windowRow(w: WindowSpec, idx: number): HTMLElement {
    const patch = (p: Partial<WindowSpec>): void => {
      const windows = model.windows.slice();
      windows[idx] = { ...windows[idx], ...p };
      apply({ ...model, windows });
    };
    const faceSel = el("select", {
      class: "num-input",
      onchange: () => patch({ face: Number(faceSel.value) as 0 | 1 | 2 | 3 }),
    }) as HTMLSelectElement;
    for (const f of [0, 1, 2, 3] as const) {
      faceSel.append(
        el("option", { value: String(f), ...(w.face === f ? { selected: true } : {}) }, faceLabel(f)),
      );
    }
    const num = (
      key: MsgKey,
      value: number,
      step: number,
      commit: (v: number) => void,
    ): HTMLElement => numField(key, value, step, commit, 64);
    return el(
      "div",
      { class: "row-strip" },
      el("label", { class: "num-field" }, el("span", { class: "lbl" }, ctx.tr("hFace")), faceSel),
      num("hWinW", w.w, 0.05, (v) => patch({ w: v })),
      num("hWinH", w.h, 0.05, (v) => patch({ h: v })),
      num("hSill", w.sill, 0.05, (v) => patch({ sill: v })),
      num("hOff", w.off, 0.1, (v) => patch({ off: v })),
      num("hShgc", w.shgc, 0.01, (v) => patch({ shgc: v })),
      el(
        "button",
        {
          type: "button",
          class: "pill",
          "aria-label": "remove",
          onclick: () =>
            applyRebuild({ ...model, windows: model.windows.filter((_, i) => i !== idx) }),
        },
        ctx.tr("hRemove"),
      ),
    );
  }

  function obstacleRow(o: Obstacle, idx: number): HTMLElement {
    const patch = (p: Partial<Obstacle>): void => {
      const obstacles = model.obstacles.slice();
      obstacles[idx] = { ...obstacles[idx], ...p };
      apply({ ...model, obstacles });
    };
    const num = (
      key: MsgKey,
      value: number,
      step: number,
      commit: (v: number) => void,
    ): HTMLElement => numField(key, value, step, commit, 64);
    return el(
      "div",
      { class: "row-strip" },
      num("hObsX", o.x, 0.5, (v) => patch({ x: v })),
      num("hObsY", o.y, 0.5, (v) => patch({ y: v })),
      num("hObsW", o.w, 0.5, (v) => patch({ w: v })),
      num("hObsD", o.d, 0.5, (v) => patch({ d: v })),
      num("hObsH", o.h, 0.5, (v) => patch({ h: v })),
      num("hRot", o.rotDeg, 5, (v) => patch({ rotDeg: v })),
      el(
        "button",
        {
          type: "button",
          class: "pill",
          "aria-label": "remove",
          onclick: () =>
            applyRebuild({
              ...model,
              obstacles: model.obstacles.filter((_, i) => i !== idx),
            }),
        },
        ctx.tr("hRemove"),
      ),
    );
  }

  function render(): void {
    body.replaceChildren();

    body.append(
      el(
        "div",
        { class: "row-strip" },
        numField("hWidth", model.width, 0.1, (v) => applyRebuild({ ...model, width: v })),
        numField("hDepth", model.depth, 0.1, (v) => applyRebuild({ ...model, depth: v })),
        numField("hEaveH", model.eaveH, 0.1, (v) => applyRebuild({ ...model, eaveH: v })),
        numField("hEaveOut", model.eaveOut, 0.05, (v) =>
          applyRebuild({ ...model, eaveOut: v }),
        ),
        numField("hAzimuth", model.azimuthDeg, 5, (v) =>
          applyRebuild({ ...model, azimuthDeg: v }),
        ),
      ),
    );

    // Roof
    const roofRow = el(
      "div",
      { class: "setting-row" },
      el("span", { class: "lbl" }, ctx.tr("hRoof")),
      pills(
        model.roof.kind,
        [
          { value: "flat" as const, label: ctx.tr("roofFlat") },
          { value: "gable" as const, label: ctx.tr("roofGable") },
          { value: "shed" as const, label: ctx.tr("roofShed") },
        ],
        (kind) =>
          applyRebuild({
            ...model,
            roof:
              kind === "flat"
                ? { kind }
                : kind === "gable"
                  ? { kind, pitchSun: 4, ridgeAxis: "w" }
                  : { kind, pitchSun: 2, lowSide: 0 },
          }),
      ),
    );
    body.append(roofRow);
    if (model.roof.kind !== "flat") {
      const roof = model.roof;
      const detail = el(
        "div",
        { class: "row-strip" },
        numField("hPitch", roof.pitchSun, 0.5, (v) =>
          applyRebuild({ ...model, roof: { ...roof, pitchSun: v } }),
        ),
      );
      if (roof.kind === "gable") {
        detail.append(
          el("span", { class: "lbl" }, ctx.tr("hRidgeAxis")),
          pills(
            roof.ridgeAxis,
            [
              { value: "w" as const, label: ctx.tr("ridgeW") },
              { value: "d" as const, label: ctx.tr("ridgeD") },
            ],
            (ridgeAxis) => applyRebuild({ ...model, roof: { ...roof, ridgeAxis } }),
          ),
        );
      } else {
        detail.append(
          el("span", { class: "lbl" }, ctx.tr("hLowSide")),
          pills(
            roof.lowSide,
            ([0, 1, 2, 3] as const).map((f) => ({ value: f, label: faceLabel(f) })),
            (lowSide) => applyRebuild({ ...model, roof: { ...roof, lowSide } }),
          ),
        );
      }
      body.append(detail);
    }

    body.append(
      el(
        "div",
        { class: "row-strip" },
        numField("hAlbedo", model.albedo, 0.05, (v) => applyRebuild({ ...model, albedo: v })),
        numField("hTurbidity", model.turbidity, 0.1, (v) =>
          applyRebuild({ ...model, turbidity: v }),
        ),
      ),
    );

    // Windows
    body.append(el("h2", {}, ctx.tr("hWindows")));
    model.windows.forEach((w, i) => body.append(windowRow(w, i)));
    body.append(
      el(
        "button",
        {
          type: "button",
          class: "btn",
          onclick: () =>
            applyRebuild({
              ...model,
              windows: [
                ...model.windows,
                { face: 0, w: 1.65, h: 1.1, sill: 0.9, off: 1, shgc: 0.6 },
              ],
            }),
        },
        ctx.tr("hAddWindow"),
      ),
    );

    // Obstacles
    body.append(el("h2", {}, ctx.tr("hObstacles")));
    model.obstacles.forEach((o, i) => body.append(obstacleRow(o, i)));
    body.append(
      el(
        "button",
        {
          type: "button",
          class: "btn",
          onclick: () =>
            applyRebuild({
              ...model,
              obstacles: [
                ...model.obstacles,
                { x: 0, y: -12, w: 8, d: 8, h: 6, rotDeg: 0 },
              ],
            }),
        },
        ctx.tr("hAddObstacle"),
      ),
    );
  }

  sheet.append(el("h2", {}, ctx.tr("houseEditTitle")), body);
  render();
  document.body.append(backdrop, sheet);
}
