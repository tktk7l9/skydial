// Static dome scenery: horizon ring, altitude circles, meridian arcs,
// ground disk and localized compass labels.

import * as THREE from "three";

const GRID = 0x5a6ba0;
const GRID_OPACITY = 0.42;

function circlePoints(altDeg: number, segments = 128): THREE.Vector3[] {
  const alt = (altDeg * Math.PI) / 180;
  const r = Math.cos(alt);
  const y = Math.sin(alt);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.sin(a) * r, y, -Math.cos(a) * r));
  }
  return pts;
}

function line(points: THREE.Vector3[], opacity = GRID_OPACITY): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color: GRID, transparent: true, opacity });
  return new THREE.Line(geo, mat);
}

function meridianArc(azDeg: number): THREE.Vector3[] {
  const az = (azDeg * Math.PI) / 180;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 45; i++) {
    const alt = (i / 45) * (Math.PI / 2);
    const r = Math.cos(alt);
    pts.push(new THREE.Vector3(Math.sin(az) * r, Math.sin(alt), -Math.cos(az) * r));
  }
  return pts;
}

export function labelSprite(text: string, color: string, scale: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d") as CanvasRenderingContext2D;
  g.font = "600 72px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  // Dark outline keeps labels readable against the bright daytime sky.
  g.lineWidth = 10;
  g.strokeStyle = "rgba(10, 16, 38, 0.75)";
  g.lineJoin = "round";
  g.strokeText(text, 64, 68);
  g.fillStyle = color;
  g.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  sprite.scale.setScalar(scale);
  return sprite;
}

export interface CompassLabels {
  north: string;
  east: string;
  south: string;
  west: string;
}

export function buildDome(labels: CompassLabels): THREE.Group {
  const group = new THREE.Group();

  // Horizon + altitude circles.
  group.add(line(circlePoints(0), 0.75));
  group.add(line(circlePoints(30)));
  group.add(line(circlePoints(60)));

  // Meridian arcs every 45°.
  for (let az = 0; az < 360; az += 45) group.add(line(meridianArc(az)));

  // Ground disk (subtle, keeps "below horizon" readable).
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1, 96),
    new THREE.MeshBasicMaterial({
      color: 0x0c1330,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Compass labels just outside the horizon ring.
  const defs: Array<{ az: number; text: string; color: string }> = [
    { az: 0, text: labels.north, color: "#ff8f7a" },
    { az: 90, text: labels.east, color: "#e8ecff" },
    { az: 180, text: labels.south, color: "#e8ecff" },
    { az: 270, text: labels.west, color: "#e8ecff" },
  ];
  for (const d of defs) {
    const a = (d.az * Math.PI) / 180;
    const sprite = labelSprite(d.text, d.color, 0.16);
    sprite.position.set(Math.sin(a) * 1.12, 0.05, -Math.cos(a) * 1.12);
    group.add(sprite);
  }
  return group;
}
