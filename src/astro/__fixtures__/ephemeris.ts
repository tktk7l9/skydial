// Reference ephemeris values for fixture tests. Fetched 2026-07-07.
//
// Primary source — USNO Astronomical Applications API
// (aa.usno.navy.mil/api/rstt/oneday): minute-precision rise/set/transit and
// civil twilight, plus moon data. Tolerance ±75 s (minute rounding + model).
//
// Secondary source — api.sunrise-sunset.org: full twilight set (civil /
// nautical / astronomical). Its twilight times agree with USNO, but its
// sunrise/sunset run ~60–120 s EARLY versus both USNO and JPL Horizons
// (verified 2026-07-07: Horizons airless altitude crosses -0.8333° at
// 19:25:49Z for Tokyo 2026-06-21 vs the API's 19:24:23Z, while this engine
// matches Horizons to ~0.002°). Tolerance ±150 s, rise/set treated loosely.
//
// `dayStartUtc` is the location's local midnight in UTC. Sentinel epoch
// timestamps from the API (no such event) are recorded here as null.

import type { GeoLocation } from "../types";

export interface SunDayFixture {
  name: string;
  loc: GeoLocation;
  /** Local midnight of the fixture day, expressed in UTC. */
  dayStartUtc: string;
  kind: "normal" | "alwaysUp" | "alwaysDown";
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string;
  civilDawn: string | null;
  civilDusk: string | null;
  nauticalDawn: string | null;
  nauticalDusk: string | null;
  astronomicalDawn: string | null;
  astronomicalDusk: string | null;
}

export const TOKYO: GeoLocation = { lat: 35.6762, lng: 139.6503 };
export const LONDON: GeoLocation = { lat: 51.5074, lng: -0.1278 };
export const SYDNEY: GeoLocation = { lat: -33.8688, lng: 151.2093 };
export const EQUATOR: GeoLocation = { lat: 0, lng: 0 };
export const TROMSO: GeoLocation = { lat: 69.6492, lng: 18.9553 };

export interface UsnoSunFixture {
  name: string;
  loc: GeoLocation;
  dayStartUtc: string;
  kind: "normal" | "alwaysDown";
  rise: string | null;
  set: string | null;
  transit: string | null;
  civilDawn: string;
  civilDusk: string;
}

/** USNO oneday API values (minute precision, local times converted to UTC). */
export const USNO_SUN_FIXTURES: UsnoSunFixture[] = [
  {
    name: "USNO Tokyo 2026-06-21",
    loc: TOKYO,
    dayStartUtc: "2026-06-20T15:00:00Z",
    kind: "normal",
    rise: "2026-06-20T19:26:00Z", // 04:26 JST
    set: "2026-06-21T10:00:00Z", // 19:00 JST
    transit: "2026-06-21T02:43:00Z", // 11:43 JST
    civilDawn: "2026-06-20T18:56:00Z", // 03:56 JST
    civilDusk: "2026-06-21T10:31:00Z", // 19:31 JST
  },
  {
    name: "USNO Tokyo 2026-12-22",
    loc: TOKYO,
    dayStartUtc: "2026-12-21T15:00:00Z",
    kind: "normal",
    rise: "2026-12-21T21:48:00Z", // 06:48 JST
    set: "2026-12-22T07:32:00Z", // 16:32 JST
    transit: "2026-12-22T02:40:00Z", // 11:40 JST
    civilDawn: "2026-12-21T21:19:00Z", // 06:19 JST
    civilDusk: "2026-12-22T08:00:00Z", // 17:00 JST
  },
  {
    name: "USNO Sydney 2026-12-22",
    loc: SYDNEY,
    dayStartUtc: "2026-12-21T13:00:00Z",
    kind: "normal",
    rise: "2026-12-21T18:41:00Z", // 05:41 AEDT
    set: "2026-12-22T09:06:00Z", // 20:06 AEDT
    transit: "2026-12-22T01:54:00Z", // 12:54 AEDT
    civilDawn: "2026-12-21T18:12:00Z", // 05:12 AEDT
    civilDusk: "2026-12-22T09:35:00Z", // 20:35 AEDT
  },
  {
    name: "USNO Tromsø 2026-12-22 (polar night)",
    loc: TROMSO,
    dayStartUtc: "2026-12-21T23:00:00Z",
    kind: "alwaysDown",
    rise: null,
    set: null,
    transit: null,
    civilDawn: "2026-12-22T08:32:00Z", // 09:32 CET
    civilDusk: "2026-12-22T12:54:00Z", // 13:54 CET
  },
];

export interface UsnoMoonFixture {
  name: string;
  loc: GeoLocation;
  dayStartUtc: string;
  kind: "normal" | "alwaysUp";
  /** Expected time, null = event must be absent, undefined = not asserted. */
  rise: string | null | undefined;
  set: string | null | undefined;
  transit: string | null;
  /** USNO fracillum for the day (0–1), or null when not asserted. */
  illumination: number | null;
}

