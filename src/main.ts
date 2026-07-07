// Light bootstrap. Only the dashboard + astro math ship in the initial bundle;
// the Three.js dome, Leaflet map and AR view load on demand per tab.

import "./styles.css";

// Vercel Web Analytics — production only. Script + beacon are same-origin
// (/_vercel/insights/*), so the strict CSP (script-src/connect-src 'self') is unaffected.
if (import.meta.env.PROD) {
  void import("@vercel/analytics").then(({ inject }) => inject());
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) app.textContent = "Skydial — scaffolding";

// Register the service worker for offline use (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
