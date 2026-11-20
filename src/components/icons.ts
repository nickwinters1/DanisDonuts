/* Small stroke icon set (24×24, currentColor). */
const P: Record<string, string> = {
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  up: '<path d="M5 15l7-7 7 7"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.6 3.6 4.5 6.9 4.5c2 0 3.4 1.1 4.1 2.4l1 .1c.7-1.3 2.1-2.5 4.1-2.5 3.3 0 5.2 3.1 4.1 6.2C19.5 15.4 12 20 12 20z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  flip: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  soundOn: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  soundOff: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
  shuffle: '<path d="M3 7h3.5c2.5 0 4 1.5 5.5 5s3 5 5.5 5H21"/><path d="M18 14l3 3-3 3"/><path d="M3 17h3.5c1.4 0 2.5-.5 3.4-1.4M14.1 8.4C15 7.5 16.1 7 17.5 7H21"/><path d="M18 4l3 3-3 3"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4.5 4"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M8 21h8M12 17v4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3 3.8M6.4 6.4C3.8 8.2 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.9-.4 4.1-1"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  gamepad: '<path d="M7 8h10a5 5 0 0 1 4.8 6.3l-.7 2.6a2.5 2.5 0 0 1-4.3 1L15 16H9l-1.8 1.9a2.5 2.5 0 0 1-4.3-1l-.7-2.6A5 5 0 0 1 7 8z"/><path d="M7.5 11v3M6 12.5h3"/><circle cx="16" cy="11.5" r=".6"/><circle cx="17.5" cy="13.5" r=".6"/>',
};

export function icon(name: keyof typeof P | string, size = 20, extraClass = ''): string {
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
}
