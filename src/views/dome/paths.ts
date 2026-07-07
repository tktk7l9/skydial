// Celestial paths across the dome: sample a body's az/alt over a day and
// draw above-horizon (bright) and below-horizon (faint) polylines.

import * as THREE from "three";
import type { GeoLocation, Horizontal } from "../../astro/types";

export type PositionFn = (t: Date, loc: GeoLocation) => Horizontal;

export function toDome(azimuth: number, altitude: number, radius = 1): THREE.Vector3 {
  const az = (azimuth * Math.PI) / 180;
  const alt = (altitude * Math.PI) / 180;
  const r = Math.cos(alt) * radius;
  return new THREE.Vector3(Math.sin(az) * r, Math.sin(alt) * radius, -Math.cos(az) * r);
}

interface PathOptions {
  color: number;
  dashed?: boolean;
  stepMinutes?: number;
}

/** Build the 24h path group for one body. */
export function buildDayPath(
  position: PositionFn,
  dayStart: Date,
  loc: GeoLocation,
  { color, dashed = false, stepMinutes = 10 }: PathOptions,
): THREE.Group {
  const group = new THREE.Group();
  const above: THREE.Vector3[][] = [];
  const below: THREE.Vector3[][] = [];
  let current: THREE.Vector3[] = [];
  let currentAbove: boolean | null = null;

  for (let m = 0; m <= 24 * 60; m += stepMinutes) {
    const t = new Date(dayStart.getTime() + m * 60_000);
    const { azimuth, altitude } = position(t, loc);
    const isAbove = altitude >= 0;
    const pt = toDome(azimuth, altitude);
    if (currentAbove === null) currentAbove = isAbove;
    if (isAbove !== currentAbove) {
      current.push(pt); // small overlap keeps the line visually continuous
      (currentAbove ? above : below).push(current);
      current = [];
      currentAbove = isAbove;
    }
    current.push(pt);
  }
  if (current.length > 1 && currentAbove !== null) {
    (currentAbove ? above : below).push(current);
  }

  const make = (pts: THREE.Vector3[], opacity: number): THREE.Line => {
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed
      ? new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: 0.035,
          gapSize: 0.025,
        })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.Line(geo, mat);
    if (dashed) l.computeLineDistances();
    return l;
  };
  for (const seg of above) if (seg.length > 1) group.add(make(seg, dashed ? 0.55 : 0.95));
  for (const seg of below) if (seg.length > 1) group.add(make(seg, dashed ? 0.14 : 0.22));
  return group;
}

/**
 * Hour beads along a day path: a small dot at each hour the body is above
 * the horizon. Hours are counted from `dayStart` (local midnight), so the
 * bead index equals the local wall-clock hour.
 */
export function buildHourBeads(
  position: PositionFn,
  dayStart: Date,
  loc: GeoLocation,
  color: number,
): { group: THREE.Group; labeled: Array<{ hour: number; position: THREE.Vector3 }> } {
  const group = new THREE.Group();
  const labeled: Array<{ hour: number; position: THREE.Vector3 }> = [];
  const geo = new THREE.SphereGeometry(0.008, 10, 10);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  for (let hour = 0; hour < 24; hour++) {
    const t = new Date(dayStart.getTime() + hour * 3_600_000);
    const { azimuth, altitude } = position(t, loc);
    if (altitude < 0) continue;
    const pt = toDome(azimuth, altitude);
    const bead = new THREE.Mesh(geo, mat);
    bead.position.copy(pt);
    group.add(bead);
    if (hour % 6 === 0) labeled.push({ hour, position: pt });
  }
  return { group, labeled };
}

/** Radial-gradient glow sprite for the sun / moon markers. */
export function glowSprite(rgb: string, size: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.25, `rgba(${rgb},0.85)`);
  grad.addColorStop(0.6, `rgba(${rgb},0.18)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  sprite.scale.setScalar(size);
  return sprite;
}

/** Dispose every geometry/material/texture under a group. */
export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh & THREE.Sprite>;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | undefined;
    if (mat) {
      const tex = (mat as THREE.SpriteMaterial).map;
      if (tex) tex.dispose();
      mat.dispose();
    }
  });
}
