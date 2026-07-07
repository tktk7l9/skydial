/** Observer location in degrees; east longitudes positive. */
export interface GeoLocation {
  lat: number;
  lng: number;
}

/** Equatorial coordinates in degrees. */
export interface Equatorial {
  ra: number;
  dec: number;
}

/** Horizontal coordinates in degrees. Azimuth: N=0°, clockwise (E=90°). */
export interface Horizontal {
  azimuth: number;
  altitude: number;
}

/**
 * Rise/set for one day window. `normal` may still miss one side (the moon
 * rises ~50 min later each day, so some days have no rise or no set);
 * `alwaysUp`/`alwaysDown` cover polar day/night.
 */
export type RiseSetResult =
  | { kind: "normal"; rise: Date | null; set: Date | null }
  | { kind: "alwaysUp" }
  | { kind: "alwaysDown" };

/** A time interval within a day window. */
export interface Interval {
  start: Date;
  end: Date;
}
