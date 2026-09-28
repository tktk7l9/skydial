import { clampHouse, defaultHouse } from "../sunsim/house";
import type { HouseModel } from "../sunsim/house";
import { encodeHouse } from "../sunsim/houseCodec";
import {
  HOUSE_KEY,
  HOUSE_VISIBLE_KEY,
  hideHouse,
  houseToShow,
  loadVisibleHouse,
  saveHouse,
} from "./housePrefs";

function memoryStorage(initial: Record<string, string> = {}): {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  dump(): Record<string, string>;
} {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
}

function edited(): HouseModel {
  const base = clampHouse(defaultHouse());
  return clampHouse({
    ...base,
    width: 14,
    windows: base.windows.slice(0, 2),
    obstacles: [{ x: 5, y: -20, w: 6, d: 6, h: 9, rotDeg: 30 }],
  });
}

describe("housePrefs", () => {
  it("regression: hiding the house keeps the edited windows and obstacles", () => {
    const storage = memoryStorage();
    const model = edited();
    saveHouse(storage, model);
    hideHouse(storage);

    // The model survives in storage…
    expect(storage.getItem(HOUSE_KEY)).toBe(encodeHouse(model));
    // …and turning the chip back on restores it rather than the default.
    expect(houseToShow(storage, null)).toEqual(model);
  });

  it("does not show a hidden house on the next launch", () => {
    const storage = memoryStorage();
    saveHouse(storage, edited());
    hideHouse(storage);
    expect(loadVisibleHouse(storage)).toBeNull();
  });

  it("shows the saved house on launch when it was left visible", () => {
    const storage = memoryStorage();
    const model = edited();
    saveHouse(storage, model);
    expect(storage.getItem(HOUSE_VISIBLE_KEY)).toBe("1");
    expect(loadVisibleHouse(storage)).toEqual(model);
  });

  it("treats a model saved before the visibility flag existed as visible", () => {
    const model = edited();
    const storage = memoryStorage({ [HOUSE_KEY]: encodeHouse(model) });
    expect(loadVisibleHouse(storage)).toEqual(model);
  });

  it("returns null on launch when nothing (or garbage) is stored", () => {
    expect(loadVisibleHouse(memoryStorage())).toBeNull();
    expect(loadVisibleHouse(memoryStorage({ [HOUSE_KEY]: "not-a-house" }))).toBeNull();
  });

  it("prefers the model hidden in this session (e.g. from a shared link)", () => {
    const storage = memoryStorage();
    saveHouse(storage, clampHouse(defaultHouse()));
    const shared = edited();
    expect(houseToShow(storage, shared)).toEqual(shared);
  });

  it("falls back to the default model when nothing usable is stored", () => {
    expect(houseToShow(memoryStorage(), null)).toEqual(clampHouse(defaultHouse()));
    expect(houseToShow(memoryStorage({ [HOUSE_KEY]: "garbage" }), null)).toEqual(
      clampHouse(defaultHouse()),
    );
  });
});
