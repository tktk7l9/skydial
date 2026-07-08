// 3D sun-path dome. Loaded lazily — Three.js stays out of the initial bundle.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { moonPosition } from "../../astro/lunar";
import { sunPosition } from "../../astro/solar";
import type { GeoLocation } from "../../astro/types";
import { dayStartFor } from "../../state/dayWindow";
import type { AppState } from "../../state/appState";
import type { AppCtx, View } from "../../app";
import { el } from "../../ui/dom";
import { buildDome, labelSprite } from "./scene";
import { buildDayPath, buildHourBeads, disposeGroup, glowSprite, toDome } from "./paths";
import { createHouseLayer } from "./house3d";
import type { HouseLayer } from "./house3d";
import { clampHouse, defaultHouse } from "../../sunsim/house";
import { encodeHouse } from "../../sunsim/houseCodec";

const SUN_COLOR = 0xffc266;
const MOON_COLOR = 0xd6def7;
const SOLSTICE_JUN = 0x7fd8a8;
const SOLSTICE_DEC = 0x8fa3e8;

function solsticeDates(year: number): { jun: Date; dec: Date } {
  // Calendar-day precision is plenty for reference paths.
  return { jun: new Date(Date.UTC(year, 5, 21)), dec: new Date(Date.UTC(year, 11, 21)) };
}

