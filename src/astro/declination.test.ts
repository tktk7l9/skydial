import { declinationWestDeg } from "./declination";

describe("declinationWestDeg (GSI 2020.0 approximation)", () => {
  it("reference point 37°N 138°E gives the base value 8°15.822′", () => {
    expect(declinationWestDeg({ lat: 37, lng: 138 })).toBeCloseTo(8.2637, 3);
  });

  it("Tokyo is ~7.9°W, Sapporo ~9.3°W, Naha ~5.4°W (GSI chart values ±0.5°)", () => {
    // 磁気図2020.0の代表値と突合(市街の代表点)。
    expect(declinationWestDeg({ lat: 35.68, lng: 139.77 })).toBeCloseTo(7.9, 0);
    const sapporo = declinationWestDeg({ lat: 43.06, lng: 141.35 });
    expect(sapporo).toBeGreaterThan(8.7);
    expect(sapporo).toBeLessThan(9.9);
    const naha = declinationWestDeg({ lat: 26.21, lng: 127.68 });
    expect(naha).toBeGreaterThan(4.6);
    expect(naha).toBeLessThan(6.2);
  });

  it("declination grows northward and shrinks eastward (west-positive)", () => {
    const south = declinationWestDeg({ lat: 31, lng: 131 }) as number;
    const north = declinationWestDeg({ lat: 44, lng: 143 }) as number;
    expect(north).toBeGreaterThan(south);
    const west = declinationWestDeg({ lat: 35, lng: 133 }) as number;
    const east = declinationWestDeg({ lat: 35, lng: 140 }) as number;
    expect(west).toBeGreaterThan(east);
  });

  it("returns null outside the model range", () => {
    expect(declinationWestDeg({ lat: 51.5, lng: -0.13 })).toBeNull(); // London
    expect(declinationWestDeg({ lat: -33.87, lng: 151.21 })).toBeNull(); // Sydney
    expect(declinationWestDeg({ lat: 19.9, lng: 140 })).toBeNull(); // south of range
    expect(declinationWestDeg({ lat: 35, lng: 154.1 })).toBeNull(); // east of range
  });
});
