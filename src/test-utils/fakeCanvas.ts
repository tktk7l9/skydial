// jsdom has no 2D canvas. This stand-in accepts every drawing call and keeps
// the text that was drawn, so tests can assert what a viewer would read.

export interface FakeContext2D {
  texts: string[];
  ctx: CanvasRenderingContext2D;
}

export function createFakeContext2D(): FakeContext2D {
  const texts: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      if (key === "fillText") return (text: string) => texts.push(text);
      if (key === "createRadialGradient" || key === "createLinearGradient") return () => gradient;
      if (key === "measureText") return (text: string) => ({ width: text.length * 8 });
      return () => undefined;
    },
    set(obj, key, value) {
      obj[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { texts, ctx };
}

/** Make every <canvas> hand out a fake 2D context; returns the latest one. */
export function stubCanvas(): { latest(): FakeContext2D; restore(): void } {
  const original = HTMLCanvasElement.prototype.getContext;
  let last: FakeContext2D | null = null;
  const contexts = new WeakMap<HTMLCanvasElement, FakeContext2D>();
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
    let fake = contexts.get(this);
    if (fake === undefined) {
      fake = createFakeContext2D();
      contexts.set(this, fake);
    }
    last = fake;
    return fake.ctx;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return {
    latest: () => {
      if (last === null) throw new Error("no canvas context requested yet");
      return last;
    },
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original;
    },
  };
}
