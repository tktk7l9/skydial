import source from "../public/sw.js?raw";

// public/sw.js runs outside the bundle, so it is exercised here against a
// small fake of the service-worker globals (self, caches, fetch, location).
// Response/Request come from Node itself.

const ORIGIN = "https://skydial.example";

type Handler = (event: FakeEvent) => void;

interface FakeEvent {
  request: Request;
  respondWith: (p: Promise<Response | undefined> | Response) => void;
  waitUntil: (p: Promise<unknown>) => void;
}

interface Harness {
  handlers: Record<string, Handler>;
  store: Map<string, Map<string, Response>>;
  fetch: ReturnType<typeof vi.fn>;
  skipWaiting: ReturnType<typeof vi.fn>;
  claim: ReturnType<typeof vi.fn>;
  /** Dispatch a fetch event and settle the response plus every waitUntil. */
  dispatch: (req: Request) => Promise<Response | undefined>;
  install: () => Promise<void>;
  activate: () => Promise<void>;
}

function boot(): Harness {
  const handlers: Record<string, Handler> = {};
  const store = new Map<string, Map<string, Response>>();
  const key = (r: Request | string): string => new URL(typeof r === "string" ? r : r.url, ORIGIN).href;
  const fetch = vi.fn();
  const skipWaiting = vi.fn().mockResolvedValue(undefined);
  const claim = vi.fn().mockResolvedValue(undefined);

  const openCache = (name: string) => {
    const m = store.get(name) ?? new Map<string, Response>();
    store.set(name, m);
    return {
      addAll: async (urls: string[]) => {
        for (const u of urls) {
          const res: Response = await fetch(new Request(key(u)));
          if (!res.ok) throw new TypeError("addAll: request failed");
          m.set(key(u), res);
        }
      },
      put: async (r: Request | string, res: Response) => {
        m.set(key(r), res);
      },
      match: async (r: Request | string) => m.get(key(r)),
    };
  };
  const caches = {
    open: async (name: string) => openCache(name),
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (r: Request | string) => {
      for (const m of store.values()) {
        const hit = m.get(key(r));
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn;
    },
    skipWaiting,
    clients: { claim },
  };

  new Function("self", "caches", "location", "fetch", source)(
    self,
    caches,
    { origin: ORIGIN },
    fetch,
  );

  const run = async (type: string, request: Request): Promise<Response | undefined> => {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response | undefined> | Response | undefined;
    handlers[type]({
      request,
      respondWith: (p) => {
        response = p;
      },
      waitUntil: (p) => pending.push(p),
    });
    const res = await response;
    await Promise.all(pending);
    return res;
  };

  return {
    handlers,
    store,
    fetch,
    skipWaiting,
    claim,
    dispatch: (req) => run("fetch", req),
    install: async () => {
      await run("install", new Request(ORIGIN));
    },
    activate: async () => {
      await run("activate", new Request(ORIGIN));
    },
  };
}

// Node's Request refuses mode "navigate", so navigations are plain objects
// carrying the three fields sw.js reads (fetch is mocked).
function navigate(path: string): Request {
  return { url: new URL(path, ORIGIN).href, method: "GET", mode: "navigate" } as Request;
}

function cachedUrls(h: Harness): string[] {
  return [...(h.store.get("skydial-v3")?.keys() ?? [])];
}

describe("public/sw.js", () => {
  it("precaches the shell under '/' (never '/index.html', which redirects on Workers)", async () => {
    const h = boot();
    h.fetch.mockImplementation(async () => new Response("ok"));
    await h.install();
    expect(cachedUrls(h)).toContain(`${ORIGIN}/`);
    expect(cachedUrls(h)).not.toContain(`${ORIGIN}/index.html`);
    expect(h.skipWaiting).toHaveBeenCalled();
  });

  it("drops caches from older versions on activate and claims clients", async () => {
    const h = boot();
    h.store.set("skydial-v2", new Map());
    h.store.set("skydial-v3", new Map());
    await h.activate();
    expect([...h.store.keys()]).toEqual(["skydial-v3"]);
    expect(h.claim).toHaveBeenCalled();
  });

  it("ignores non-GET and cross-origin requests", async () => {
    const h = boot();
    expect(await h.dispatch(new Request(`${ORIGIN}/`, { method: "POST" }))).toBeUndefined();
    expect(
      await h.dispatch(new Request("https://tile.openstreetmap.org/1/1/1.png")),
    ).toBeUndefined();
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("serves navigations from the network and refreshes the shell with a 200", async () => {
    const h = boot();
    h.fetch.mockResolvedValue(new Response("<html>new</html>", { status: 200 }));
    const res = await h.dispatch(navigate("/?lat=35"));
    expect(await res?.text()).toBe("<html>new</html>");
    expect(cachedUrls(h)).toEqual([`${ORIGIN}/`]);
    expect(await h.store.get("skydial-v3")?.get(`${ORIGIN}/`)?.text()).toBe("<html>new</html>");
  });

  it("never lets a 404, 5xx or redirect replace the offline shell", async () => {
    const h = boot();
    const shell = new Response("<html>shell</html>");
    h.store.set("skydial-v3", new Map([[`${ORIGIN}/`, shell]]));

    h.fetch.mockResolvedValueOnce(new Response("missing", { status: 404 }));
    expect((await h.dispatch(navigate("/nope")))?.status).toBe(404);
    h.fetch.mockResolvedValueOnce(new Response("down", { status: 503 }));
    expect((await h.dispatch(navigate("/")))?.status).toBe(503);
    h.fetch.mockResolvedValueOnce(Response.redirect(`${ORIGIN}/`, 307));
    expect((await h.dispatch(navigate("/index.html")))?.status).toBe(307);
    const followed = new Response("<html>followed</html>");
    Object.defineProperty(followed, "redirected", { value: true });
    h.fetch.mockResolvedValueOnce(followed);
    expect((await h.dispatch(navigate("/index.html")))?.redirected).toBe(true);

    expect(h.store.get("skydial-v3")?.get(`${ORIGIN}/`)).toBe(shell);
  });

  it("falls back to the cached shell for any navigation while offline", async () => {
    const h = boot();
    h.store.set("skydial-v3", new Map([[`${ORIGIN}/`, new Response("<html>shell</html>")]]));
    h.fetch.mockRejectedValue(new TypeError("offline"));
    const res = await h.dispatch(navigate("/?tab=dome"));
    expect(await res?.text()).toBe("<html>shell</html>");
  });

  it("serves same-origin assets cache-first and caches only successful fetches", async () => {
    const h = boot();
    h.fetch.mockResolvedValueOnce(new Response("js", { status: 200 }));
    const first = await h.dispatch(new Request(`${ORIGIN}/assets/app-abc.js`));
    expect(await first?.text()).toBe("js");
    expect(cachedUrls(h)).toEqual([`${ORIGIN}/assets/app-abc.js`]);

    // Second request is answered from the cache without touching the network.
    const second = await h.dispatch(new Request(`${ORIGIN}/assets/app-abc.js`));
    expect(await second?.text()).toBe("js");
    expect(h.fetch).toHaveBeenCalledTimes(1);

    // An error response is passed through but not stored.
    h.fetch.mockResolvedValueOnce(new Response("gone", { status: 404 }));
    const missing = await h.dispatch(new Request(`${ORIGIN}/assets/old.js`));
    expect(missing?.status).toBe(404);
    expect(cachedUrls(h)).toEqual([`${ORIGIN}/assets/app-abc.js`]);
  });
});
