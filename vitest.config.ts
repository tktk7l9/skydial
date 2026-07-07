import { defineConfig } from "vitest/config";

// 純ロジック層(天体計算・状態・i18n・地図の測地線計算)は 100% を維持する
// (既存アプリの lib-100% 方針に準拠)。UI/Three/Leaflet 層はゲート対象外。
const PURE_GLOBS = [
  "src/astro/**/*.ts",
  "src/state/**/*.ts",
  "src/i18n/**/*.ts",
  "src/views/map/rays.ts",
  "src/views/ar/pose.ts",
  "src/views/ar/projection.ts",
];

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: PURE_GLOBS,
      exclude: ["src/**/*.test.ts", "src/astro/__fixtures__/**"],
      reporter: ["text", "json-summary", "html"],
      thresholds: Object.fromEntries(
        PURE_GLOBS.map((glob) => [
          glob,
          { statements: 100, branches: 100, functions: 100, lines: 100 },
        ]),
      ),
    },
  },
});
