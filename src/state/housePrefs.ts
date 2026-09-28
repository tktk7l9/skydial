// Persistence for the insolation-study house. "Shown" and "kept" are separate:
// hiding the house only flips a visibility flag, so the user's edited windows
// and obstacles are never thrown away by a display toggle (SHIG 38, 54).

import { clampHouse, defaultHouse } from "../sunsim/house";
import type { HouseModel } from "../sunsim/house";
import { decodeHouse, encodeHouse } from "../sunsim/houseCodec";

export const HOUSE_KEY = "skydial:house";
export const HOUSE_VISIBLE_KEY = "skydial:house-visible";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storedHouse(storage: Pick<Storage, "getItem">): HouseModel | null {
  const raw = storage.getItem(HOUSE_KEY);
  return raw === null ? null : decodeHouse(raw);
}

/** Persist the model and mark it as shown. */
export function saveHouse(storage: StorageLike, house: HouseModel): void {
  storage.setItem(HOUSE_KEY, encodeHouse(house));
  storage.setItem(HOUSE_VISIBLE_KEY, "1");
}

/** Hide the house without touching the saved model. */
export function hideHouse(storage: StorageLike): void {
  storage.setItem(HOUSE_VISIBLE_KEY, "0");
}

/** The house to show at launch: the saved model unless the user hid it. */
export function loadVisibleHouse(storage: Pick<Storage, "getItem">): HouseModel | null {
  if (storage.getItem(HOUSE_VISIBLE_KEY) === "0") return null;
  return storedHouse(storage);
}

/**
 * The model to bring back when the house is switched on again: the one hidden
 * in this session (it may have come from a shared link), else the saved one,
 * else the representative default.
 */
export function houseToShow(
  storage: Pick<Storage, "getItem">,
  lastHidden: HouseModel | null,
): HouseModel {
  return lastHidden ?? storedHouse(storage) ?? clampHouse(defaultHouse());
}