/** USNO oneday API moon values (minute precision, local times → UTC). */
export const USNO_MOON_FIXTURES: UsnoMoonFixture[] = [
  {
    name: "USNO Tokyo 2026-06-21 (waxing crescent)",
    loc: TOKYO,
    dayStartUtc: "2026-06-20T15:00:00Z",
    kind: "normal",
    rise: "2026-06-21T01:57:00Z", // 10:57 JST
    set: "2026-06-21T14:24:00Z", // 23:24 JST
    transit: "2026-06-21T08:15:00Z", // 17:15 JST
    illumination: 0.42,
  },
  {
    name: "USNO Tokyo 2026-12-22 (set before rise)",
    loc: TOKYO,
    dayStartUtc: "2026-12-21T15:00:00Z",
    kind: "normal",
    rise: "2026-12-22T05:23:00Z", // 14:23 JST
    set: "2026-12-21T19:35:00Z", // 04:35 JST
    transit: "2026-12-22T13:03:00Z", // 22:03 JST
    illumination: 0.94,
  },
  {
    name: "USNO Sydney 2026-12-22",
    loc: SYDNEY,
    dayStartUtc: "2026-12-21T13:00:00Z",
    kind: "normal",
    rise: "2026-12-22T07:20:00Z", // 18:20 AEDT
    set: "2026-12-21T16:13:00Z", // 03:13 AEDT
    transit: "2026-12-22T12:15:00Z", // 23:15 AEDT
    illumination: 0.94,
  },
  {
    // USNO lists no moonrise for Tokyo 2026-07-09 (next rise 07-10 00:00
    // JST). This engine puts that rise at 23:59:45 JST — 15 s the other side
    // of midnight — so the skip day itself is model-borderline and the rise
    // is deliberately NOT asserted here. The skip-day behaviour is covered
    // by the month-long invariant test instead.
    name: "USNO Tokyo 2026-07-09 (set/transit only)",
    loc: TOKYO,
    dayStartUtc: "2026-07-08T15:00:00Z",
    kind: "normal",
    rise: undefined,
    set: "2026-07-09T04:27:00Z", // 13:27 JST
    transit: "2026-07-08T21:21:00Z", // 06:21 JST
    illumination: null,
  },
  {
    // Polar "midnight moon": continuously above the horizon all day.
    name: "USNO Tromsø 2026-12-22 (moon always up)",
    loc: TROMSO,
    dayStartUtc: "2026-12-21T23:00:00Z",
    kind: "alwaysUp",
    rise: null,
    set: null,
    transit: "2026-12-22T21:28:00Z", // upper transit 22:28 CET
    illumination: 0.96,
  },
];

/**
 * USNO principal-phase instants (UTC), for illumination anchors.
 * First quarter 2026-06-22 06:55 JST; last quarter 2026-07-08 04:29 JST;
 * full moon 2026-12-24 10:28 JST.
 */
export const USNO_MOON_PHASES = {
  firstQuarter: "2026-06-21T21:55:00Z",
  lastQuarter: "2026-07-07T19:29:00Z",
  full: "2026-12-24T01:28:00Z",
} as const;

/**
 * JPL Horizons airless apparent az/el of the sun's center for Tokyo
 * (139.6503E, 35.6762N, 0 m), fetched 2026-07-07. Anchors raw position
 * accuracy at the ~0.01° level.
 */
export const HORIZONS_SUN_TOKYO = [
  { utc: "2026-06-20T19:24:00Z", azimuth: 59.724851, altitude: -1.153381 },
  { utc: "2026-06-20T19:25:00Z", azimuth: 59.872523, altitude: -0.977891 },
  { utc: "2026-06-20T19:26:00Z", azimuth: 60.019876, altitude: -0.802138 },
] as const;

