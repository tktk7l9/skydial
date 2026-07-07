// Degree-based trig helpers. All astro modules work in degrees at the API
// boundary (Meeus's formulas are tabulated in degrees).

const DEG = Math.PI / 180;

export function deg2rad(d: number): number {
  return d * DEG;
}

export function rad2deg(r: number): number {
  return r / DEG;
}

/** Normalize an angle to [0, 360). */
export function normalizeDeg(d: number): number {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

/** Normalize an angle to [-180, 180). */
export function normalizeDeg180(d: number): number {
  const r = normalizeDeg(d);
  return r >= 180 ? r - 360 : r;
}

export function sind(d: number): number {
  return Math.sin(d * DEG);
}

export function cosd(d: number): number {
  return Math.cos(d * DEG);
}

export function tand(d: number): number {
  return Math.tan(d * DEG);
}

export function asind(x: number): number {
  return rad2deg(Math.asin(x));
}

export function atan2d(y: number, x: number): number {
  return rad2deg(Math.atan2(y, x));
}
