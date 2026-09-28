// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

// Production-only wiring: analytics beacon, service-worker registration and
// the "new version" prompt when a new worker takes over.

type Listener = () => void;

function fakeServiceWorker(controlled: boolean) {
  const listeners: Record<string, Listener[]> = {};
  const sw = {
    controller: controlled ? {} : null,
    register: vi.fn().mockResolvedValue(undefined),
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
    fire: (type: string) => listeners[type]?.forEach((fn) => fn()),
  };
  Object.defineProperty(navigator, "serviceWorker", { value: sw, configurable: true });
  return sw;
}

async function boot(): Promise<void> {
  vi.resetModules();
  document.head.replaceChildren();
  document.body.innerHTML = '<div id="app"></div>';
  history.replaceState(null, "", "/");
  await import("./main");
}

describe("entry point", () => {
  beforeEach(() => localStorage.setItem("skydial:locale", "ja"));
  afterEach(() => {
    vi.unstubAllEnvs();
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    document.body.replaceChildren();
  });

  it("starts the app in development without analytics or a service worker", async () => {
    const sw = fakeServiceWorker(false);
    await boot();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(document.head.querySelector("script")).toBeNull();
    window.dispatchEvent(new Event("load"));
    expect(sw.register).not.toHaveBeenCalled();
  });

  it("does nothing without an #app element", async () => {
    vi.resetModules();
    document.body.replaceChildren();
    await import("./main");
    expect(document.body).toBeEmptyDOMElement();
  });

  describe("in production", () => {
    beforeEach(() => vi.stubEnv("PROD", true));

    it("adds the analytics beacon and registers the service worker on load", async () => {
      const sw = fakeServiceWorker(false);
      await boot();
      expect(document.head.querySelector("script")?.src).toContain("cloudflareinsights.com");
      window.dispatchEvent(new Event("load"));
      expect(sw.register).toHaveBeenCalledWith("/sw.js");
    });

    it("stays quiet on the first install", async () => {
      const sw = fakeServiceWorker(false);
      await boot();
      sw.fire("controllerchange");
      expect(screen.queryByText(/新しいバージョンがあります/)).not.toBeInTheDocument();
      // A later update does prompt.
      sw.fire("controllerchange");
      expect(screen.getByRole("button", { name: /新しいバージョンがあります/ })).toBeVisible();
    });

    it("offers one reload when an update takes over", async () => {
      const sw = fakeServiceWorker(true);
      await boot();
      sw.fire("controllerchange");
      sw.fire("controllerchange");
      const prompts = screen.getAllByRole("button", { name: "新しいバージョンがあります — タップで更新" });
      expect(prompts).toHaveLength(1);
      const reload = vi.fn();
      const original = window.location;
      Object.defineProperty(window, "location", {
        value: { ...original, reload },
        configurable: true,
      });
      await userEvent.click(prompts[0]);
      Object.defineProperty(window, "location", { value: original, configurable: true });
      expect(reload).toHaveBeenCalled();
    });
  });
});
