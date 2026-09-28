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
import { describeAdjustment, restoreRemoved } from "../../state/houseEdit";
import type { RemovedItem } from "../../state/houseEdit";
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

  // A field commits on blur, so rebuilding synchronously would destroy the
  // control Tab is moving to. Rebuild after focus has settled instead; render()
  // then puts focus back on the same control by its data-fid.
  let renderTimer = 0;
  function scheduleRender(): void {
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      if (sheet.isConnected) render();
    }, 0);
  }

  /** Move focus to the first control (by data-fid) that exists. */
  function focusFirst(fids: string[]): void {
    for (const fid of fids) {
      const target = body.querySelector<HTMLElement>(`[data-fid="${fid}"]`);
      if (target !== null) {
        target.focus();
        // Tab selects a field's value; keep that so typing replaces it.
        if (target instanceof HTMLInputElement) target.select();
        return;
      }
    }
  }

  /**
   * Apply a structural change right away and offer to take it back (54, 57).
   * `undoFrom` rebuilds the pre-change model from the *current* one, so edits
   * made while the notice is showing are not thrown away by the undo.
   */
  function applyWithUndo(
    next: HouseModel,
    messageKey: MsgKey,
    undoFrom: (current: HouseModel) => HouseModel,
    focusAfterUndo: string[],
  ): void {
    notes.clear(); // row indices shift, so per-field notes no longer line up
    applyRebuild(next);
    showToast({
      message: ctx.tr(messageKey),
      actionLabel: ctx.tr("undo"),
      onAction: () => {
        const restored = clampHouse(undoFrom(ctx.store.get().house ?? model));
        ctx.setHouse(restored);
        if (sheet.isConnected) {
          model = restored;
          notes.clear();
          render();
          focusFirst(focusAfterUndo);
        }
      },
    });
  }

  function removeItem(removed: RemovedItem): void {
    const { kind, index } = removed;
    const p = kind === "window" ? "w" : "o";
    applyWithUndo(
      kind === "window"
        ? { ...model, windows: model.windows.filter((_, i) => i !== index) }
        : { ...model, obstacles: model.obstacles.filter((_, i) => i !== index) },
      kind === "window" ? "windowRemoved" : "obstacleRemoved",
      (current) => restoreRemoved(current, removed),
      [`rm-${p}${index}`],
    );
    // Keep keyboard users in place: the next row's remove button, else the
    // previous one, else the "add" button of that list.
    focusFirst([`rm-${p}${index}`, `rm-${p}${index - 1}`, `add-${p}`]);
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
      "data-fid": id,
      onchange: () => {
        // An emptied field means "no value", not 0.
        const entered = input.value.trim() === "" ? Number.NaN : Number(input.value);
        notes.delete(id);
        onCommit(entered);
        const applied = readBack();
        const adjustment =
          applied === undefined ? null : describeAdjustment(entered, applied, limits.lo, limits.hi);
        if (adjustment === "range") {
          notes.set(id, ctx.tr("hClamped", { lo: limits.lo, hi: limits.hi, v: applied ?? "" }));
        } else if (adjustment === "rounded") {
          notes.set(id, ctx.tr("hRounded", { v: applied ?? "" }));
        }
        renderNote();
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
    fid: string,
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
            "data-fid": `${fid}:${c.value}`,
            "aria-pressed": String(c.value === current),
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
  function removeButton(fid: string, label: string, onRemove: () => void): HTMLElement {
    return el(
      "button",
      {
        type: "button",
        class: "remove-btn",
        "data-fid": fid,
        "aria-label": label,
        title: label,
        onclick: onRemove,
      },
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
      "data-fid": `w${idx}:face`,
      "aria-label": ctx.tr("hFace"),
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
      removeButton(`rm-w${idx}`, ctx.tr("hRemoveWindow", { n: idx + 1 }), () =>
        removeItem({ kind: "window", index: idx, item: w }),
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
      removeButton(`rm-o${idx}`, ctx.tr("hRemoveObstacle", { n: idx + 1 }), () =>
        removeItem({ kind: "obstacle", index: idx, item: o }),
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
      (v) => {
        apply({ ...model, [field]: v });
        scheduleRender(); // azimuth relabels the window faces
      },
      limits,
      () => model[field],
    );
  }

  function render(): void {
    const active = document.activeElement;
    const keepFocus =
      active instanceof HTMLElement && body.contains(active) ? active.dataset.fid : undefined;
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
        "roof",
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
          (v) => {
            apply({ ...model, roof: { ...roof, pitchSun: v } });
            scheduleRender();
          },
          range(HOUSE_LIMITS.pitchSun),
          () => (model.roof.kind === "flat" ? undefined : model.roof.pitchSun),
        ),
      );
      if (roof.kind === "gable") {
        detail.append(
          el("span", { class: "lbl" }, ctx.tr("hRidgeAxis")),
          pills(
            "ridge",
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
            "low",
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
          "data-fid": "add-w",
          disabled: model.windows.length >= HOUSE_LIMITS.maxWindows,
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
          "data-fid": "add-o",
          disabled: model.obstacles.length >= HOUSE_LIMITS.maxObstacles,
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
            "data-fid": "reset",
            onclick: () => {
              const before = model;
              applyWithUndo(clampHouse(defaultHouse()), "houseResetDone", () => before, [
                "reset",
              ]);
            },
          },
          ctx.tr("hReset"),
        ),
      ),
    );

    if (keepFocus !== undefined) focusFirst([keepFocus]);
  }

  sheet.append(el("h2", {}, ctx.tr("houseEditTitle")), body);
  render();
  document.body.append(backdrop, sheet);
}
