import { simulateDay } from "./simulate";
import { clampHouse, defaultHouse } from "./house";
import type { HouseModel } from "./house";
import { plainHouse } from "./geometry.test";

const TOKYO = { lat: 35.6762, lng: 139.6503 };
// Local midnights (UTC+9) of the 2026 solstices.
const SUMMER = new Date("2026-06-20T15:00:00Z");
const WINTER = new Date("2026-12-21T15:00:00Z");

const southWindow = { face: 0 as const, w: 1.69, h: 2.0, sill: 0.05, off: 4, shgc: 0.6 };

function bare(over: Partial<HouseModel> = {}): HouseModel {
  return plainHouse({ windows: [southWindow], ...over });
}

describe("simulateDay — passive-design invariants (Tokyo, TL=3)", () => {
  it("south vertical glazing gains MORE on the winter solstice than the summer one", () => {
    const summer = simulateDay(bare(), TOKYO, SUMMER);
    const winter = simulateDay(bare(), TOKYO, WINTER);
    expect(winter.windows[0].irradiationKwhM2.total).toBeGreaterThan(
      summer.windows[0].irradiationKwhM2.total * 1.3,
    );
    // Direct beam dominates the winter south window.
    expect(winter.windows[0].irradiationKwhM2.direct).toBeGreaterThan(
      winter.windows[0].irradiationKwhM2.isotropic,
    );
  });

  it("north windows get no winter beam but some around the summer solstice", () => {
    const north = bare({ windows: [{ ...southWindow, face: 2 }] });
    const summer = simulateDay(north, TOKYO, SUMMER);
    const winter = simulateDay(north, TOKYO, WINTER);
    expect(winter.windows[0].irradiationKwhM2.direct).toBeLessThan(0.005);
    expect(summer.windows[0].irradiationKwhM2.direct).toBeGreaterThan(0.05);
  });

  it("a 0.91 m eave cuts summer beam hard but barely touches winter", () => {
    const open = bare();
    const eaved = bare({ eaveOut: 0.91 });
    const sOpen = simulateDay(open, TOKYO, SUMMER).windows[0].irradiationKwhM2.direct;
    const sEave = simulateDay(eaved, TOKYO, SUMMER).windows[0].irradiationKwhM2.direct;
    const wOpen = simulateDay(open, TOKYO, WINTER).windows[0].irradiationKwhM2.direct;
    const wEave = simulateDay(eaved, TOKYO, WINTER).windows[0].irradiationKwhM2.direct;
    expect(sEave).toBeLessThan(sOpen * 0.5);
    expect(wEave).toBeGreaterThan(wOpen * 0.8);
  });

  it("a 2-story neighbor 6 m south slashes winter gain, not summer", () => {
    const neighbor = bare({
      obstacles: [{ x: 0, y: -(8 / 2 + 6 + 4), w: 8, d: 8, h: 6.5, rotDeg: 0 }],
    });
    const wOpen = simulateDay(bare(), TOKYO, WINTER).windows[0].gainKwh;
    const wBlocked = simulateDay(neighbor, TOKYO, WINTER).windows[0].gainKwh;
    const sOpen = simulateDay(bare(), TOKYO, SUMMER).windows[0].gainKwh;
    const sBlocked = simulateDay(neighbor, TOKYO, SUMMER).windows[0].gainKwh;
    expect(wBlocked).toBeLessThan(wOpen * 0.55);
    expect(sBlocked).toBeGreaterThan(sOpen * 0.85);
  });

  it("gain = η · area · irradiation, and totals add up", () => {
    const r = simulateDay(bare(), TOKYO, WINTER);
    const w = r.windows[0];
    expect(w.gainKwh).toBeCloseTo(w.spec.shgc * w.areaM2 * w.irradiationKwhM2.total, 6);
    const parts = w.irradiationKwhM2;
    expect(parts.total).toBeCloseTo(
      parts.direct + parts.circumsolar + parts.isotropic + parts.reflected,
      9,
    );
    expect(r.totalGainKwh).toBeCloseTo(
      r.windows.reduce((s, x) => s + x.gainKwh, 0),
      9,
    );
  });

  it("sunshine minutes stay within the daylight span", () => {
    const winter = simulateDay(bare(), TOKYO, WINTER).windows[0];
    // Tokyo winter-solstice daylight ≈ 585 min; DNI<120 near the horizon.
    expect(winter.sunshineMinutes).toBeGreaterThan(300);
    expect(winter.sunshineMinutes).toBeLessThan(590);
  });

  it("polar night yields zero everywhere", () => {
    const tromso = { lat: 69.6492, lng: 18.9553 };
    const r = simulateDay(bare(), tromso, new Date("2026-12-21T23:00:00Z"));
    expect(r.totalGainKwh).toBe(0);
    expect(r.windows[0].sunshineMinutes).toBe(0);
  });

  it("default house simulates fast enough for on-demand UI use", () => {
    const model = clampHouse(defaultHouse());
    const t0 = performance.now();
    const r = simulateDay(model, TOKYO, WINTER);
    const elapsed = performance.now() - t0;
    expect(r.windows).toHaveLength(6);
    expect(elapsed).toBeLessThan(500); // generous CI bound; locally ~40-80 ms
  });

  it("magnitudes are physically plausible (clear winter south ≈ 3.5-6 kWh/m²/day)", () => {
    // Hand check: noon DNI(TL=3, z≈58°)≈750 W/m² × cosθ≈0.85 ≈ 640 W/m²,
    // ~9.7 h half-sine-ish → ≈4 kWh direct + diffuse/reflected ≈ 1-1.5.
    // Monthly-MEAN south-vertical (NEDO, incl. cloud) is ~2.5-3, so a
    // clear-sky day sitting above that is expected.
    const w = simulateDay(bare(), TOKYO, WINTER).windows[0];
    expect(w.irradiationKwhM2.total).toBeGreaterThan(3.5);
    expect(w.irradiationKwhM2.total).toBeLessThan(6);
  });
});

