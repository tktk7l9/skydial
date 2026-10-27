// Minimal offline support. Navigations are network-first (so deploys are picked
// up online) with a cached shell fallback; other same-origin GETs are
// cache-first with runtime caching (build assets are content-hashed).
// Cross-origin requests (map tiles) pass through untouched — the map tab is the
// only feature that needs the network; all astronomy runs locally.

const CACHE = "skydial-v3";
// The offline shell is keyed by "/" on purpose: Workers static assets answers
// "/index.html" with a redirect to "/", and a redirected response can never be
// handed to a navigation (its redirect mode is "manual"), so a shell cached
// under "/index.html" would fail the first offline open after install.
const SHELL_KEY = "/";
const SHELL = [
  SHELL_KEY,
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Store a copy of a successful, non-redirected response; the write is kept
 *  alive past the response so a terminated worker cannot leave it half done. */
function cacheIfOk(event, key, res) {
  // A 404/5xx page or a redirect (status 0 "opaqueredirect", or a followed
  // redirect) must never become what later requests are served from.
  if (!res.ok || res.redirected) return;
  const copy = res.clone();
  event.waitUntil(caches.open(CACHE).then((c) => c.put(key, copy)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          cacheIfOk(event, SHELL_KEY, res);
          return res;
        })
        .catch(() => caches.match(SHELL_KEY)),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          cacheIfOk(event, req, res);
          return res;
        }),
    ),
  );
});
