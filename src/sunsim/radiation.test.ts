import {
  SOLAR_CONSTANT,
  altitudePressure,
  cosIncidence,
  extraterrestrialNormal,
  ineichenClearSky,
  poaComponents,
  relativeAirmass,
} from "./radiation";
import {
  FIXTURE_DNI_EXTRA,
  HAYDAVIES_CASES,
  INEICHEN_CASES,
} from "./__fixtures__/clearsky";

const rel = (actual: number, expected: number): number =>
  expected === 0 ? Math.abs(actual) : Math.abs(actual - expected) / Math.abs(expected);

describe("airmass / pressure primitives vs pvlib", () => {
  it("matches the fixture absolute airmass to 1e-9 (same formulas)", () => {
    for (const c of INEICHEN_CASES) {
      const amAbs = relativeAirmass(c.zenith) * (altitudePressure(c.altitudeM) / 101_325);
      expect(rel(amAbs, c.amAbs), `z=${c.zenith} h=${c.altitudeM}`).toBeLessThan(1e-9);
    }
  });

  it("sea-level pressure is 101325 Pa and falls with altitude", () => {
    expect(altitudePressure(0)).toBeCloseTo(101_325, 0);
    expect(altitudePressure(1000)).toBeLessThan(altitudePressure(0));
    expect(altitudePressure(1000)).toBeCloseTo(89_875, -2);
  });

  it("airmass is ~1 overhead and grows toward the horizon", () => {
    expect(relativeAirmass(0)).toBeCloseTo(1, 2);
    expect(relativeAirmass(60)).toBeCloseTo(2, 1);
    expect(relativeAirmass(85)).toBeGreaterThan(10);
    // z>90 clamps instead of blowing up.
    expect(relativeAirmass(95)).toBe(relativeAirmass(89.999));
  });

  it("extraterrestrial irradiance scales as 1/d²", () => {
    expect(extraterrestrialNormal(1)).toBe(SOLAR_CONSTANT);
    expect(extraterrestrialNormal(2)).toBeCloseTo(SOLAR_CONSTANT / 4, 9);
  });
});

describe("ineichenClearSky vs pvlib fixtures (±0.1%)", () => {
  for (const c of INEICHEN_CASES) {
    it(`z=${c.zenith}° TL=${c.tl} h=${c.altitudeM}m`, () => {
      const out = ineichenClearSky(c.zenith, c.tl, c.altitudeM, FIXTURE_DNI_EXTRA);
      expect(rel(out.ghi, c.ghi), "ghi").toBeLessThan(1e-3);
      expect(rel(out.dni, c.dni), "dni").toBeLessThan(1e-3);
      expect(rel(out.dhi, c.dhi), "dhi").toBeLessThan(1e-3);
    });
  }

  it("returns zeros at and below the horizon", () => {
    expect(ineichenClearSky(90, 3, 0, 1361)).toEqual({ ghi: 0, dni: 0, dhi: 0 });
    expect(ineichenClearSky(100, 3, 0, 1361)).toEqual({ ghi: 0, dni: 0, dhi: 0 });
  });

  it("physical invariants: DNI ≤ E0n, DHI ≥ 0, GHI grows with sun height", () => {
    for (const c of INEICHEN_CASES) {
      const out = ineichenClearSky(c.zenith, c.tl, c.altitudeM, FIXTURE_DNI_EXTRA);
      expect(out.dni).toBeLessThanOrEqual(FIXTURE_DNI_EXTRA);
      expect(out.dhi).toBeGreaterThanOrEqual(0);
    }
    const low = ineichenClearSky(70, 3, 0, 1361);
    const high = ineichenClearSky(20, 3, 0, 1361);
    expect(high.ghi).toBeGreaterThan(low.ghi);
  });

  it("higher turbidity means less direct, more diffuse", () => {
    const clean = ineichenClearSky(30, 2, 0, 1361);
    const hazy = ineichenClearSky(30, 5, 0, 1361);
    expect(hazy.dni).toBeLessThan(clean.dni);
    expect(hazy.dhi).toBeGreaterThan(clean.dhi);
  });
});

describe("cosIncidence", () => {
  it("matches pvlib aoi_projection for the fixture cases", () => {
    for (const c of HAYDAVIES_CASES) {
      const v = cosIncidence(c.tilt, c.surfaceAz, c.zenith, c.solarAz);
      expect(rel(v, c.cosIncidence), `tilt=${c.tilt}`).toBeLessThan(1e-9);
    }
  });

  it("normal incidence gives 1, grazing gives 0", () => {
    expect(cosIncidence(90, 180, 90, 180)).toBeCloseTo(1, 9);
    expect(cosIncidence(0, 0, 0, 0)).toBeCloseTo(1, 9);
    expect(cosIncidence(90, 180, 0, 180)).toBeCloseTo(0, 9);
    expect(cosIncidence(90, 0, 90, 180)).toBeCloseTo(-1, 9);
  });
});