describe("simulateDay — interior floor-patch invariants", () => {
  it("unobstructed south window casts a real floor patch, deeper in winter than summer", () => {
    const summer = simulateDay(bare(), TOKYO, SUMMER).windows[0];
    const winter = simulateDay(bare(), TOKYO, WINTER).windows[0];
    expect(summer.maxPatchAreaM2).toBeGreaterThan(0);
    expect(summer.interiorLitMinutes).toBeGreaterThan(0);
    expect(winter.maxPatchAreaM2).toBeGreaterThan(0);
    // Lower winter noon sun sends the beam deeper into the room.
    expect(winter.maxPatchDepthM).toBeGreaterThan(summer.maxPatchDepthM);
  });

  it("north windows get no interior patch on the winter solstice", () => {
    const north = bare({ windows: [{ ...southWindow, face: 2 }] });
    const winter = simulateDay(north, TOKYO, WINTER).windows[0];
    expect(winter.maxPatchAreaM2).toBe(0);
    expect(winter.maxPatchDepthM).toBe(0);
    expect(winter.interiorLitMinutes).toBe(0);
  });

  it("an eave that blocks the beam also blocks the interior patch", () => {
    const eaved = bare({ eaveOut: 0.91 });
    const r = simulateDay(eaved, TOKYO, SUMMER).windows[0];
    // Direct beam is heavily cut at the summer solstice (existing invariant
    // above); the residual floor patch should be small or absent too.
    expect(r.maxPatchAreaM2).toBeLessThan(2);
  });

  it("a wall of neighbor directly in front blocks the interior patch entirely", () => {
    const blocked = bare({
      obstacles: [{ x: 0, y: -(8 / 2 + 0.5 + 1), w: 30, d: 1, h: 20, rotDeg: 0 }],
    });
    const r = simulateDay(blocked, TOKYO, WINTER).windows[0];
    expect(r.maxPatchAreaM2).toBe(0);
    expect(r.interiorLitMinutes).toBe(0);
  });

  it("polar night has no interior patch either", () => {
    const tromso = { lat: 69.6492, lng: 18.9553 };
    const r = simulateDay(bare(), tromso, new Date("2026-12-21T23:00:00Z")).windows[0];
    expect(r.maxPatchAreaM2).toBe(0);
    expect(r.interiorLitMinutes).toBe(0);
  });
});
