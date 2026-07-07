// The 24h "day" window that events are computed for: local midnight in the
// device timezone, or in a manually chosen UTC offset for remote locations.

export function dayStartFor(instant: Date, utcOffsetMin: number | null): Date {
  if (utcOffsetMin === null) {
    const d = new Date(instant);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const shifted = new Date(instant.getTime() + utcOffsetMin * 60_000);
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  return new Date(utcMidnight - utcOffsetMin * 60_000);
}

/** Fraction [0,1) of `instant` through its day window. */
export function dayFraction(instant: Date, utcOffsetMin: number | null): number {
  const start = dayStartFor(instant, utcOffsetMin).getTime();
  return (instant.getTime() - start) / 86_400_000;
}
