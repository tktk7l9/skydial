// Light bootstrap. Only the dashboard + astro math ship in the initial bundle;
// the Three.js dome, Leaflet map and AR view load on demand per tab.

import "./styles.css";
import { startApp } from "./app";

// Cloudflare Web Analytics — production only. The site token is a public
// identifier embedded in every page, not a secret.
if (import.meta.env.PROD) {
  const beacon = document.createElement("script");
  beacon.type = "module";
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.dataset.cfBeacon = '{"token": "cd156fbf0fd24da0a12e58fdb4e63828"}';
  document.head.appendChild(beacon);
}

const app = document.querySelector<HTMLDivElement>("#app");
if (app) startApp(app);

// Register the service worker for offline use (production only).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
