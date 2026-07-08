import { buildHouseGeometry, sunDirection } from "./geometry";
import { directShadeFraction, skyViewFactorRatio } from "./shading";
import { plainHouse } from "./geometry.test";

// Flat-roof house, depth 8 (south wall at z=+4), eave height 3.

describe("directShadeFraction — eave (flat slab, analytic boundary)", () => {
  // Slab overhangs 1 m; a point at height y on the south wall is shaded iff
  // tan(alt) > (3 − y) / 1. Tiny window centred at y=2 → boundary 45°.
  const m = plainHouse({
    eaveOut: 1,
    windows: [{ face: 0, w: 0.2, h: 0.2, sill: 1.9, off: 4.9, shgc: 0.6 }],
  });
  const g = buildHouseGeometry(m);

  it("sun below the profile angle reaches the window", () => {
    expect(directShadeFraction(g.windows[0], sunDirection(180, 40), g.triangles)).toBe(1);
  });

  it("sun above the profile angle is cut by the eave", () => {
    expect(directShadeFraction(g.windows[0], sunDirection(180, 50), g.triangles)).toBe(0);
  });

  it("a full-height window is partially shaded, top rows first", () => {
    const tall = plainHouse({
      eaveOut: 1,
      windows: [{ face: 0, w: 1.69, h: 2.0, sill: 0, off: 4, shgc: 0.6 }],
    });
    const gt = buildHouseGeometry(tall);
    // At alt 50°: shade line at y = 3 − tan50° ≈ 1.81 m. 6 sample rows at
    // y = 0.167…1.833 → exactly the top row is shaded → 5/6 visible.
    const f = directShadeFraction(gt.windows[0], sunDirection(180, 50), gt.triangles);
    expect(f).toBeCloseTo(5 / 6, 9);
  });
});

describe("directShadeFraction — neighbor box (analytic boundary)", () => {
  // 6.5 m-tall neighbor with its near face 6 m south of the wall; a window
  // point at y=1 is blocked iff tan(alt) < (6.5−1)/6 → alt < 42.5°.
  const m = plainHouse({
    windows: [{ face: 0, w: 0.2, h: 0.2, sill: 0.9, off: 4.9, shgc: 0.6 }],
    obstacles: [{ x: 0, y: -(8 / 2 + 6 + 4), w: 8, d: 8, h: 6.5, rotDeg: 0 }],
  });
  const g = buildHouseGeometry(m);

  it("low sun is blocked by the neighbor", () => {
    expect(directShadeFraction(g.windows[0], sunDirection(180, 35), g.triangles)).toBe(0);
  });

  it("high sun clears the neighbor", () => {
    expect(directShadeFraction(g.windows[0], sunDirection(180, 50), g.triangles)).toBe(1);
  });

  it("sun from a flanking azimuth misses the box entirely", () => {
    // Box spans ±4 m at ~6 m → ±34°; az 120 (60° off-south) clears it.
    expect(directShadeFraction(g.windows[0], sunDirection(120, 20), g.triangles)).toBe(1);
  });

  it("sun behind the wall yields 0 without raycasting", () => {
    expect(directShadeFraction(g.windows[0], sunDirection(0, 30), g.triangles)).toBe(0);
  });
});

describe("skyViewFactorRatio", () => {
  const window = { face: 0 as const, w: 1.65, h: 1.1, sill: 0.9, off: 4, shgc: 0.6 };

  it("unobstructed wall window sees the full front half-dome (=1)", () => {
    const g = buildHouseGeometry(plainHouse({ windows: [window] }));
    expect(skyViewFactorRatio(g.windows[0], g.triangles)).toBe(1);
  });

  it("a deep eave trims the high sky", () => {
    const g = buildHouseGeometry(plainHouse({ eaveOut: 1.5, windows: [window] }));
    const r = skyViewFactorRatio(g.windows[0], g.triangles);
    expect(r).toBeLessThan(0.95);
    expect(r).toBeGreaterThan(0.5);
  });

  it("a looming wall right in front blots out most of the sky", () => {
    const g = buildHouseGeometry(
      plainHouse({
        windows: [window],
        obstacles: [{ x: 0, y: -(4 + 0.5 + 2), w: 40, d: 1, h: 30, rotDeg: 0 }],
      }),
    );
    expect(skyViewFactorRatio(g.windows[0], g.triangles)).toBeLessThan(0.2);
  });

  it("eave + neighbor stack multiplicatively-ish (monotone decrease)", () => {
    const open = buildHouseGeometry(plainHouse({ windows: [window] }));
    const eave = buildHouseGeometry(plainHouse({ eaveOut: 1, windows: [window] }));
    const both = buildHouseGeometry(
      plainHouse({
        eaveOut: 1,
        windows: [window],
        obstacles: [{ x: 0, y: -14, w: 8, d: 8, h: 6.5, rotDeg: 0 }],
      }),
    );
    const rOpen = skyViewFactorRatio(open.windows[0], open.triangles);
    const rEave = skyViewFactorRatio(eave.windows[0], eave.triangles);
    const rBoth = skyViewFactorRatio(both.windows[0], both.triangles);
    expect(rEave).toBeLessThan(rOpen);
    expect(rBoth).toBeLessThan(rEave);
  });
});
