import { clampHouse, defaultHouse } from "../sunsim/house";
import type { HouseModel } from "../sunsim/house";
import { describeAdjustment, restoreRemoved } from "./houseEdit";

function base(): HouseModel {
  return clampHouse(defaultHouse());
}

describe("restoreRemoved", () => {
  it("regression: undoing a removal keeps edits made after it", () => {
    const start = base();
    const removed = start.windows[1];
    const afterRemove = { ...start, windows: start.windows.filter((_, i) => i !== 1) };
    // The user widens the house while the undo notice is still showing.
    const edited = { ...afterRemove, width: 12 };

    const restored = restoreRemoved(edited, { kind: "window", index: 1, item: removed });

    expect(restored.width).toBe(12);
    expect(restored.windows).toEqual(start.windows);
  });

  it("puts an obstacle back at its old index", () => {
    const start = {
      ...base(),
      obstacles: [
        { x: 1, y: -10, w: 2, d: 2, h: 3, rotDeg: 0 },
        { x: 2, y: -20, w: 4, d: 4, h: 6, rotDeg: 45 },
      ],
    };
    const removed = start.obstacles[0];
    const after = { ...start, obstacles: start.obstacles.slice(1) };
    expect(restoreRemoved(after, { kind: "obstacle", index: 0, item: removed })).toEqual(start);
  });

  it("appends when the old index is now past the end of the list", () => {
    const start = base();
    const item = start.windows[0];
    const empty = { ...start, windows: [] };
    expect(restoreRemoved(empty, { kind: "window", index: 5, item }).windows).toEqual([item]);
  });

  it("does not mutate the model it is given", () => {
    const start = base();
    const before = JSON.stringify(start);
    restoreRemoved(start, { kind: "window", index: 0, item: start.windows[0] });
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe("describeAdjustment", () => {
  it("is null when the value was kept", () => {
    expect(describeAdjustment(5, 5, 0, 10)).toBeNull();
  });

  it("reports an out-of-range or non-numeric entry as a range problem", () => {
    expect(describeAdjustment(40, 30, 2, 30)).toBe("range");
    expect(describeAdjustment(1, 2, 2, 30)).toBe("range");
    expect(describeAdjustment(Number.NaN, 10, 2, 30)).toBe("range");
  });

  it("reports an in-range entry that was only rounded as rounded, not out of range", () => {
    // Azimuth 12.5° is legal but stored as a whole degree.
    expect(describeAdjustment(12.5, 13, 0, 359)).toBe("rounded");
  });
});
