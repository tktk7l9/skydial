// Equirectangular screen projection for the AR overlay (pure).

import type { Pose } from "./pose";

/** Assumed horizontal field of view of the camera passthrough, degrees. */
export const H_FOV = 60;

export interface SkyPoint {
  azimuth: number;
  altitude: number;
}

export function wrap180(d: number): number {
  return ((d + 540) % 360) - 180;
}

export function project(
  point: SkyPoint,
  pose: Pose,
  w: number,
  h: number,
): { x: number; y: number; visible: boolean } {
  const vFov = (H_FOV * h) / w;
  const dx = wrap180(point.azimuth - pose.heading);
  const dy = point.altitude - pose.pitch;
  const x = w / 2 + (dx / H_FOV) * w;
  const y = h / 2 - (dy / vFov) * h;
  const visible = Math.abs(dx) < H_FOV * 1.2 && Math.abs(dy) < vFov * 1.2;
  return { x, y, visible };
}
