// @vitest-environment jsdom
import { drawOverlay } from "./overlay";
import type { OverlayData } from "./overlay";
import { createFakeContext2D } from "../../test-utils/fakeCanvas";

const DATA: OverlayData = {
  sun: { azimuth: 180, altitude: 30 },
  moon: { azimuth: 90, altitude: 10 },
  sunPath: [
    { azimuth: 120, altitude: -5 },
    { azimuth: 150, altitude: 20 },
    { azimuth: 180, altitude: 30 },
    { azimuth: 210, altitude: 20 },
    { azimuth: 300, altitude: -10 },
    { azimuth: 330, altitude: -30 },
  ],
  moonPath: [{ azimuth: 90, altitude: 10 }],
  labels: { north: "北", east: "東", south: "南", west: "西" },
  sunLabel: "太陽 30°",
  moonLabel: "月 50%",
};

describe("AR overlay", () => {
  it("labels the sun and the compass when facing south", () => {
    const { ctx, texts } = createFakeContext2D();
    drawOverlay(ctx, DATA, { heading: 180, pitch: 20, roll: 5 }, 400, 800);
    expect(texts).toContain("太陽 30°");
    expect(texts).toContain("南");
    expect(texts).toContain("180°");
    expect(texts).not.toContain("北");
    expect(texts).not.toContain("月 50%");
  });

  it("shows the moon and north when turned that way", () => {
    const { ctx, texts } = createFakeContext2D();
    drawOverlay(ctx, DATA, { heading: 45, pitch: 5, roll: 0 }, 800, 400);
    expect(texts).toContain("月 50%");
    expect(texts).toContain("北");
    expect(texts).toContain("東");
    expect(texts).not.toContain("太陽 30°");
  });

  it("still labels the compass when looking high above the horizon", () => {
    const { ctx, texts } = createFakeContext2D();
    drawOverlay(ctx, DATA, { heading: 270, pitch: 60, roll: 0 }, 800, 400);
    expect(texts).toContain("西");
    expect(texts).toContain("270°");
  });
});
