// Inline SVG line icons (24×24 viewBox, stroked via currentColor in CSS).

const ICONS = {
  sunHorizon:
    '<path d="M12 5v2M5.6 7.6l1.4 1.4M18.4 7.6L17 9M8.5 14a3.5 3.5 0 1 1 7 0"/><path d="M3 14h18M6 18h12"/>',
  dome: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M2 17h20M12 9v-2"/>',
  map: '<path d="M9 4L4 6v14l5-2 6 2 5-2V4l-5 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  ar: '<circle cx="12" cy="12" r="9"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/><path d="M14.5 9.5l-1.7 3.3-3.3 1.7 1.7-3.3z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6 6l1.7 1.7M16.3 16.3L18 18M18 6l-1.7 1.7M7.7 16.3L6 18"/>',
  pin: '<path d="M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 12 4.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15.6 12 21 12 21z"/><circle cx="12" cy="10.8" r="2.3"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function svgIcon(name: IconName): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}