export const SUN_DAY_FIXTURES: SunDayFixture[] = [
  {
    name: "Tokyo 2026-03-20 (equinox)",
    loc: TOKYO,
    dayStartUtc: "2026-03-19T15:00:00Z",
    kind: "normal",
    sunrise: "2026-03-19T20:44:06Z",
    sunset: "2026-03-20T08:53:49Z",
    solarNoon: "2026-03-20T02:48:58Z",
    civilDawn: "2026-03-19T20:19:57Z",
    civilDusk: "2026-03-20T09:17:58Z",
    nauticalDawn: "2026-03-19T19:50:13Z",
    nauticalDusk: "2026-03-20T09:47:42Z",
    astronomicalDawn: "2026-03-19T19:20:08Z",
    astronomicalDusk: "2026-03-20T10:17:47Z",
  },
  {
    name: "Tokyo 2026-06-21 (summer solstice)",
    loc: TOKYO,
    dayStartUtc: "2026-06-20T15:00:00Z",
    kind: "normal",
    sunrise: "2026-06-20T19:24:23Z",
    sunset: "2026-06-21T10:01:53Z",
    solarNoon: "2026-06-21T02:43:08Z",
    civilDawn: "2026-06-20T18:55:47Z",
    civilDusk: "2026-06-21T10:30:29Z",
    nauticalDawn: "2026-06-20T18:18:27Z",
    nauticalDusk: "2026-06-21T11:07:49Z",
    astronomicalDawn: "2026-06-20T17:36:59Z",
    astronomicalDusk: "2026-06-21T11:49:17Z",
  },
  {
    name: "Tokyo 2026-09-23 (equinox)",
    loc: TOKYO,
    dayStartUtc: "2026-09-22T15:00:00Z",
    kind: "normal",
    sunrise: "2026-09-22T20:28:36Z",
    sunset: "2026-09-23T08:39:11Z",
    solarNoon: "2026-09-23T02:33:53Z",
    civilDawn: "2026-09-22T20:04:26Z",
    civilDusk: "2026-09-23T09:03:20Z",
    nauticalDawn: "2026-09-22T19:34:41Z",
    nauticalDusk: "2026-09-23T09:33:05Z",
    astronomicalDawn: "2026-09-22T19:04:35Z",
    astronomicalDusk: "2026-09-23T10:03:12Z",
  },
  {
    name: "Tokyo 2026-12-22 (winter solstice)",
    loc: TOKYO,
    dayStartUtc: "2026-12-21T15:00:00Z",
    kind: "normal",
    sunrise: "2026-12-21T21:46:05Z",
    sunset: "2026-12-22T07:33:26Z",
    solarNoon: "2026-12-22T02:39:46Z",
    civilDawn: "2026-12-21T21:19:08Z",
    civilDusk: "2026-12-22T08:00:23Z",
    nauticalDawn: "2026-12-21T20:47:09Z",
    nauticalDusk: "2026-12-22T08:32:22Z",
    astronomicalDawn: "2026-12-21T20:16:01Z",
    astronomicalDusk: "2026-12-22T09:03:30Z",
  },
  {
    // Astronomical twilight never ends at this latitude in June — the API
    // returns sentinel values, i.e. the sun stays above -18° all night.
    name: "London 2026-06-21 (solstice, no astronomical twilight)",
    loc: LONDON,
    dayStartUtc: "2026-06-20T23:00:00Z",
    kind: "normal",
    sunrise: "2026-06-21T03:40:56Z",
    sunset: "2026-06-21T20:23:44Z",
    solarNoon: "2026-06-21T12:02:20Z",
    civilDawn: "2026-06-21T02:55:24Z",
    civilDusk: "2026-06-21T21:09:15Z",
    nauticalDawn: "2026-06-21T01:40:46Z",
    nauticalDusk: "2026-06-21T22:23:54Z",
    astronomicalDawn: null,
    astronomicalDusk: null,
  },
  {
    name: "Sydney 2026-12-22 (southern summer)",
    loc: SYDNEY,
    dayStartUtc: "2026-12-21T13:00:00Z",
    kind: "normal",
    sunrise: "2026-12-21T18:39:46Z",
    sunset: "2026-12-22T09:07:15Z",
    solarNoon: "2026-12-22T01:53:31Z",
    civilDawn: "2026-12-21T18:12:06Z",
    civilDusk: "2026-12-22T09:34:55Z",
    nauticalDawn: "2026-12-21T17:36:13Z",
    nauticalDusk: "2026-12-22T10:10:48Z",
    astronomicalDawn: "2026-12-21T16:56:54Z",
    astronomicalDusk: "2026-12-22T10:50:07Z",
  },
  {
    name: "Equator (0,0) 2026-03-20 (equinox)",
    loc: EQUATOR,
    dayStartUtc: "2026-03-20T00:00:00Z",
    kind: "normal",
    sunrise: "2026-03-20T06:03:03Z",
    sunset: "2026-03-20T18:11:51Z",
    solarNoon: "2026-03-20T12:07:27Z",
    civilDawn: "2026-03-20T05:43:27Z",
    civilDusk: "2026-03-20T18:31:27Z",
    nauticalDawn: "2026-03-20T05:19:27Z",
    nauticalDusk: "2026-03-20T18:55:27Z",
    astronomicalDawn: "2026-03-20T04:55:27Z",
    astronomicalDusk: "2026-03-20T19:19:27Z",
  },
  {
    name: "Tromsø 2026-06-21 (midnight sun)",
    loc: TROMSO,
    dayStartUtc: "2026-06-20T22:00:00Z",
    kind: "alwaysUp",
    sunrise: null,
    sunset: null,
    solarNoon: "2026-06-21T10:45:59Z",
    civilDawn: null,
    civilDusk: null,
    nauticalDawn: null,
    nauticalDusk: null,
    astronomicalDawn: null,
    astronomicalDusk: null,
  },
  {
    // Polar night: the sun never rises, but civil/nautical/astronomical
    // twilight all still occur around midday.
    name: "Tromsø 2026-12-22 (polar night)",
    loc: TROMSO,
    dayStartUtc: "2026-12-21T23:00:00Z",
    kind: "alwaysDown",
    sunrise: null,
    sunset: null,
    solarNoon: "2026-12-22T10:42:42Z",
    civilDawn: "2026-12-22T08:31:41Z",
    civilDusk: "2026-12-22T12:53:43Z",
    nauticalDawn: "2026-12-22T06:47:14Z",
    nauticalDusk: "2026-12-22T14:38:11Z",
    astronomicalDawn: "2026-12-22T05:28:53Z",
    astronomicalDusk: "2026-12-22T15:56:32Z",
  },
];
