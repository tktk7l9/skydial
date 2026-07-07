// Geodesic helper for the map view: destination point given a start, an
// azimuth and a distance (spherical earth — meters-level error is irrelevant
// for drawing direction rays).

import type { GeoLocation } from "../../astro/types";

const EARTH_RADIUS_KM = 6371;

/** Destination point `distanceKm` along `azimuthDeg` (N=0°, clockwise). */
export function destinationPoint(
  from: GeoLocation,
  azimuthDeg: number,
  distanceKm: number,
): GeoLocation {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = (azimuthDeg * Math.PI) / 180;
  const φ1 = (from.lat * Math.PI) / 180;
  const λ1 = (from.lng * Math.PI) / 180;

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(Math.min(1, Math.max(-1, sinφ2)));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * sinφ2,
    );

  const lat = (φ2 * 180) / Math.PI;
  let lng = (λ2 * 180) / Math.PI;
  // Normalize to [-180, 180) so antimeridian rays stay drawable.
  lng = ((lng + 540) % 360) - 180;
  return { lat, lng };
}

/** Polyline for a direction ray as [[lat,lng],[lat,lng]] (Leaflet order). */
export function rayLine(
  from: GeoLocation,
  azimuthDeg: number,
  distanceKm: number,
): [[number, number], [number, number]] {
  const to = destinationPoint(from, azimuthDeg, distanceKm);
  let toLng = to.lng;
  // If the ray crosses the antimeridian, unwrap the end longitude so Leaflet
  // draws a short segment instead of one spanning the whole world.
  if (Math.abs(toLng - from.lng) > 180) {
    toLng += toLng < from.lng ? 360 : -360;
  }
  return [
    [from.lat, from.lng],
    [to.lat, toLng],
  ];
}
