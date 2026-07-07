// Device-orientation sources. All platform branching lives here:
//  - iOS Safari: DeviceOrientationEvent.requestPermission() +
//    webkitCompassHeading (already TRUE-north referenced)
//  - Android Chrome: 'deviceorientationabsolute' (alpha, MAGNETIC north —
//    the AR view applies the GSI declination correction on top)
//  - No usable sensors: a "virtual" source driven by pointer drags.
// The attitude math itself is in pose.ts (pure, fully tested).

import { poseFromSample } from "./pose";
import type { OrientationSample, Pose } from "./pose";

export type SourceKind = "ios-compass" | "absolute" | "virtual";

export interface HeadingSource {
  start(onPose: (p: Pose) => void): Promise<SourceKind>;
  stop(): void;
}

type RequestPermissionFn = () => Promise<"granted" | "denied">;

function iosRequestPermission(): RequestPermissionFn | null {
  if (typeof DeviceOrientationEvent === "undefined") return null;
  const fn = (DeviceOrientationEvent as unknown as { requestPermission?: RequestPermissionFn })
    .requestPermission;
  return typeof fn === "function" ? fn : null;
}

function screenAngle(): number {
  return screen.orientation?.angle ?? 0;
}

/** Real device sensors; resolves "virtual" if nothing usable shows up. */
export function createSensorSource(): HeadingSource {
  let listener: ((ev: DeviceOrientationEvent) => void) | null = null;
  let eventName: "deviceorientation" | "deviceorientationabsolute" = "deviceorientation";

  return {
    async start(onPose) {
      const request = iosRequestPermission();
      if (request !== null) {
        try {
          if ((await request()) !== "granted") return "virtual";
        } catch {
          return "virtual";
        }
      } else {
        // Android delivers absolute orientation on a dedicated event.
        eventName = "deviceorientationabsolute";
      }

      return await new Promise<SourceKind>((resolve) => {
        let resolved = false;
        listener = (ev) => {
          const sample = ev as DeviceOrientationEvent & { webkitCompassHeading?: number };
          const s: OrientationSample = {
            alpha: sample.alpha,
            beta: sample.beta,
            gamma: sample.gamma,
            absolute: sample.absolute,
            webkitCompassHeading: sample.webkitCompassHeading,
          };
          const pose = poseFromSample(s, screenAngle());
          if (pose === null) return;
          if (!resolved) {
            resolved = true;
            resolve(
              typeof s.webkitCompassHeading === "number" ? "ios-compass" : "absolute",
            );
          }
          onPose(pose);
        };
        window.addEventListener(eventName, listener);
        // No usable events within 1.5s (desktop, sensor-less) → virtual.
        window.setTimeout(() => {
          if (!resolved) resolve("virtual");
        }, 1500);
      });
    },
    stop() {
      if (listener !== null) window.removeEventListener(eventName, listener);
      listener = null;
    },
  };
}

/** Drag-to-look-around fallback for sensor-less devices. */
export function createVirtualSource(surface: HTMLElement, initial: Pose): HeadingSource {
  let pose = { ...initial, roll: 0 };
  let emit: ((p: Pose) => void) | null = null;
  let last: { x: number; y: number } | null = null;

  const down = (ev: PointerEvent): void => {
    last = { x: ev.clientX, y: ev.clientY };
    surface.setPointerCapture(ev.pointerId);
  };
  const move = (ev: PointerEvent): void => {
    if (last === null || emit === null) return;
    const scale = 60 / surface.clientWidth; // one screen-width ≈ the FOV
    pose = {
      heading: (pose.heading + (last.x - ev.clientX) * scale + 360) % 360,
      pitch: Math.min(85, Math.max(-40, pose.pitch + (ev.clientY - last.y) * scale)),
      roll: 0,
    };
    last = { x: ev.clientX, y: ev.clientY };
    emit(pose);
  };
  const up = (): void => {
    last = null;
  };

  return {
    start(onPose) {
      emit = onPose;
      surface.addEventListener("pointerdown", down);
      surface.addEventListener("pointermove", move);
      surface.addEventListener("pointerup", up);
      surface.addEventListener("pointercancel", up);
      onPose(pose);
      return Promise.resolve("virtual");
    },
    stop() {
      emit = null;
      surface.removeEventListener("pointerdown", down);
      surface.removeEventListener("pointermove", move);
      surface.removeEventListener("pointerup", up);
      surface.removeEventListener("pointercancel", up);
    },
  };
}
