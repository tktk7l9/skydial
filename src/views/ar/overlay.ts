// Canvas-2D AR overlay: compass ribbon, horizon line, and projected
// sun/moon paths + markers for the assumed 60° horizontal field of view.

import type { Pose } from "./orientation";

export const H_FOV = 60;

export interface SkyPoint {
  azimuth: number;
  altitude: number;
}

export interface OverlayData {
  sun: SkyPoint;
  moon: SkyPoint;
  sunPath: SkyPoint[];
  moonPath: SkyPoint[];
  moonIllumination: number;
  labels: { north: string; east: string; south: string; west: string };
  sunLabel: string;
  moonLabel: string;
}

function wrap180(d: number): number {
  const r = ((d + 540) % 360) - 180;
  return r;
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

function drawPath(
  g: CanvasRenderingContext2D,
  path: SkyPoint[],
  pose: Pose,
  w: number,
  h: number,
  color: string,
): void {
  let started = false;
  g.beginPath();
  for (const pt of path) {
    const p = project(pt, pose, w, h);
    // Break the polyline when it leaves the extended frustum or wraps.
    if (!p.visible) {
      started = false;
      continue;
    }
    if (started) g.lineTo(p.x, p.y);
    else g.moveTo(p.x, p.y);
    started = true;
  }
  g.strokeStyle = color;
  g.lineWidth = 2.5;
  g.setLineDash([1, 0]);
  g.stroke();
}

function glow(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: string,
  label: string,
): void {
  const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.5, `rgba(${rgb},0.5)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.font = "600 13px system-ui, sans-serif";
  g.textAlign = "center";
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = 3;
  g.strokeText(label, x, y + r + 16);
  g.fillText(label, x, y + r + 16);
}

export function drawOverlay(
  g: CanvasRenderingContext2D,
  data: OverlayData,
  pose: Pose,
  w: number,
  h: number,
): void {
  g.clearRect(0, 0, w, h);
  const vFov = (H_FOV * h) / w;

  // --- Horizon line ---
  const horizonY = h / 2 + (pose.pitch / vFov) * h;
  if (horizonY > -40 && horizonY < h + 40) {
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.lineWidth = 1.5;
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(0, horizonY);
    g.lineTo(w, horizonY);
    g.stroke();
    g.setLineDash([1, 0]);
  }

  // --- Paths & markers ---
  drawPath(g, data.sunPath, pose, w, h, "rgba(255,194,102,0.85)");
  drawPath(g, data.moonPath, pose, w, h, "rgba(214,222,247,0.7)");
  const sun = project(data.sun, pose, w, h);
  if (sun.visible) glow(g, sun.x, sun.y, 26, "255,194,102", data.sunLabel);
  const moon = project(data.moon, pose, w, h);
  if (moon.visible) {
    glow(g, moon.x, moon.y, 18, "214,222,247", data.moonLabel);
  }

  // --- Compass ribbon (top) ---
  const ribbonY = 26;
  g.font = "600 12px system-ui, sans-serif";
  g.textAlign = "center";
  for (let az = 0; az < 360; az += 15) {
    const dx = wrap180(az - pose.heading);
    if (Math.abs(dx) > H_FOV * 0.75) continue;
    const x = w / 2 + (dx / H_FOV) * w;
    const major = az % 90 === 0;
    g.strokeStyle = major ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)";
    g.lineWidth = major ? 2 : 1;
    g.beginPath();
    g.moveTo(x, ribbonY);
    g.lineTo(x, ribbonY + (major ? 12 : 7));
    g.stroke();
    if (major) {
      const name =
        az === 0
          ? data.labels.north
          : az === 90
            ? data.labels.east
            : az === 180
              ? data.labels.south
              : data.labels.west;
      g.fillStyle = az === 0 ? "#ff8f7a" : "rgba(255,255,255,0.92)";
      g.strokeStyle = "rgba(0,0,0,0.55)";
      g.lineWidth = 3;
      g.strokeText(name, x, ribbonY + 28);
      g.fillText(name, x, ribbonY + 28);
    }
  }
  // Center heading readout.
  g.fillStyle = "rgba(255,255,255,0.95)";
  g.font = "700 15px system-ui, sans-serif";
  const headingText = `${Math.round(pose.heading)}°`;
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = 3;
  g.strokeText(headingText, w / 2, ribbonY - 8);
  g.fillText(headingText, w / 2, ribbonY - 8);
}
