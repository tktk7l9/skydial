import { defineConfig } from "vitest/config";

// Keep the pure logic layer (astronomy, state, i18n, map geodesic math) at 100%
// (following the existing apps' lib-100% policy).
const PURE_GLOBS = [
  "src/astro/**/*.ts",
  "src/state/**/*.ts",
  "src/i18n/**/*.ts",
  "src/views/map/rays.ts",
  "src/views/ar/pose.ts",
  "src/views/ar/projection.ts",
  "src/sunsim/**/*.ts",
];

// The UI layer (DOM views, the Three.js dome and Leaflet map wiring) is
// covered by behavioural jsdom tests. Its gate sits 2 points under the level
// reached (98.1 / 91.2 / 98.4 / 98.5, stable across runs) so it cannot regress.
const UI_GLOB = "{src/app.ts,src/main.ts,src/ui/**/*.ts,src/views/**/*.ts}";
const UI_THRESHOLDS = { statements: 96, branches: 89, functions: 96, lines: 96 };

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // UI tests opt into jsdom per file (`// @vitest-environment jsdom`).
    setupFiles: ["src/test-utils/setupDom.ts"],
    coverage: {
      provider: "v8",
      include: [...PURE_GLOBS, UI_GLOB],
      exclude: ["src/**/*.test.ts", "src/**/__fixtures__/**", "src/test-utils/**"],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        ...Object.fromEntries(
          PURE_GLOBS.map((glob) => [
            glob,
            { statements: 100, branches: 100, functions: 100, lines: 100 },
          ]),
        ),
        [UI_GLOB]: UI_THRESHOLDS,
      },
    },
  },
});
