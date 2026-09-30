// @vitest-environment jsdom
import { applySkyGradient, skyColors } from "./skyGradient";

describe("skyColors", () => {
  it("interpolates between stops and clamps outside them", () => {
    expect(skyColors(-90)).toEqual(skyColors(-30));
    expect(skyColors(90)).toEqual(skyColors(40));
    expect(skyColors(-30).top).toBe("rgb(4 5 14)");
    expect(skyColors(40).bottom).toBe("rgb(178 215 243)");
    // Halfway between the 0° and 6° stops.
    expect(skyColors(3).top).toBe("rgb(47 73 132)");
  });

  it("calls the sky dark only past the end of nautical twilight", () => {
    // The dark theme's dim text on a nested pill needs the sky this dark to
    // keep 4.5:1 (styles.css switches the panels to a solid surface above).
    expect(skyColors(-12.01).dark).toBe(true);
    expect(skyColors(-12).dark).toBe(false);
    expect(skyColors(-5).dark).toBe(false);
    expect(skyColors(30).dark).toBe(false);
  });
});

describe("applySkyGradient", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    delete document.documentElement.dataset.sky;
  });

  it("writes the gradient and the brightness flag onto :root", () => {
    applySkyGradient(20);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--sky-top")).toMatch(/^rgb\(/);
    expect(root.style.getPropertyValue("--sky-bottom")).toMatch(/^rgb\(/);
    expect(root.dataset.sky).toBe("bright");
    applySkyGradient(-20);
    expect(root.dataset.sky).toBe("dark");
  });
});
