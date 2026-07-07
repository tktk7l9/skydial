// AR compass view: camera passthrough + sensor-driven overlay, with staged
// permissions (explainer card → motion → camera) and graceful fallbacks.

import { moonPosition } from "../../astro/lunar";
import { moonPhase } from "../../astro/moonphase";
import { sunPosition } from "../../astro/solar";
import type { GeoLocation } from "../../astro/types";
import { dayStartFor } from "../../state/dayWindow";
import { effectiveTime } from "../../state/appState";
import type { AppCtx, View } from "../../app";
import { el } from "../../ui/dom";
import { startCamera, stopCamera } from "./camera";
import { createSensorSource, createVirtualSource } from "./orientation";
import type { HeadingSource, Pose } from "./orientation";
import { drawOverlay } from "./overlay";
import type { OverlayData, SkyPoint } from "./overlay";

function samplePath(
  position: (t: Date, loc: GeoLocation) => SkyPoint,
  dayStart: Date,
  loc: GeoLocation,
): SkyPoint[] {
  const pts: SkyPoint[] = [];
  for (let m = 0; m <= 24 * 60; m += 20) {
    pts.push(position(new Date(dayStart.getTime() + m * 60_000), loc));
  }
  return pts;
}

export function createArView(ctx: AppCtx): View {
  const video = el("video", { playsinline: true, muted: true });
  const canvas = el("canvas", {});
  const hint = el("div", { class: "view-hint" });
  hint.hidden = true;

  const intro = el(
    "div",
    { class: "card view-center-card" },
    el("h2", {}, ctx.tr("arIntroTitle")),
    el("p", {}, ctx.tr("arIntroBody")),
    el("button", { type: "button", class: "btn primary", onclick: () => void begin() }, ctx.tr("arStart")),
  );

  const root = el("div", { class: "view-fill" }, video, canvas, intro, hint);

  let source: HeadingSource | null = null;
  let pose: Pose = { heading: 180, pitch: 15 };
  let running = false;
  let rafId = 0;
  let pathKey = "";
  let sunPath: SkyPoint[] = [];
  let moonPath: SkyPoint[] = [];

  function refreshPaths(time: Date): void {
    const s = ctx.store.get();
    const dayStart = dayStartFor(time, s.utcOffsetMin);
    const key = `${dayStart.getTime()}:${s.location.lat.toFixed(3)}:${s.location.lng.toFixed(3)}`;
    if (key === pathKey) return;
    pathKey = key;
    sunPath = samplePath((t, l) => sunPosition(t, l), dayStart, s.location);
    moonPath = samplePath((t, l) => moonPosition(t, l), dayStart, s.location);
  }

  function frame(): void {
    if (!running) return;
    const s = ctx.store.get();
    const time = effectiveTime(s);
    refreshPaths(time);
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (canvas.width !== w * devicePixelRatio || canvas.height !== h * devicePixelRatio) {
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
    }
    const g = canvas.getContext("2d");
    if (g !== null && w > 0) {
      g.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      const sun = sunPosition(time, s.location);
      const moon = moonPosition(time, s.location);
      const phase = moonPhase(time);
      const data: OverlayData = {
        sun: { azimuth: sun.azimuth, altitude: sun.apparentAltitude },
        moon: { azimuth: moon.azimuth, altitude: moon.apparentAltitude },
        sunPath,
        moonPath,
        moonIllumination: phase.illumination,
        labels: {
          north: ctx.trDir(0),
          east: ctx.trDir(90),
          south: ctx.trDir(180),
          west: ctx.trDir(270),
        },
        sunLabel: `${ctx.tr("sun")} ${ctx.fmtDeg(sun.apparentAltitude)}`,
        moonLabel: `${ctx.tr("moon")} ${ctx.fmtPct(phase.illumination)}`,
      };
      drawOverlay(g, data, pose, w, h);
    }
    rafId = requestAnimationFrame(frame);
  }

  async function begin(): Promise<void> {
    intro.remove();
    running = true;

    // 1) Orientation sensors (needs the user gesture we just got on iOS).
    source = createSensorSource();
    const kind = await source.start((p) => {
      pose = p;
    });
    if (kind === "virtual") {
      source.stop();
      source = createVirtualSource(root, pose);
      void source.start((p) => {
        pose = p;
      });
      hint.textContent = ctx.tr("arVirtualBody");
      hint.hidden = false;
      window.setTimeout(() => {
        hint.hidden = true;
      }, 6000);
    }

    // 2) Camera (falls back to the sky-gradient page background).
    const cameraOk = await startCamera(video);
    if (!cameraOk) {
      video.hidden = true;
      if (kind !== "virtual") {
        hint.textContent = ctx.tr("arCameraDenied");
        hint.hidden = false;
        window.setTimeout(() => {
          hint.hidden = true;
        }, 6000);
      }
    }

    frame();
  }

  return {
    root,
    update() {
      // The rAF loop reads store state directly; nothing to do per tick.
    },
    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      source?.stop();
      stopCamera(video);
    },
  };
}
