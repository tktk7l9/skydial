// Device-orientation abstraction. All platform branching lives here:
//  - iOS Safari: DeviceOrientationEvent.requestPermission() + webkitCompassHeading
//  - Android Chrome: 'deviceorientationabsolute' (alpha, magnetic north)
//  - No usable sensors: a "virtual" source driven by pointer drags.
// v1 does not correct magnetic declination (±10° across Japan is < the
// hand-held aiming error this view is used at).

export interface Pose {
  /** Compass heading the camera looks toward, degrees, N=0 clockwise. */
  heading: number;
  /** Camera pitch above the horizon, degrees. */
  pitch: number;
}

export type SourceKind = "sensors" | "virtual";

export interface HeadingSource {
  start(onPose: (p: Pose) => void): Promise<SourceKind>;
  stop(): void;
}

interface IosOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

type RequestPermissionFn = () => Promise<"granted" | "denied">;

function iosRequestPermission(): RequestPermissionFn | null {
  if (typeof DeviceOrientationEvent === "undefined") return null;
  const fn = (DeviceOrientationEvent as unknown as { requestPermission?: RequestPermissionFn })
    .requestPermission;
  return typeof fn === "function" ? fn : null;
}

/** Portrait-mode pose from a raw orientation event. */
export function eventToPose(ev: IosOrientationEvent): Pose | null {
  const pitch = (ev.beta ?? 90) - 90; // beta 90° = phone upright at horizon
  if (typeof ev.webkitCompassHeading === "number") {
    return { heading: ev.webkitCompassHeading, pitch };
  }
  if (ev.absolute && ev.alpha !== null) {
    return { heading: (360 - ev.alpha) % 360, pitch };
  }
  return null;
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
        let gotData = false;
        listener = (ev) => {
          const pose = eventToPose(ev as IosOrientationEvent);
          if (pose === null) return;
          if (!gotData) {
            gotData = true;
            resolve("sensors");
          }
          onPose(pose);
        };
        window.addEventListener(eventName, listener);
        // No events within 1.5s (desktop, sensor-less tablets) → virtual.
        window.setTimeout(() => {
          if (!gotData) resolve("virtual");
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
  let pose = { ...initial };
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
