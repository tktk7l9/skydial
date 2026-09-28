# About this repository (for AI/Claude)

"Skydial", a cross-platform PWA that tracks the positions, rising/setting, and twilight of the sun and moon.
An alternative to Sun Surveyor / Sun Seeker with a refined, mobile-first UI. Supports both ja and en.

## Development conventions

- **Vanilla Vite + TypeScript**. No framework. The UI is built directly with the DOM (`src/ui/`).
- **Heavy libraries are dynamically imported**: Three.js (dome) and Leaflet (map) load on each tab's first display.
  The initial bundle contains only the dashboard + astronomy calculations (target: a few KB gzip). Check it with the `vite build` output.
- **Strict CSP is assumed** (public/_headers). No inline script/style. The only external resources are map tiles (img-src).
- **Permissions-Policy sets camera/geolocation/sensors = self**. Do not revert to the template's deny-all (AR/GPS would silently die).

## Testing policy (lib 100%)

- `src/astro/**`, `src/state/**`, `src/i18n/**`, `src/views/map/rays.ts`,
  `src/views/ar/pose.ts`, `src/views/ar/projection.ts`, and `src/sunsim/**` are under the
  100% coverage gate (vitest.config.ts). The UI/Three/Leaflet layers are excluded.
- Astronomy calculations are cross-checked against fixtures (`src/astro/__fixtures__/ephemeris.ts`, source comments required):
  NOAA Solar Calculator, NAOJ Koyomi (国立天文台こよみ), USNO, JPL Horizons. Tolerance = sun ±1 min/±0.1°, moon ±5 min/±0.3°.
- Solar irradiance calculations are cross-checked within 0.1% against pvlib-python-generated fixtures (`src/sunsim/__fixtures__/clearsky.ts`; the full generator script must be committed),
  together with physical invariants (south face at winter solstice > south face at summer solstice, direct irradiance on north-facing windows at winter solstice ≈ 0, etc.).
- Always include edge cases: polar night/midnight sun (expressed by the `RiseSetResult` type), days with no moonrise/moonset (null), leap years, the date line.

## Sources for astronomy calculations

- Sun: Meeus "Astronomical Algorithms" ch.25 low-precision formulas (error ~0.01°).
- Moon: Meeus ch.47 truncated (main terms, target 0.3°) + geocentric parallax correction. Moon age/illuminated fraction from ch.48. New/full moons and solstices use
  a bisection solver on elongation/ecliptic longitude crossings (`src/astro/phaseevents.ts`).
- Coordinate transforms and atmospheric refraction (Bennett) are in `src/astro/coords.ts`. Azimuth convention: N=0°, clockwise.

## Sources for solar irradiance calculations (sunsim/)

- Clear-sky model: Ineichen–Perez (2002). Tilted surfaces: Hay–Davies. Coefficients ported from pvlib-python (BSD-3-Clause);
  a source URL is required in the function header. When adding formulas for a new radiation model, verify them against a primary source or
  the pvlib reference implementation (do not write coefficients from memory or by guessing).
- Geometry/shading: `src/sunsim/geometry.ts` is the single source of triangle meshes (both the display `house3d.ts` and
  the shading calculation `shading.ts` build from it). ENU coordinates are shared with the dome (`views/dome/`)
  (+x east, +y up, −z north). Keep this coordinate system when adding new roof shapes or obstacle shapes.
- `HouseModel` may contain personal real-world dimensions. Keep the default values (`defaultHouse()`) to a
  "typical example" and do not commit real data to the repository (localStorage/URL sharing only).
- Interior visualization (`src/sunsim/interior.ts`): pure geometry that projects a window's 4 corners along the sun direction onto the floor (y=0) and clips them with the building footprint
  rectangle (Sutherland–Hodgman). Applying shade (`directShadeFraction`) is the caller's responsibility
  (`simulate.ts`/`house3d.ts`) — interior.ts itself knows nothing about shading. Because the whole building is treated as a single room
  for simplicity, low rays that would hit the back wall first intentionally return "no floor patch" (wall patches are out of v1 scope).
  `house3d.ts` makes the roof semi-transparent (walls are opaque) so patches are always visible from an overhead angle
  — do not break this visibility when adding new building parts (interior walls, multiple floors, etc.).

## Commit granularity

Commit once a phase (calculation engine/screen/view) comes together, along with its tests.
Keep tsc green / test green / build green before committing.

## Notes

- **public** (since 2026-07-08). This is a public repository, so do not put personal information or real data in code/tests.
- Calculated values are approximate (not for navigation or surveying). Solar irradiance calculations are also clear-sky-model approximations without weather data. This is footnoted in the UI as well.
