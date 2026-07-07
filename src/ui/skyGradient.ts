// The page background is a sky gradient keyed to the sun's altitude — the
// backdrop itself tells you which light phase you're in.

interface SkyStop {
  alt: number;
  top: [number, number, number];
  bottom: [number, number, number];
}

// From deep night through golden hour to full day.
const STOPS: SkyStop[] = [
  { alt: -30, top: [4, 5, 14], bottom: [10, 14, 34] },
  { alt: -18, top: [5, 6, 17], bottom: [13, 18, 44] },
  { alt: -12, top: [8, 11, 30], bottom: [23, 32, 74] },
  { alt: -6, top: [13, 20, 55], bottom: [47, 66, 130] },
  { alt: -4, top: [22, 32, 80], bottom: [122, 89, 111] },
  { alt: 0, top: [38, 53, 108], bottom: [214, 121, 78] },
  { alt: 6, top: [56, 92, 156], bottom: [244, 176, 109] },
  { alt: 15, top: [64, 121, 189], bottom: [154, 197, 233] },
  { alt: 40, top: [74, 143, 209], bottom: [178, 215, 243] },
];

function mix(a: [number, number, number], b: [number, number, number], f: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * f));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export function skyColors(sunAltitude: number): { top: string; bottom: string; dark: boolean } {
  const alt = Math.min(STOPS[STOPS.length - 1].alt, Math.max(STOPS[0].alt, sunAltitude));
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1].alt <= alt) i++;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const f = (alt - a.alt) / (b.alt - a.alt);
  return { top: mix(a.top, b.top, f), bottom: mix(a.bottom, b.bottom, f), dark: alt < 6 };
}

/** Write the gradient into CSS custom properties on :root. */
export function applySkyGradient(sunAltitude: number): void {
  const { top, bottom, dark } = skyColors(sunAltitude);
  const root = document.documentElement;
  root.style.setProperty("--sky-top", top);
  root.style.setProperty("--sky-bottom", bottom);
  root.dataset.sky = dark ? "dark" : "bright";
}
