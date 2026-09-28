// Shared setup for the jsdom-based UI tests. Node-environment tests (the
// pure lib layer) load this too, so every DOM stub is guarded.

import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  // jsdom ships none of these; the UI only needs them to exist.
  class NoopResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver ??= NoopResizeObserver as unknown as typeof ResizeObserver;

  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture ??= () => undefined;
  proto.releasePointerCapture ??= () => undefined;
  proto.hasPointerCapture ??= () => false;
}
