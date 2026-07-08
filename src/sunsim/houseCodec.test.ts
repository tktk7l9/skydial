import { decodeHouse, encodeHouse } from "./houseCodec";
import { clampHouse, defaultHouse } from "./house";
import type { HouseModel } from "./house";

describe("houseCodec", () => {
  it("round-trips the default house exactly (cm/percent quantization)", () => {
    const m = defaultHouse();
    const decoded = decodeHouse(encodeHouse(m));
    expect(decoded).toEqual(m);
  });

  it("round-trips every roof kind and negative obstacle offsets", () => {
    const variants: HouseModel[] = [
      { ...defaultHouse(), roof: { kind: "flat" } },
      { ...defaultHouse(), roof: { kind: "gable", pitchSun: 5.5, ridgeAxis: "d" } },
      { ...defaultHouse(), roof: { kind: "shed", pitchSun: 1.5, lowSide: 3 } },
      {
        ...defaultHouse(),
        obstacles: [
          { x: -12.34, y: -25.5, w: 6, d: 4, h: 9.99, rotDeg: 315 },
          { x: 8.2, y: 15.75, w: 3, d: 3, h: 12, rotDeg: 0 },
        ],
      },
      { ...defaultHouse(), windows: [], obstacles: [] },
    ];
    for (const m of variants) {
      expect(decodeHouse(encodeHouse(m)), m.roof.kind).toEqual(m);
    }
  });

  it("URL-safe alphabet only (no percent-encoding needed)", () => {
    const s = encodeHouse(defaultHouse());
    expect(s).toMatch(/^[0-9a-z.]+$/);
    expect(encodeURIComponent(s)).toBe(s);
    expect(s.length).toBeLessThan(250);
  });

  it("rejects garbage without throwing", () => {
    for (const bad of [
      "",
      "not base36 !",
      "1", // header truncated
      "1.a.b", // header truncated
      "2." + encodeHouse(defaultHouse()).slice(2), // unknown version
      encodeHouse(defaultHouse()) + ".5", // trailing garbage
      "1.x!.y", // invalid token chars
      "1.zzzzzzzzzz.1.1.0.0.0.0.0.0.0.0.0.0", // token too long
    ]) {
      expect(decodeHouse(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("truncated window/obstacle lists decode to null", () => {
    const full = encodeHouse(defaultHouse());
    const tokens = full.split(".");
    expect(decodeHouse(tokens.slice(0, 15).join("."))).toBeNull();
    expect(decodeHouse(tokens.slice(0, tokens.length - 2).join("."))).toBeNull();
    // Cut exactly before the obstacle-count token.
    const empty = encodeHouse({ ...defaultHouse(), windows: [], obstacles: [] });
    const emptyTokens = empty.split(".");
    expect(decodeHouse(emptyTokens.slice(0, emptyTokens.length - 1).join("."))).toBeNull();
  });

  it("out-of-range decoded values are clamped, not rejected", () => {
    // width 99 m (9900 cm = '7n0' in base36) → clamped to 30.
    const m = { ...defaultHouse(), windows: [], obstacles: [] };
    const tokens = encodeHouse(m).split(".");
    tokens[1] = (9900).toString(36);
    const decoded = decodeHouse(tokens.join("."));
    expect(decoded).not.toBeNull();
    expect(decoded?.width).toBe(30);
    expect(decoded).toEqual(clampHouse({ ...m, width: 99 }));
  });

  it("roof kind beyond the schema decodes to null", () => {
    const tokens = encodeHouse(defaultHouse()).split(".");
    tokens[4] = "3";
    expect(decodeHouse(tokens.join("."))).toBeNull();
  });
});
