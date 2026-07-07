// Rough timezone estimation for remote locations. The nautical rule
// (15° of longitude per hour) misses political boundaries by up to ~2h, so
// it is only auto-applied when it clearly beats the device timezone; the
// manual UTC-offset setting always remains available to fine-tune.

export function estimateUtcOffsetMin(lng: number): number {
  const r = Math.round(lng / 15) * 60;
  return r === 0 ? 0 : r; // normalize -0 (Greenwich-adjacent west longitudes)
}

/**
 * Offset to auto-apply when the location changes, or null to keep the
 * device timezone. Conservative: within ±90 min of the device offset the
 * device timezone wins (avoids breaking e.g. western Japan, where the
 * nautical estimate crosses an hour boundary inside one legal zone).
 */
export function autoUtcOffsetMin(lng: number, deviceOffsetMin: number): number | null {
  const estimated = estimateUtcOffsetMin(lng);
  return Math.abs(estimated - deviceOffsetMin) > 90 ? estimated : null;
}

/** The device's own UTC offset in minutes (east-positive). */
export function deviceUtcOffsetMin(now: Date = new Date()): number {
  return -now.getTimezoneOffset();
}
