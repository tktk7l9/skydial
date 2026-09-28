// Bottom-sheet editor for the parametric house model. Every committed change
// runs through clampHouse and ctx.setHouse, so the 3D layer, URL and
// localStorage stay in sync while the sheet is open.
//
// SHIG: removals run at once and offer undo (57, 54); remove buttons sit on
// each row card's corner, away from the inputs (16, 13, 78); a value the
// clamp adjusted says so next to the field (38, 55).

import { HOUSE_LIMITS, clampHouse, defaultHouse } from "../../sunsim/house";
import type { HouseModel, Obstacle, WindowSpec } from "../../sunsim/house";
import { faceAzimuth } from "../../sunsim/geometry";
import type { AppCtx } from "../../app";
import { closeSheet, el } from "../../ui/dom";
import { showToast } from "../../ui/toast";
import type { MsgKey } from "../../i18n/keys";

export function openHouseEditor(ctx: AppCtx): void {
  const initial = ctx.store.get().house;
  if (initial === null) return;
  let model: HouseModel = initial;

  const backdrop = el("div", { class: "sheet-backdrop", onclick: close });
  const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true" });
  const body = el("div", {});

  function close(): void {
    closeSheet(backdrop, sheet);
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

  /** Apply a structural change right away and offer to take it back. */
  function applyWithUndo(next: HouseModel, messageKey: MsgKey): void {
    const before = model;
    notes.clear(); // row indices shift, so per-field notes no longer line up
    applyRebuild(next);
    showToast({
      message: ctx.tr(messageKey),
      actionLabel: ctx.tr("undo"),
      onAction: () => {
        ctx.setHouse(before);
        if (sheet.isConnected) {
          model = before;
          render();
        }
      },
    });
  }

  /** Notes for values the clamp adjusted, keyed by field id; survive re-renders. */
  const notes = new Map<string, string>();

  interface Range {
    lo: number;
    hi: number;
  }
  const range = ([lo, hi]: readonly [number, number]): Range => ({ lo, hi });
  const DEG: Range = { lo: 0, hi: 359 };

  function numField(
    id: string,
    labelKey: MsgKey,
    value: number,
    step: number,
    onCommit: (v: number) => void,
    limits: Range,
    readBack: () => number | undefined,
    width = 88,
  ): HTMLElement {
    const input = el("input", {
      type: "number",
      inputmode: "decimal",
      step: String(step),
      value: String(value),
      class: "num-input",
      onchange: () => {
        const entered = Number(input.value);
        notes.delete(id);
        onCommit(entered);
        const applied = readBack();
        if (applied !== undefined && applied !== entered) {
          notes.set(
            id,
            ctx.tr("hClamped", { lo: limits.lo, hi: limits.hi, v: applied }),
          );
        }
        // Structural fields re-render on commit; patch-only fields do not.
        if (input.isConnected) renderNote();
      },
    }) as HTMLInputElement;
    input.style.width = `${width}px`;
    const note = el("span", { class: "field-note", role: "status" });
    const renderNote = (): void => {
      const text = notes.get(id);
      note.textContent = text ?? "";
      note.hidden = text === undefined;
      input.setAttribute("aria-invalid", String(text !== undefined));
      if (text !== undefined) input.value = String(readBack());
    };
    renderNote();
    return el(
      "label",
      { class: "num-field" },
      el("span", { class: "lbl" }, ctx.tr(labelKey)),
      input,
      note,
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

  /** 44px remove button pinned to the row card's top-right corner. */
  function removeButton(label: string, onRemove: () => void): HTMLElement {
    return el(
      "button",
      { type: "button", class: "remove-btn", "aria-label": label, title: label, onclick: onRemove },
      ctx.tr("hRemove"),
    );
  }

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
    const L = HOUSE_LIMITS;
    const num = (
      key: MsgKey,
      field: keyof Omit<WindowSpec, "face">,
      step: number,
      limits: readonly [number, number],
    ): HTMLElement =>
      numField(
        `w${idx}:${field}`,
        key,
        w[field],
        step,
        (v) => patch({ [field]: v }),
        range(limits),
        () => model.windows[idx]?.[field],
        64,
      );
    return el(
      "div",
      { class: "row-strip item-card" },
      el("label", { class: "num-field" }, el("span", { class: "lbl" }, ctx.tr("hFace")), faceSel),
      num("hWinW", "w", 0.05, L.windowW),
      num("hWinH", "h", 0.05, L.windowH),
      num("hSill", "sill", 0.05, L.sill),
      num("hOff", "off", 0.1, L.off),
      num("hShgc", "shgc", 0.01, L.shgc),
      removeButton(ctx.tr("hRemoveWindow", { n: idx + 1 }), () =>
        applyWithUndo(
          { ...model, windows: model.windows.filter((_, i) => i !== idx) },
          "windowRemoved",
        ),
      ),
    );
  }

  function obstacleRow(o: Obstacle, idx: number): HTMLElement {
    const patch = (p: Partial<Obstacle>): void => {
      const obstacles = model.obstacles.slice();
      obstacles[idx] = { ...obstacles[idx], ...p };
      apply({ ...model, obstacles });
    };
    const L = HOUSE_LIMITS;
    const num = (
      key: MsgKey,
      field: keyof Obstacle,
      step: number,
      limits: Range,
    ): HTMLElement =>
      numField(
        `o${idx}:${field}`,
        key,
        o[field],
        step,
        (v) => patch({ [field]: v }),
        limits,
        () => model.obstacles[idx]?.[field],
        64,
      );
    return el(
      "div",
      { class: "row-strip item-card" },
      num("hObsX", "x", 0.5, range(L.obstacleXY)),
      num("hObsY", "y", 0.5, range(L.obstacleXY)),
      num("hObsW", "w", 0.5, range(L.obstacleWD)),
      num("hObsD", "d", 0.5, range(L.obstacleWD)),
      num("hObsH", "h", 0.5, range(L.obstacleH)),
      num("hRot", "rotDeg", 5, DEG),
      removeButton(ctx.tr("hRemoveObstacle", { n: idx + 1 }), () =>
        applyWithUndo(
          { ...model, obstacles: model.obstacles.filter((_, i) => i !== idx) },
          "obstacleRemoved",
        ),
      ),
    );
  }

  type TopField = "width" | "depth" | "eaveH" | "eaveOut" | "azimuthDeg" | "albedo" | "turbidity";
  function top(key: MsgKey, field: TopField, step: number, limits: Range): HTMLElement {
    return numField(
      field,
      key,
      model[field],
      step,
      (v) => applyRebuild({ ...model, [field]: v }),
      limits,
      () => model[field],
    );
  }

  function render(): void {
    body.replaceChildren();

    body.append(
      el(
        "div",
        { class: "row-strip" },
        top("hWidth", "width", 0.1, range(HOUSE_LIMITS.width)),
        top("hDepth", "depth", 0.1, range(HOUSE_LIMITS.depth)),
        top("hEaveH", "eaveH", 0.1, range(HOUSE_LIMITS.eaveH)),
        top("hEaveOut", "eaveOut", 0.05, range(HOUSE_LIMITS.eaveOut)),
        top("hAzimuth", "azimuthDeg", 5, DEG),
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
        numField(
          "pitch",
          "hPitch",
          roof.pitchSun,
          0.5,
          (v) => applyRebuild({ ...model, roof: { ...roof, pitchSun: v } }),
          range(HOUSE_LIMITS.pitchSun),
          () => (model.roof.kind === "flat" ? undefined : model.roof.pitchSun),
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
        top("hAlbedo", "albedo", 0.05, range(HOUSE_LIMITS.albedo)),
        top("hTurbidity", "turbidity", 0.1, range(HOUSE_LIMITS.turbidity)),
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

    // Reset lives at the very end, apart from everyday controls (16), and is
    // undoable like any other structural change (54).
    body.append(
      el(
        "div",
        { class: "danger-zone" },
        el(
          "button",
          {
            type: "button",
            class: "btn",
            onclick: () => {
              applyWithUndo(clampHouse(defaultHouse()), "houseResetDone");
            },
          },
          ctx.tr("hReset"),
        ),
      ),
    );
  }

  sheet.append(el("h2", {}, ctx.tr("houseEditTitle")), body);
  render();
  document.body.append(backdrop, sheet);
}
