// AR compass view: camera passthrough + sensor-driven overlay, with staged
// permissions (explainer card → motion → camera), graceful fallbacks, a
// screen wake lock while active, and magnetic-declination correction for
// the Android (magnetic-north) sensor path.

import { declinationWestDeg } from "../../astro/declination";
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
import type { HeadingSource, SourceKind } from "./orientation";
import type { Pose } from "./pose";
import { drawOverlay } from "./overlay";
import type { OverlayData } from "./overlay";
import type { SkyPoint } from "./projection";

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
    el(
      "button",
      { type: "button", class: "btn primary", onclick: () => void begin() },
      ctx.tr("arStart"),
    ),
  );

  const root = el("div", { class: "view-fill" }, video, canvas, intro, hint);

  let source: HeadingSource | null = null;
  let kind: SourceKind = "virtual";
  let pose: Pose = { heading: 180, pitch: 15, roll: 0 };
  let running = false;
  let rafId = 0;
  let pathKey = "";
  let sunPath: SkyPoint[] = [];
  let moonPath: SkyPoint[] = [];
  let wakeLock: WakeLockSentinel | null = null;

  async function acquireWakeLock(): Promise<void> {
    try {
      wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      wakeLock = null; // low battery / unsupported — not worth surfacing
    }
  }
  const onVisibility = (): void => {
    if (running && document.visibilityState === "visible") void acquireWakeLock();
  };

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
      // Android's absolute orientation references magnetic north; correct to
      // true north inside the GSI model's Japan coverage.
      const correction =
        kind === "absolute" ? (declinationWestDeg(s.location) ?? 0) : 0;
      const drawPose: Pose = {
        ...pose,
        heading: (pose.heading - correction + 360) % 360,
      };
      const sun = sunPosition(time, s.location);
      const moon = moonPosition(time, s.location);
      const phase = moonPhase(time);
      const data: OverlayData = {
        sun: { azimuth: sun.azimuth, altitude: sun.apparentAltitude },
        moon: { azimuth: moon.azimuth, altitude: moon.apparentAltitude },
        sunPath,
        moonPath,
        labels: {
          north: ctx.trDir(0),
          east: ctx.trDir(90),
          south: ctx.trDir(180),
          west: ctx.trDir(270),
        },
        sunLabel: `${ctx.tr("sun")} ${ctx.fmtDeg(sun.apparentAltitude)}`,
        moonLabel: `${ctx.tr("moon")} ${ctx.fmtPct(phase.illumination)}`,
      };
      drawOverlay(g, data, drawPose, w, h);
    }
    rafId = requestAnimationFrame(frame);
  }

  function flashHint(text: string): void {
    hint.textContent = text;
    hint.hidden = false;
    window.setTimeout(() => {
      hint.hidden = true;
    }, 6000);
  }

  async function begin(): Promise<void> {
    intro.remove();
    running = true;
    void acquireWakeLock();
    document.addEventListener("visibilitychange", onVisibility);

    // 1) Orientation sensors (needs the user gesture we just got on iOS).
    source = createSensorSource();
    kind = await source.start((p) => {
      pose = p;
    });
    if (kind === "virtual") {
      source.stop();
      source = createVirtualSource(root, pose);
      void source.start((p) => {
        pose = p;
      });
      flashHint(ctx.tr("arVirtualBody"));
    }

    // 2) Camera (falls back to the sky-gradient page background).
    const cameraOk = await startCamera(video);
    if (!cameraOk) {
      video.hidden = true;
      if (kind !== "virtual") flashHint(ctx.tr("arCameraDenied"));
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
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeLock?.release().catch(() => undefined);
      wakeLock = null;
    },
  };
}
