// Pure helpers behind the house editor's undo and field notes.
//
// Undo of a removal puts the removed item back into the *current* model, so
// edits made after the removal (while the undo notice is still up) survive
// (SHIG 54). A field note says why a value changed: out of range, or merely
// rounded/wrapped, so an in-range entry is never told it was out of range (55).

import type { HouseModel, Obstacle, WindowSpec } from "../sunsim/house";

export type RemovedItem =
  | { kind: "window"; index: number; item: WindowSpec }
  | { kind: "obstacle"; index: number; item: Obstacle };

function insertAt<T>(list: readonly T[], index: number, item: T): T[] {
  const at = Math.max(0, Math.min(index, list.length));
  return [...list.slice(0, at), item, ...list.slice(at)];
}

/** Put a removed window/obstacle back at (or as near as possible to) its old index. */
export function restoreRemoved(model: HouseModel, removed: RemovedItem): HouseModel {
  if (removed.kind === "window") {
    return { ...model, windows: insertAt(model.windows, removed.index, removed.item) };
  }
  return { ...model, obstacles: insertAt(model.obstacles, removed.index, removed.item) };
}

export type Adjustment = "range" | "rounded" | null;

/**
 * How the stored value differs from what was typed: null when it was kept,
 * "range" when the entry was outside [lo, hi] (or not a number), otherwise
 * "rounded" (e.g. an angle rounded to whole degrees).
 */
export function describeAdjustment(
  entered: number,
  applied: number,
  lo: number,
  hi: number,
): Adjustment {
  if (applied === entered) return null;
  if (!Number.isFinite(entered) || entered < lo || entered > hi) return "range";
  return "rounded";
}