describe("poaComponents (Hay–Davies + reflection)", () => {
  it("matches pvlib haydavies sky diffuse for the fixtures (±0.1%)", () => {
    for (const c of HAYDAVIES_CASES) {
      const out = poaComponents({
        sky: { ghi: 0, dni: c.dni, dhi: c.dhi }, // ghi unused for sky diffuse
        dniExtra: FIXTURE_DNI_EXTRA,
        cosTheta: c.cosIncidence,
        solarZenithDeg: c.zenith,
        surfaceTiltDeg: c.tilt,
        albedo: 0,
        directFraction: 1,
        svfRatio: 1,
      });
      const skyDiffuse = out.circumsolar + out.isotropic;
      expect(rel(skyDiffuse, c.skyDiffuse), `tilt=${c.tilt} z=${c.zenith}`).toBeLessThan(
        1e-3,
      );
    }
  });

  it("horizontal identity: POA total equals GHI exactly", () => {
    const sky = ineichenClearSky(40, 3, 0, 1361);
    const out = poaComponents({
      sky,
      dniExtra: 1361,
      cosTheta: cosIncidence(0, 0, 40, 210),
      solarZenithDeg: 40,
      surfaceTiltDeg: 0,
      albedo: 0.2, // (1-cos0)/2 = 0 → reflected is 0 regardless
      directFraction: 1,
      svfRatio: 1,
    });
    expect(out.total).toBeCloseTo(sky.ghi, 9);
    expect(out.reflected).toBe(0);
  });

  it("sun behind the surface leaves only diffuse components", () => {
    const sky = ineichenClearSky(60, 3, 0, 1361);
    const out = poaComponents({
      sky,
      dniExtra: 1361,
      cosTheta: cosIncidence(90, 0, 60, 180), // north wall, sun due south
      solarZenithDeg: 60,
      surfaceTiltDeg: 90,
      albedo: 0.2,
      directFraction: 1,
      svfRatio: 1,
    });
    expect(out.direct).toBe(0);
    expect(out.circumsolar).toBe(0);
    expect(out.isotropic).toBeGreaterThan(0);
    expect(out.reflected).toBeGreaterThan(0);
  });

  it("shading scales beam+circumsolar; SVF scales isotropic only", () => {
    const sky = ineichenClearSky(45, 3, 0, 1361);
    const base = {
      sky,
      dniExtra: 1361,
      cosTheta: cosIncidence(90, 180, 45, 180),
      solarZenithDeg: 45,
      surfaceTiltDeg: 90,
      albedo: 0.2,
    };
    const open = poaComponents({ ...base, directFraction: 1, svfRatio: 1 });
    const shaded = poaComponents({ ...base, directFraction: 0.25, svfRatio: 0.8 });
    expect(shaded.direct).toBeCloseTo(open.direct * 0.25, 9);
    expect(shaded.circumsolar).toBeCloseTo(open.circumsolar * 0.25, 9);
    expect(shaded.isotropic).toBeCloseTo(open.isotropic * 0.8, 9);
    expect(shaded.reflected).toBeCloseTo(open.reflected, 9);
  });

  it("zero dniExtra guards the anisotropy index", () => {
    const out = poaComponents({
      sky: { ghi: 100, dni: 0, dhi: 100 },
      dniExtra: 0,
      cosTheta: 0.5,
      solarZenithDeg: 60,
      surfaceTiltDeg: 90,
      albedo: 0.2,
      directFraction: 1,
      svfRatio: 1,
    });
    expect(Number.isFinite(out.total)).toBe(true);
  });

  it("Tokyo band check (TL=3): noon GHI ranges from literature", () => {
    // Summer-solstice noon z≈12.2°, winter-solstice noon z≈58.1° at 35.68°N.
    const summer = ineichenClearSky(12.2, 3, 0, extraterrestrialNormal(1.0163));
    const winter = ineichenClearSky(58.1, 3, 0, extraterrestrialNormal(0.9837));
    expect(summer.ghi).toBeGreaterThan(850);
    expect(summer.ghi).toBeLessThan(1050);
    expect(winter.ghi).toBeGreaterThan(420);
    expect(winter.ghi).toBeLessThan(560);
  });
});
