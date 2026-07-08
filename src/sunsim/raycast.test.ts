import { anyHit, cross, dot, rayIntersectsTri, sub } from "./raycast";
import type { Tri, Vec3 } from "./raycast";

const tri: Tri = { a: [0, 0, 0], b: [2, 0, 0], c: [0, 2, 0] };

describe("vector helpers", () => {
  it("sub/cross/dot behave", () => {
    expect(sub([3, 2, 1], [1, 1, 1])).toEqual([2, 1, 0]);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
});

describe("rayIntersectsTri", () => {
  const origin: Vec3 = [0.5, 0.5, -1];
  const forward: Vec3 = [0, 0, 1];

  it("hits through the interior", () => {
    expect(rayIntersectsTri(origin, forward, tri)).toBe(true);
  });

  it("misses outside the triangle (u/v bounds)", () => {
    expect(rayIntersectsTri([3, 3, -1], forward, tri)).toBe(false);
    expect(rayIntersectsTri([-0.5, 0.5, -1], forward, tri)).toBe(false);
    expect(rayIntersectsTri([1.5, 1.5, -1], forward, tri)).toBe(false); // u+v>1
  });

  it("ignores hits behind the origin and within epsilon", () => {
    expect(rayIntersectsTri([0.5, 0.5, 1], forward, tri)).toBe(false); // behind
    expect(rayIntersectsTri([0.5, 0.5, -0.00005], forward, tri)).toBe(false); // t < 1e-4
  });

  it("rejects parallel rays", () => {
    expect(rayIntersectsTri([0.5, 0.5, -1], [1, 0, 0], tri)).toBe(false);
  });

  it("hits from either side (occluders are double-sided)", () => {
    expect(rayIntersectsTri([0.5, 0.5, 1], [0, 0, -1], tri)).toBe(true);
  });
});

describe("anyHit", () => {
  it("finds a hit in a soup and returns false on empty", () => {
    const far: Tri = { a: [0, 0, 5], b: [2, 0, 5], c: [0, 2, 5] };
    expect(anyHit([0.5, 0.5, -1], [0, 0, 1], [far, tri])).toBe(true);
    expect(anyHit([0.5, 0.5, -1], [0, 0, 1], [])).toBe(false);
  });
});
