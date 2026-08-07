// Inline SVG line icons (24×24 viewBox, stroked via currentColor in CSS).

const ICONS = {
  sunHorizon:
    '<path d="M12 5v2M5.6 7.6l1.4 1.4M18.4 7.6L17 9M8.5 14a3.5 3.5 0 1 1 7 0"/><path d="M3 14h18M6 18h12"/>',
  dome: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M2 17h20M12 9v-2"/>',
  map: '<path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  ar: '<circle cx="12" cy="12" r="9"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/><path d="M14.5 9.5l-1.7 3.3-3.3 1.7 1.7-3.3z"/>',
  // A cog outline (6 square teeth between r=5.4 and r=7.6). The previous
  // circle-plus-eight-spokes drawing read as a sun, so people expected a
  // light/dark toggle rather than settings.
  gear:
    '<path d="M17.22 10.60L19.34 10.03A7.6 7.6 0 0 1 19.34 13.97L17.22 13.40A5.4 5.4 0 0 1 15.82 15.82L17.37 17.37A7.6 7.6 0 0 1 13.97 19.34L13.40 17.22A5.4 5.4 0 0 1 10.60 17.22L10.03 19.34A7.6 7.6 0 0 1 6.63 17.37L8.18 15.82A5.4 5.4 0 0 1 6.78 13.40L4.66 13.97A7.6 7.6 0 0 1 4.66 10.03L6.78 10.60A5.4 5.4 0 0 1 8.18 8.18L6.63 6.63A7.6 7.6 0 0 1 10.03 4.66L10.60 6.78A5.4 5.4 0 0 1 13.40 6.78L13.97 4.66A7.6 7.6 0 0 1 17.37 6.63L15.82 8.18A5.4 5.4 0 0 1 17.22 10.60Z"/><circle cx="12" cy="12" r="2.5"/>',
  pin: '<path d="M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 12 4.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.8" r="2.3"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function svgIcon(name: IconName): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}
