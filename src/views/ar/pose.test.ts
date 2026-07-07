import { deviceToWorld, poseFromSample } from "./pose";

const sample = (
  alpha: number | null,
  beta: number | null,
  gamma: number | null,
  absolute = true,
  webkitCompassHeading?: number,
): Parameters<typeof poseFromSample>[0] => ({
  alpha,
  beta,
  gamma,
  absolute,
  webkitCompassHeading,
});

describe("deviceToWorld", () => {
  it("identity at zero angles", () => {
    expect(deviceToWorld(0, 0, 0, [1, 0, 0])[0]).toBeCloseTo(1, 12);
    expect(deviceToWorld(0, 0, 0, [0, 1, 0])[1]).toBeCloseTo(1, 12);
    expect(deviceToWorld(0, 0, 0, [0, 0, 1])[2]).toBeCloseTo(1, 12);
  });

  it("beta=90 tips the device top toward the sky", () => {
    const top = deviceToWorld(0, 90, 0, [0, 1, 0]);
    expect(top[2]).toBeCloseTo(1, 9); // device top → world up
  });
});

describe("poseFromSample — upright portrait", () => {
  it("alpha=0 beta=90: camera looks north at the horizon, no roll", () => {
    const p = poseFromSample(sample(0, 90, 0), 0);
    expect(p).not.toBeNull();
    expect(p!.heading).toBeCloseTo(0, 6);
    expect(p!.pitch).toBeCloseTo(0, 6);
    expect(p!.roll).toBeCloseTo(0, 6);
  });

  it("alpha rotates the heading counterclockwise (compass = 360 − alpha)", () => {
    expect(poseFromSample(sample(90, 90, 0), 0)!.heading).toBeCloseTo(270, 6);
    expect(poseFromSample(sample(270, 90, 0), 0)!.heading).toBeCloseTo(90, 6);
  });

  it("beta above/below 90 pitches the view up/down", () => {
    expect(poseFromSample(sample(0, 120, 0), 0)!.pitch).toBeCloseTo(30, 6);
    expect(poseFromSample(sample(0, 60, 0), 0)!.pitch).toBeCloseTo(-30, 6);
  });

  it("device flat on the table: camera looks straight down", () => {
    const p = poseFromSample(sample(0, 0, 0), 0)!;
    expect(p.pitch).toBeCloseTo(-90, 6);
  });
});

describe("poseFromSample — tilted attitudes", () => {
  it("gamma at upright portrait pans the heading (yaw), not roll", () => {
    // With the device upright (β=90) its y-axis is vertical, so a γ turn is
    // a rotation about the world up axis: heading shifts, no roll appears.
    const p = poseFromSample(sample(0, 90, 20), 0)!;
    expect(p.heading).toBeCloseTo(340, 4);
    expect(Math.abs(p.pitch)).toBeLessThan(1e-6);
    expect(Math.abs(p.roll)).toBeLessThan(1e-6);
  });

  it("landscape attitude (α=270, β=0, γ=90): camera north, rolled 90°", () => {
    // Constructed so the view is the northern horizon with the device top
    // pointing east — a pure 90° roll of the physical device.
    const p = poseFromSample(sample(270, 0, 90), 0)!;
    expect(p.heading).toBeCloseTo(0, 4);
    expect(Math.abs(p.pitch)).toBeLessThan(1e-6);
    expect(p.roll).toBeCloseTo(90, 4);
  });

  it("screenAngle 90 cancels the roll once the UI rotates to landscape", () => {
    const p = poseFromSample(sample(270, 0, 90), 90)!;
    expect(Math.abs(p.roll)).toBeLessThan(1e-6);
    expect(p.heading).toBeCloseTo(0, 4);
  });
});

describe("poseFromSample — sources and degenerate input", () => {
  it("uses webkitCompassHeading as true heading on iOS", () => {
    const p = poseFromSample(sample(null, 90, 0, false, 45), 0)!;
    expect(p.heading).toBeCloseTo(45, 4);
  });

  it("returns null without absolute heading or without beta/gamma", () => {
    expect(poseFromSample(sample(120, 90, 0, false), 0)).toBeNull(); // relative alpha
    expect(poseFromSample(sample(null, 90, 0, true), 0)).toBeNull();
    expect(poseFromSample(sample(0, null, 0), 0)).toBeNull();
    expect(poseFromSample(sample(0, 90, null), 0)).toBeNull();
  });

  it("zenith view: heading defined, roll falls back to 0", () => {
    const p = poseFromSample(sample(0, 180, 0), 0)!;
    expect(p.pitch).toBeCloseTo(90, 5);
    expect(p.roll).toBe(0); // degenerate right-vector → clamped
  });
});
