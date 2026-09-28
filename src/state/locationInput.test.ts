import { normalizeLocationName, parseLatLng } from "./locationInput";

describe("parseLatLng", () => {
  it("reads a plain 'lat, lng' pair", () => {
    expect(parseLatLng("35.4876, 139.4061")).toEqual({ lat: 35.4876, lng: 139.4061 });
  });

  it("accepts spaces, tabs or a bare comma as the separator", () => {
    expect(parseLatLng("35.4876 139.4061")).toEqual({ lat: 35.4876, lng: 139.4061 });
    expect(parseLatLng("35.4876\t139.4061")).toEqual({ lat: 35.4876, lng: 139.4061 });
    expect(parseLatLng("35.4876,139.4061")).toEqual({ lat: 35.4876, lng: 139.4061 });
  });

  it("normalizes full-width digits, commas, periods and minus signs", () => {
    expect(parseLatLng("３５．４８７６，　１３９．４０６１")).toEqual({
      lat: 35.4876,
      lng: 139.4061,
    });
    expect(parseLatLng("35.48、139.40")).toEqual({ lat: 35.48, lng: 139.4 });
    expect(parseLatLng("−33.8688, 151.2093")).toEqual({ lat: -33.8688, lng: 151.2093 });
    expect(parseLatLng("－33.8688，151.2093")).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it("ignores surrounding brackets and whitespace (pasted from a map app)", () => {
    expect(parseLatLng("  (35.68, 139.76)  ")).toEqual({ lat: 35.68, lng: 139.76 });
    expect(parseLatLng("[35.68, 139.76]")).toEqual({ lat: 35.68, lng: 139.76 });
  });

  it("rejects anything that is not exactly two in-range numbers", () => {
    expect(parseLatLng("")).toBeNull();
    expect(parseLatLng("Tokyo")).toBeNull();
    expect(parseLatLng("35.68")).toBeNull();
    expect(parseLatLng("35.68, 139.76, 10")).toBeNull();
    expect(parseLatLng("95, 139")).toBeNull();
    expect(parseLatLng("35, 181")).toBeNull();
    expect(parseLatLng("35, abc")).toBeNull();
  });
});

describe("normalizeLocationName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeLocationName("  自宅　 の 庭 ")).toBe("自宅 の 庭");
  });

  it("returns null for an empty name", () => {
    expect(normalizeLocationName("")).toBeNull();
    expect(normalizeLocationName(" 　 ")).toBeNull();
  });

  it("caps the length so the header chip stays short", () => {
    const long = "あ".repeat(40);
    expect(normalizeLocationName(long)).toBe("あ".repeat(24));
  });
});