export function createDomeView(ctx: AppCtx): View {
  const canvas = el("canvas", {});
  const legend = el("div", { class: "legend" });
  const hint = el("div", { class: "view-hint" }, ctx.tr("domeDragHint"));
  const houseChip = el(
    "button",
    {
      type: "button",
      class: "pill house-chip",
      onclick: () => {
        const current = ctx.store.get().house;
        ctx.setHouse(current === null ? clampHouse(defaultHouse()) : null);
      },
    },
    ctx.tr("houseChip"),
  );
  const root = el("div", { class: "view-fill" }, canvas, legend, houseChip, hint);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 20);
  // North = -z in dome space, so sitting at -z looks toward the southern sky
  // (where the sun's arc lives in the northern hemisphere).
  camera.position.set(0, 0.95, -2.2);
  camera.lookAt(0, 0.25, 0);

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reduceMotion;
  controls.enablePan = false;
  controls.minDistance = 1.4;
  controls.maxDistance = 3.4;
  controls.maxPolarAngle = Math.PI / 2 + 0.06; // just under the ground plane
  controls.target.set(0, 0.25, 0);

  scene.add(
    buildDome({
      north: ctx.trDir(0),
      east: ctx.trDir(90),
      south: ctx.trDir(180),
      west: ctx.trDir(270),
    }),
  );

  const sunMarker = glowSprite("255,194,102", 0.17);
  const moonMarker = glowSprite("214,222,247", 0.12);
  scene.add(sunMarker, moonMarker);

  let pathGroup: THREE.Group | null = null;
  let pathKey = "";
  let cameraOriented = false;
  let houseLayer: HouseLayer | null = null;
  let houseKey = "";

  function rebuildPaths(dayStart: Date, loc: GeoLocation): void {
    if (pathGroup !== null) {
      scene.remove(pathGroup);
      disposeGroup(pathGroup);
    }
    pathGroup = new THREE.Group();
    const sunPos = (t: Date, l: GeoLocation): { azimuth: number; altitude: number } =>
      sunPosition(t, l);
    const moonPos = (t: Date, l: GeoLocation): { azimuth: number; altitude: number } =>
      moonPosition(t, l);
    pathGroup.add(buildDayPath(sunPos, dayStart, loc, { color: SUN_COLOR }));
    pathGroup.add(buildDayPath(moonPos, dayStart, loc, { color: MOON_COLOR, stepMinutes: 15 }));
    // Hour beads along today's sun path, with wall-clock labels every 6h.
    const beads = buildHourBeads(sunPos, dayStart, loc, SUN_COLOR);
    pathGroup.add(beads.group);
    for (const { hour, position } of beads.labeled) {
      const label = labelSprite(String(hour), "#ffe3b3", 0.09);
      label.position.copy(position.clone().multiplyScalar(1.06));
      pathGroup.add(label);
    }
    const year = dayStart.getUTCFullYear();
    const { jun, dec } = solsticeDates(year);
    pathGroup.add(buildDayPath(sunPos, jun, loc, { color: SOLSTICE_JUN, dashed: true, stepMinutes: 15 }));
    pathGroup.add(buildDayPath(sunPos, dec, loc, { color: SOLSTICE_DEC, dashed: true, stepMinutes: 15 }));
    scene.add(pathGroup);
  }

  function renderLegend(): void {
    legend.replaceChildren();
    const item = (color: string, label: string): HTMLElement => {
      const sw = el("span", { class: "sw" });
      sw.style.background = color;
      return el("div", { class: "li" }, sw, el("span", {}, label));
    };
    legend.append(
      item("#ffc266", `${ctx.tr("sun")} · ${ctx.tr("domeToday")}`),
      item("#d6def7", `${ctx.tr("moon")} · ${ctx.tr("domeToday")}`),
      item("#7fd8a8", ctx.tr("domeSummerSolstice")),
      item("#8fa3e8", ctx.tr("domeWinterSolstice")),
    );
  }
  renderLegend();

  // Render on demand: orbit interaction and state updates request frames.
  let rafId = 0;
  const requestRender = (): void => {
    if (rafId !== 0) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      controls.update();
      renderer.render(scene, camera);
    });
  };
  controls.addEventListener("change", requestRender);

  const observer = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = root;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  });
  observer.observe(root);

  // Damping loop: run a light rAF loop only while the user interacts.
  let damping = false;
  const dampLoop = (): void => {
    if (!damping) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(dampLoop);
  };
  canvas.addEventListener("pointerdown", () => {
    if (reduceMotion) return;
    damping = true;
    dampLoop();
  });
  canvas.addEventListener("pointerup", () => {
    window.setTimeout(() => {
      damping = false;
    }, 1200);
  });

  return {
    root,
    update(s: AppState, time: Date) {
      if (!cameraOriented) {
        // Start looking at the sun's arc: south in the northern hemisphere,
        // north in the southern.
        cameraOriented = true;
        if (s.location.lat < 0) camera.position.set(0, 0.95, 2.2);
      }
      const dayStart = dayStartFor(time, s.utcOffsetMin);
      const key = `${dayStart.getTime()}:${s.location.lat.toFixed(3)}:${s.location.lng.toFixed(3)}`;
      if (key !== pathKey) {
        pathKey = key;
        rebuildPaths(dayStart, s.location);
      }

      // House layer: rebuild when the model changes, drop when turned off.
      const hKey = s.house === null ? "" : encodeHouse(s.house);
      if (hKey !== houseKey) {
        houseKey = hKey;
        if (houseLayer !== null) {
          scene.remove(houseLayer.group);
          houseLayer.dispose();
          houseLayer = null;
        }
        if (s.house !== null) {
          houseLayer = createHouseLayer(s.house);
          scene.add(houseLayer.group);
        }
      }
      houseChip.classList.toggle("active", s.house !== null);
      houseLayer?.update(time, s.location);
      const sun = sunPosition(time, s.location);
      const moon = moonPosition(time, s.location);
      sunMarker.position.copy(toDome(sun.azimuth, sun.altitude, 1));
      moonMarker.position.copy(toDome(moon.azimuth, moon.altitude, 1));
      (sunMarker.material as THREE.SpriteMaterial).opacity = sun.altitude < 0 ? 0.35 : 1;
      (moonMarker.material as THREE.SpriteMaterial).opacity = moon.altitude < 0 ? 0.3 : 1;
      // Face the camera south (northern hemisphere) or north (southern).
      requestRender();
    },
    destroy() {
      observer.disconnect();
      controls.dispose();
      if (pathGroup !== null) disposeGroup(pathGroup);
      houseLayer?.dispose();
      disposeGroup(scene);
      renderer.dispose();
    },
  };
}
