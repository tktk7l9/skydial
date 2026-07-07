import { H_FOV, project, wrap180 } from "./projection";

const pose = { heading: 180, pitch: 0, roll: 0 };

describe("wrap180", () => {
  it("wraps into [-180, 180)", () => {
    expect(wrap180(190)).toBe(-170);
    expect(wrap180(-190)).toBe(170);
    expect(wrap180(0)).toBe(0);
    expect(wrap180(540)).toBe(-180);
  });
});

describe("project", () => {
  const W = 390;
  const H = 650;

  it("point dead ahead lands at screen center", () => {
    const p = project({ azimuth: 180, altitude: 0 }, pose, W, H);
    expect(p.x).toBeCloseTo(W / 2, 6);
    expect(p.y).toBeCloseTo(H / 2, 6);
    expect(p.visible).toBe(true);
  });

  it("azimuth offset of half the FOV reaches the screen edge", () => {
    const p = project({ azimuth: 180 + H_FOV / 2, altitude: 0 }, pose, W, H);
    expect(p.x).toBeCloseTo(W, 6);
    const left = project({ azimuth: 180 - H_FOV / 2, altitude: 0 }, pose, W, H);
    expect(left.x).toBeCloseTo(0, 6);
  });

  it("altitude above pitch moves up the screen (smaller y)", () => {
    const p = project({ azimuth: 180, altitude: 20 }, pose, W, H);
    expect(p.y).toBeLessThan(H / 2);
  });

  it("wraps around north: azimuth 350 seen from heading 10 is just left", () => {
    const p = project({ azimuth: 350, altitude: 0 }, { ...pose, heading: 10 }, W, H);
    expect(p.x).toBeLessThan(W / 2);
    expect(p.visible).toBe(true);
  });

  it("far-behind points are invisible", () => {
    const p = project({ azimuth: 0, altitude: 0 }, pose, W, H);
    expect(p.visible).toBe(false);
  });
});
