import { destinationPoint, rayLine } from "./rays";

describe("destinationPoint", () => {
  it("due north moves ~1° latitude per 111.2 km", () => {
    const to = destinationPoint({ lat: 35, lng: 139 }, 0, 111.195);
    expect(to.lat).toBeCloseTo(36, 2);
    expect(to.lng).toBeCloseTo(139, 6);
  });

  it("due east from the equator moves longitude only", () => {
    const to = destinationPoint({ lat: 0, lng: 0 }, 90, 111.195);
    expect(to.lat).toBeCloseTo(0, 6);
    expect(to.lng).toBeCloseTo(1, 2);
  });

  it("due south and west reverse the motion", () => {
    const to = destinationPoint({ lat: 35, lng: 139 }, 180, 111.195);
    expect(to.lat).toBeCloseTo(34, 2);
    const west = destinationPoint({ lat: 0, lng: 139 }, 270, 111.195);
    expect(west.lng).toBeCloseTo(138, 2);
  });

  it("normalizes longitude across the antimeridian", () => {
    const to = destinationPoint({ lat: 0, lng: 179.5 }, 90, 111.195);
    expect(to.lng).toBeCloseTo(-179.5, 2);
    const back = destinationPoint({ lat: 0, lng: -179.5 }, 270, 111.195);
    expect(back.lng).toBeCloseTo(179.5, 2);
  });

  it("handles a pole-crossing distance without NaN", () => {
    const to = destinationPoint({ lat: 89.5, lng: 0 }, 0, 200);
    expect(Number.isFinite(to.lat)).toBe(true);
    expect(Number.isFinite(to.lng)).toBe(true);
    expect(to.lat).toBeLessThanOrEqual(90);
  });
});

describe("rayLine", () => {
  it("starts at the origin and ends at the destination", () => {
    const [from, to] = rayLine({ lat: 35.68, lng: 139.65 }, 45, 100);
    expect(from).toEqual([35.68, 139.65]);
    expect(to[0]).toBeGreaterThan(35.68); // NE: north
    expect(to[1]).toBeGreaterThan(139.65); // NE: east
  });

  it("unwraps the end longitude across the antimeridian (east)", () => {
    const [, to] = rayLine({ lat: 0, lng: 179.8 }, 90, 111.195);
    expect(to[1]).toBeCloseTo(180.8, 1); // not -179.2
  });

  it("unwraps the end longitude across the antimeridian (west)", () => {
    const [, to] = rayLine({ lat: 0, lng: -179.8 }, 270, 111.195);
    expect(to[1]).toBeCloseTo(-180.8, 1);
  });
});
