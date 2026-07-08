// Three.js layer for the insolation study: house + obstacle meshes built
// from the SAME triangle soup the shading engine raycasts (geometry.ts is
// the single source of truth), sun-driven shadow mapping, and per-window
// lit/shaded tinting.

import * as THREE from "three";
import { buildHouseGeometry, sunDirection } from "../../sunsim/geometry";
import type { HouseGeometry, WindowGeo } from "../../sunsim/geometry";
import type { HouseModel } from "../../sunsim/house";
import { directShadeFraction } from "../../sunsim/shading";
import { sunPosition } from "../../astro/solar";
import type { GeoLocation } from "../../astro/types";
import { disposeGroup } from "./paths";

const WALL_COLOR = 0x9aa3c7;
const OBSTACLE_COLOR = 0x565f80;
const WINDOW_SHADED = new THREE.Color(0x33406e);
const WINDOW_LIT = new THREE.Color(0xffc266);

function soupToGeometry(
  tris: HouseGeometry["triangles"],
  from: number,
  to: number,
): THREE.BufferGeometry {
  const positions = new Float32Array((to - from) * 9);
  let o = 0;
  for (let i = from; i < to; i++) {
    for (const v of [tris[i].a, tris[i].b, tris[i].c]) {
      positions[o++] = v[0];
      positions[o++] = v[1];
      positions[o++] = v[2];
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

export interface HouseLayer {
  group: THREE.Group;
  update(time: Date, loc: GeoLocation): void;
  dispose(): void;
}

export function createHouseLayer(model: HouseModel): HouseLayer {
  const geo = buildHouseGeometry(model);
  const scale = 0.36 / Math.max(geo.horizontalRadius, 8);

  // Meshes live in a scaled subgroup; lights and the shadow catcher stay in
  // dome units so the shadow camera's frustum is well-defined.
  const group = new THREE.Group();
  const scaled = new THREE.Group();
  scaled.scale.setScalar(scale);
  group.add(scaled);

  // House vs obstacle triangles (obstacles are appended last, 10 tris each).
  const houseTriCount = geo.triangles.length - model.obstacles.length * 10;
  const houseMesh = new THREE.Mesh(
    soupToGeometry(geo.triangles, 0, houseTriCount),
    new THREE.MeshLambertMaterial({ color: WALL_COLOR, side: THREE.DoubleSide }),
  );
  houseMesh.castShadow = true;
  houseMesh.receiveShadow = true;
  scaled.add(houseMesh);

  if (model.obstacles.length > 0) {
    const obsMesh = new THREE.Mesh(
      soupToGeometry(geo.triangles, houseTriCount, geo.triangles.length),
      new THREE.MeshLambertMaterial({
        color: OBSTACLE_COLOR,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
    );
    obsMesh.castShadow = true;
    obsMesh.receiveShadow = true;
    scaled.add(obsMesh);
  }

  // Ground shadow catcher (sits just above the dome's ground disk).
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(0.98, 64),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.002;
  ground.receiveShadow = true;
  group.add(ground);

  // Windows: emissive quads re-tinted per update.
  const windowMeshes: Array<{ mesh: THREE.Mesh; win: WindowGeo }> = [];
  for (const win of geo.windows) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(win.widthM, win.heightM),
      new THREE.MeshBasicMaterial({ color: WINDOW_SHADED, side: THREE.DoubleSide }),
    );
    // Orient the plane: x → hAxis, z → outward normal.
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(...win.hAxis),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(...win.normal),
    );
    mesh.quaternion.setFromRotationMatrix(m);
    mesh.position.set(...win.center);
    windowMeshes.push({ mesh, win });
    scaled.add(mesh);
  }

  // Sun light + soft ambient, in dome units. Direction tracks the real sun.
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.3);
  sun.castShadow = true;
  const frustum = 0.65;
  sun.shadow.camera.left = -frustum;
  sun.shadow.camera.right = frustum;
  sun.shadow.camera.top = frustum;
  sun.shadow.camera.bottom = -frustum;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 6;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -5e-4;
  sun.shadow.normalBias = 0.005;
  group.add(ambient, sun, sun.target);

  return {
    group,
    update(time, loc) {
      const pos = sunPosition(time, loc);
      const up = pos.apparentAltitude > 0;
      sun.visible = up;
      if (up) {
        const dir = sunDirection(pos.azimuth, pos.apparentAltitude);
        sun.position.set(dir[0] * 2.5, dir[1] * 2.5, dir[2] * 2.5);
        sun.target.position.set(0, 0, 0);
        sun.intensity = 0.5 + 0.8 * Math.min(1, pos.apparentAltitude / 20);
      }
      const sunDir = up ? sunDirection(pos.azimuth, pos.apparentAltitude) : null;
      for (const { mesh, win } of windowMeshes) {
        let t = 0;
        if (sunDir !== null) {
          const cosTheta = Math.max(
            0,
            sunDir[0] * win.normal[0] + sunDir[1] * win.normal[1] + sunDir[2] * win.normal[2],
          );
          if (cosTheta > 0) {
            t = directShadeFraction(win, sunDir, geo.triangles) * Math.min(1, cosTheta * 1.6);
          }
        }
        (mesh.material as THREE.MeshBasicMaterial).color
          .copy(WINDOW_SHADED)
          .lerp(WINDOW_LIT, t);
      }
    },
    dispose() {
      disposeGroup(group);
    },
  };
}
