// Full-orientation pose math (pure). The W3C deviceorientation angles are
// intrinsic Z-X'-Y'' Tait-Bryan: R = Rz(α)·Rx(β)·Ry(γ) maps device
// coordinates (x right, y top, z out of screen) into world coordinates
// (x east, y north, z up). The rear camera looks along device −z; heading /
// pitch / roll of that view direction work in any device attitude — not
// just upright portrait.

export interface Pose {
  /** Compass heading the camera looks toward, degrees, N=0 clockwise. */
  heading: number;
  /** Camera pitch above the horizon, degrees. */
  pitch: number;
  /** Rotation of the screen's up direction vs the world's, degrees CW. */
  roll: number;
}

export interface OrientationSample {
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  absolute: boolean;
  /** iOS Safari: tilt-compensated compass heading (true north). */
  webkitCompassHeading?: number;
}

const DEG = Math.PI / 180;

type Vec3 = [number, number, number];

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Rotate a device-frame vector into the world frame. */
export function deviceToWorld(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  v: Vec3,
): Vec3 {
  const ca = Math.cos(alphaDeg * DEG);
  const sa = Math.sin(alphaDeg * DEG);
  const cb = Math.cos(betaDeg * DEG);
  const sb = Math.sin(betaDeg * DEG);
  const cg = Math.cos(gammaDeg * DEG);
  const sg = Math.sin(gammaDeg * DEG);
  // R = Rz(α)·Rx(β)·Ry(γ), expanded.
  const r11 = ca * cg - sa * sb * sg;
  const r12 = -sa * cb;
  const r13 = ca * sg + sa * sb * cg;
  const r21 = sa * cg + ca * sb * sg;
  const r22 = ca * cb;
  const r23 = sa * sg - ca * sb * cg;
  const r31 = -cb * sg;
  const r32 = sb;
  const r33 = cb * cg;
  return [
    r11 * v[0] + r12 * v[1] + r13 * v[2],
    r21 * v[0] + r22 * v[1] + r23 * v[2],
    r31 * v[0] + r32 * v[1] + r33 * v[2],
  ];
}

/**
 * Pose of the rear camera from an orientation sample. `screenAngleDeg` is
 * screen.orientation.angle (0/90/180/270). Returns null when the sample
 * carries no usable absolute heading.
 */
export function poseFromSample(
  s: OrientationSample,
  screenAngleDeg: number,
): Pose | null {
  if (s.beta === null || s.gamma === null) return null;
  let alpha: number;
  if (typeof s.webkitCompassHeading === "number") {
    // iOS: webkitCompassHeading is the device's tilt-compensated true
    // heading; the equivalent world-z rotation is its negation.
    alpha = 360 - s.webkitCompassHeading;
  } else if (s.absolute && s.alpha !== null) {
    alpha = s.alpha;
  } else {
    return null;
  }

  const view = deviceToWorld(alpha, s.beta, s.gamma, [0, 0, -1]);
  const heading = ((Math.atan2(view[0], view[1]) / DEG) + 360) % 360;
  const pitch = Math.asin(Math.max(-1, Math.min(1, view[2]))) / DEG;

  // Screen-up in device coords, accounting for interface rotation.
  const sa = screenAngleDeg * DEG;
  const screenUp: Vec3 = [-Math.sin(sa), Math.cos(sa), 0];
  const up = deviceToWorld(alpha, s.beta, s.gamma, screenUp);
  // Basis perpendicular to the view: world-up projected, and its right.
  const worldUp: Vec3 = [0, 0, 1];
  const rightRaw = cross(view, worldUp);
  const rightNorm = Math.hypot(rightRaw[0], rightRaw[1], rightRaw[2]);
  let roll = 0;
  if (rightNorm > 1e-6) {
    const right = normalize(rightRaw);
    const trueUp = cross(right, view);
    roll = Math.atan2(dot(up, right), dot(up, trueUp)) / DEG;
  }
  return { heading, pitch, roll };
}
