/* Generative art: flavors, one-of-a-kind donut avatars, stickers.
 * Everything here returns SVG markup built only from numbers + constants (never user text),
 * so it is safe to inject and can also be rasterised into <canvas> for the game + card export. */
import { rngFor, range, pick, type Rng } from '../lib/rand';

export type FlavorId =
  | 'strawberry'
  | 'lagoon'
  | 'amethyst'
  | 'seafoam'
  | 'lemon'
  | 'peach'
  | 'cocoa'
  | 'cotton'
  | 'galaxy'
  | 'vanilla'
  | 'holo';

export interface Flavor {
  id: FlavorId;
  name: string;
  frost: string;
  deep: string;
  light: string;
  stops: [string, string, string];
  sprinkles?: string[];
}

const RAINBOW = ['#ff4fa3', '#ffd84a', '#5eb8ff', '#6cf2b5', '#b79cff', '#ff8a5c'];

export const FLAVORS: Flavor[] = [
  { id: 'strawberry', name: 'Strawberry Sunset', frost: '#ff8fc7', deep: '#e0559b', light: '#ffd0e8', stops: ['#ffc4e3', '#ff8fc7', '#f2629f'] },
  { id: 'lagoon', name: 'Blue Lagoon', frost: '#67d4ff', deep: '#2a8fe0', light: '#c9f1ff', stops: ['#bff0ff', '#67d4ff', '#3a9cf0'] },
  { id: 'amethyst', name: 'Amethyst Glaze', frost: '#b79cff', deep: '#7b55e6', light: '#e3d8ff', stops: ['#e6dcff', '#b79cff', '#8a63ee'] },
  { id: 'seafoam', name: 'Seafoam Mint', frost: '#74eec2', deep: '#22b583', light: '#d1fbe9', stops: ['#d4fdeb', '#74eec2', '#2cc08d'] },
  { id: 'lemon', name: 'Sunshine Lemon', frost: '#ffe070', deep: '#efad12', light: '#fff4c2', stops: ['#fff6c9', '#ffe070', '#f6bb2a'] },
  { id: 'peach', name: 'Peach Paradise', frost: '#ffad8a', deep: '#ef6f48', light: '#ffe0d1', stops: ['#ffe2d4', '#ffad8a', '#f47c58'] },
  { id: 'cocoa', name: 'Midnight Cocoa', frost: '#7b4a3b', deep: '#4c2a21', light: '#b78572', stops: ['#a8735f', '#7b4a3b', '#4f2c22'], sprinkles: ['#ffd0e8', '#fff4c2', '#c9f1ff', '#ffffff'] },
  { id: 'cotton', name: 'Cotton Candy Sky', frost: '#c8a8ff', deep: '#8f7ae8', light: '#f4e8ff', stops: ['#ffb3dc', '#cfb4ff', '#9ad9ff'] },
  { id: 'galaxy', name: 'Galaxy Glaze', frost: '#5a2aa0', deep: '#2b1468', light: '#a77bff', stops: ['#e04fb0', '#6a2bb5', '#22125e'], sprinkles: ['#ffffff', '#fff4c2', '#c9f1ff'] },
  { id: 'vanilla', name: 'Birthday Cake', frost: '#fff3f6', deep: '#f2c3d4', light: '#ffffff', stops: ['#ffffff', '#fff3f6', '#f6d4e1'], sprinkles: RAINBOW },
  { id: 'holo', name: 'Holo Crystal', frost: '#d9ecff', deep: '#9f9cf0', light: '#ffffff', stops: ['#ffd1f0', '#d3f6ff', '#e2d1ff'] },
];

export const flavorById = (id: string | null | undefined): Flavor =>
  FLAVORS.find((f) => f.id === id) ?? FLAVORS[0];

const DOUGHS = [
  ['#f9d9a6', '#e2a35f', '#b8733a'], // classic glazed
  ['#ffe3b3', '#efb46b', '#c98443'], // golden
  ['#a97352', '#7c4c33', '#55301f'], // chocolate
  ['#f2b9a0', '#d98466', '#a95a43'], // red velvet-ish
];

let svgCounter = 0;
const uid = (p: string) => `${p}${(svgCounter++).toString(36)}`;

type Pt = [number, number];
const f2 = (n: number) => Math.round(n * 100) / 100;

/** Catmull-Rom → cubic Bézier for a smooth closed blob. */
export function smoothClosed(pts: Pt[]): string {
  const n = pts.length;
  let d = `M${f2(pts[0][0])},${f2(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f2(c1[0])},${f2(c1[1])} ${f2(c2[0])},${f2(c2[1])} ${f2(p2[0])},${f2(p2[1])}`;
  }
  return d + 'Z';
}

const circlePath = (r: number, cx = 0, cy = 0) =>
  `M${cx - r},${cy}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0Z`;

function frostingRing(rng: Rng) {
  const drips = Array.from({ length: 3 + Math.floor(rng() * 4) }, () => ({
    at: rng() * Math.PI * 2,
    w: range(rng, 0.12, 0.28),
    len: range(rng, 2.5, 5.5),
  }));
  const p = [rng() * 6, rng() * 6, rng() * 6, rng() * 6];
  const outer: Pt[] = [];
  const inner: Pt[] = [];
  const N = 44;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    let r = 37.5 + 1.3 * Math.sin(a * 5 + p[0]) + 0.9 * Math.sin(a * 9 + p[1]);
    for (const d of drips) {
      let diff = Math.abs(a - d.at);
      diff = Math.min(diff, Math.PI * 2 - diff);
      r += d.len * Math.exp(-Math.pow(diff / d.w, 2));
    }
    outer.push([Math.cos(a) * r, Math.sin(a) * r]);
    const ri = 19.5 + 1.0 * Math.sin(a * 4 + p[2]) + 0.6 * Math.sin(a * 7 + p[3]);
    inner.push([Math.cos(a) * ri, Math.sin(a) * ri]);
  }
  return { outer, inner, d: smoothClosed(outer) + smoothClosed(inner.slice().reverse()) };
}

function sprinkleShapes(rng: Rng, colors: string[], count: number) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = range(rng, 24, 33);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    out += `<rect x="${f2(x - 3.3)}" y="${f2(y - 1.1)}" width="6.6" height="2.2" rx="1.1" fill="${pick(rng, colors)}" transform="rotate(${Math.floor(rng() * 180)} ${f2(x)} ${f2(y)})"/>`;
  }
  return out;
}

function tinyStar(x: number, y: number, s: number, fill: string) {
  return `<path d="M${f2(x)},${f2(y - s)}Q${f2(x + s * 0.18)},${f2(y - s * 0.18)} ${f2(x + s)},${f2(y)}Q${f2(x + s * 0.18)},${f2(y + s * 0.18)} ${f2(x)},${f2(y + s)}Q${f2(x - s * 0.18)},${f2(y + s * 0.18)} ${f2(x - s)},${f2(y)}Q${f2(x - s * 0.18)},${f2(y - s * 0.18)} ${f2(x)},${f2(y - s)}Z" fill="${fill}"/>`;
}

function tinyHeart(x: number, y: number, s: number, fill: string) {
  return `<path transform="translate(${f2(x)} ${f2(y)}) scale(${f2(s / 10)})" d="M0,6C-6,2 -9,-2 -6,-5C-4,-7 -1,-6 0,-3C1,-6 4,-7 6,-5C9,-2 6,2 0,6Z" fill="${fill}"/>`;
}

export interface DonutOptions {
  flavor?: FlavorId | null;
  size?: number;
  className?: string;
}

/** A one-of-a-kind donut for any name. Same name → same donut, forever. */
export function donutSVG(seed: string, opts: DonutOptions = {}): string {
  const rng = rngFor(seed.toLowerCase().trim() || 'donut');
  const flavor = opts.flavor ? flavorById(opts.flavor) : pick(rng, FLAVORS);
  const dough = flavor.id === 'cocoa' ? DOUGHS[1] : pick(rng, DOUGHS);
  const id = uid('dn');
  const ring = frostingRing(rng);
  const size = opts.size ?? 64;
  const sprinkleColors = (flavor.sprinkles ?? RAINBOW).filter((c) => c.toLowerCase() !== flavor.frost.toLowerCase());

  const toppingRoll = rng();
  let toppings = '';
  if (flavor.id === 'galaxy') {
    for (let i = 0; i < 12; i++) {
      const a = rng() * Math.PI * 2;
      const r = range(rng, 23, 34);
      toppings += tinyStar(Math.cos(a) * r, Math.sin(a) * r, range(rng, 1.2, 2.6), pick(rng, sprinkleColors));
    }
  } else if (toppingRoll < 0.58 || flavor.id === 'vanilla') {
    toppings = sprinkleShapes(rng, sprinkleColors, 15 + Math.floor(rng() * 10));
  } else if (toppingRoll < 0.72) {
    for (let i = 0; i < 28; i++) {
      const a = rng() * Math.PI * 2;
      const r = range(rng, 23, 34);
      toppings += `<circle cx="${f2(Math.cos(a) * r)}" cy="${f2(Math.sin(a) * r)}" r="${f2(range(rng, 0.9, 1.6))}" fill="${pick(rng, sprinkleColors)}"/>`;
    }
  } else if (toppingRoll < 0.86) {
    const color = flavor.id === 'cocoa' ? '#ffe9f3' : pick(rng, ['#ffffff', '#7b4a3b', '#ff4fa3', '#6a2bb5']);
    let d = '';
    const zigs = 22;
    const off = rng() * Math.PI;
    for (let i = 0; i <= zigs; i++) {
      const a = off + (i / zigs) * Math.PI * 2;
      const r = i % 2 ? 33 : 23;
      d += `${i ? 'L' : 'M'}${f2(Math.cos(a) * r)},${f2(Math.sin(a) * r)}`;
    }
    toppings = `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".92"/>`;
  } else {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng();
      const r = range(rng, 25, 32);
      toppings += tinyHeart(Math.cos(a) * r, Math.sin(a) * r, range(rng, 3.2, 4.6), pick(rng, ['#ff4fa3', '#ffffff', '#ff7a85']));
    }
  }

  const [s0, s1, s2] = flavor.stops;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100" width="${size}" height="${size}" class="${opts.className ?? 'donut'}" aria-hidden="true">
<defs>
<radialGradient id="${id}d" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${dough[0]}"/><stop offset=".65" stop-color="${dough[1]}"/><stop offset="1" stop-color="${dough[2]}"/></radialGradient>
<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s0}"/><stop offset=".5" stop-color="${s1}"/><stop offset="1" stop-color="${s2}"/></linearGradient>
<radialGradient id="${id}s" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#1a0b2e" stop-opacity=".35"/><stop offset="1" stop-color="#1a0b2e" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="0" cy="44" rx="40" ry="6" fill="url(#${id}s)"/>
<path d="${circlePath(45)}${circlePath(12.5, 0, 0)}" fill="url(#${id}d)" fill-rule="evenodd"/>
<circle r="43.6" fill="none" stroke="${dough[2]}" stroke-opacity=".45" stroke-width="2.6"/>
<circle r="13.6" fill="none" stroke="${dough[2]}" stroke-opacity=".6" stroke-width="2.2"/>
<path d="${ring.d}" fill="url(#${id}f)" fill-rule="evenodd"/>
<path d="${ring.d}" fill="none" stroke="${flavor.deep}" stroke-opacity=".35" stroke-width="1.2" fill-rule="evenodd"/>
${toppings}
<path d="M-30,-12A32,32 0 0,1 -12,-30" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3.6" stroke-linecap="round"/>
<circle cx="-7" cy="-33" r="1.8" fill="#fff" fill-opacity=".75"/>
</svg>`;
}

/* ─────────────────────────────── Stickers ─────────────────────────────── */

export type StickerId =
  | 'donut'
  | 'crystal'
  | 'heart'
  | 'star'
  | 'shell'
  | 'palm'
  | 'wave'
  | 'sun'
  | 'controller'
  | 'trophy'
  | 'gg'
  | 'crown';

export const STICKERS: { id: StickerId; label: string }[] = [
  { id: 'donut', label: 'Donut' },
  { id: 'heart', label: 'Heart' },
  { id: 'crystal', label: 'Crystal' },
  { id: 'controller', label: 'Controller' },
  { id: 'sun', label: 'Sunny' },
  { id: 'wave', label: 'Wave' },
  { id: 'palm', label: 'Palm tree' },
  { id: 'shell', label: 'Seashell' },
  { id: 'star', label: 'Star' },
  { id: 'trophy', label: 'Trophy' },
  { id: 'gg', label: 'GG' },
  { id: 'crown', label: 'Crown' },
];

function stickerBody(id: StickerId, g: string): string {
  switch (id) {
    case 'donut':
      return `<path d="${circlePath(23, 32, 33)}${circlePath(7, 32, 33)}" fill="#f2b56d" fill-rule="evenodd"/>
<path d="M14,30C14,18 24,12 33,12C44,12 51,20 51,30C51,36 49,40 47,41C46,37 43,38 43,42C40,45 36,44 34,46C33,42 28,43 26,45C22,44 22,40 19,41C17,42 14,38 14,30Z M32,26a7,7 0 1,0 0.01,0Z" fill="#ff8fc7" fill-rule="evenodd"/>
<rect x="20" y="22" width="6" height="2" rx="1" fill="#ffd84a" transform="rotate(-30 23 23)"/>
<rect x="38" y="18" width="6" height="2" rx="1" fill="#5eb8ff" transform="rotate(20 41 19)"/>
<rect x="42" y="30" width="6" height="2" rx="1" fill="#6cf2b5" transform="rotate(70 45 31)"/>
<rect x="22" y="34" width="6" height="2" rx="1" fill="#b79cff" transform="rotate(10 25 35)"/>
<rect x="30" y="15" width="6" height="2" rx="1" fill="#fff" transform="rotate(-60 33 16)"/>
<path d="M19,24A15,15 0 0,1 27,16" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    case 'crystal':
      return `<path d="M32,5L18,22L27,27Z" fill="#efe6ff"/><path d="M32,5L27,27L37,27Z" fill="#d2c0ff"/><path d="M32,5L37,27L46,22Z" fill="#a98bf5"/>
<path d="M18,22L27,27L27,60L19,57Z" fill="#cdb8ff"/><path d="M27,27L37,27L37,60L27,60Z" fill="#a98bf5"/><path d="M37,27L46,22L45,57L37,60Z" fill="#7d5ae0"/>
<path d="M22,30L24,52" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>`;
    case 'heart':
      return `<path d="M32,55C11,41 6,27 13,18C20,10 29,13 32,20C35,13 44,10 51,18C58,27 53,41 32,55Z" fill="url(#${g}a)"/>
<ellipse cx="21" cy="23" rx="4.5" ry="3" fill="#fff" fill-opacity=".7" transform="rotate(-35 21 23)"/>`;
    case 'star':
      return `<path d="M32,7L38.5,22.5L55,24L42.5,35L46.5,51.5L32,43L17.5,51.5L21.5,35L9,24L25.5,22.5Z" fill="#ffd84a" stroke="#f3a51c" stroke-width="2" stroke-linejoin="round"/>
<circle cx="27" cy="30" r="2" fill="#3a2350"/><circle cx="37" cy="30" r="2" fill="#3a2350"/>
<path d="M28,35Q32,39 36,35" stroke="#3a2350" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="24" cy="34" r="2" fill="#ff8fc7" fill-opacity=".8"/><circle cx="40" cy="34" r="2" fill="#ff8fc7" fill-opacity=".8"/>`;
    case 'shell':
      return `<path d="M32,54L11,31C11,17 20,9 32,9C44,9 53,17 53,31Z" fill="url(#${g}a)"/>
<g stroke="#e8707e" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".75"><path d="M32,52L32,11"/><path d="M32,52L22,13"/><path d="M32,52L42,13"/><path d="M32,52L14,20"/><path d="M32,52L50,20"/></g>
<path d="M25,52L32,58L39,52L32,50Z" fill="#ffb3a1"/>`;
    case 'palm':
      return `<ellipse cx="32" cy="57" rx="20" ry="4.5" fill="#ffd9a0"/>
<path d="M30,57C31,45 33,34 36,23L39,24C36,35 35,46 35,57Z" fill="#b97a48"/>
<g stroke="#98603a" stroke-width="1.3" opacity=".6"><path d="M31,50L35,50"/><path d="M32,43L36,43"/><path d="M33,36L37,36"/><path d="M34,29L38,29"/></g>
<path d="M37,23C30,14 19,15 12,22C21,19 29,20 37,23Z" fill="#2fbf7f"/>
<path d="M37,23C34,12 26,8 18,9C26,12 32,16 37,23Z" fill="#46d993"/>
<path d="M37,23C40,12 48,8 56,10C48,13 42,17 37,23Z" fill="#2fbf7f"/>
<path d="M37,23C45,16 55,18 59,26C51,22 44,22 37,23Z" fill="#46d993"/>
<path d="M37,23C39,30 36,36 31,39C34,33 35,28 37,23Z" fill="#26a56c"/>
<circle cx="35" cy="25" r="2.6" fill="#7a4b2c"/><circle cx="39.5" cy="25.5" r="2.4" fill="#8a5734"/>`;
    case 'wave':
      return `<path d="M6,48C8,30 21,16 38,16C50,16 58,24 57,33C56,40 48,42 44,36C41,30 34,32 34,39C34,46 42,50 58,50L58,58L6,58Z" fill="url(#${g}a)"/>
<path d="M38,16C50,16 58,24 57,33C56,40 48,42 44,36" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
<circle cx="14" cy="40" r="1.6" fill="#fff" fill-opacity=".8"/><circle cx="20" cy="33" r="1.2" fill="#fff" fill-opacity=".7"/>`;
    case 'sun':
      return `<g fill="#ffb02e">${Array.from({ length: 12 }, (_, i) => `<path d="M32,4L35,13L29,13Z" transform="rotate(${i * 30} 32 32)"/>`).join('')}</g>
<circle cx="32" cy="32" r="16" fill="#ffd84a"/>
<path d="M20,28h10a2,2 0 0,1 2,2v1a5,5 0 0,1 -5,5h-2a5,5 0 0,1 -5,-5Z M34,28h10v3a5,5 0 0,1 -5,5h-2a5,5 0 0,1 -5,-5v-1a2,2 0 0,1 2,-2Z" fill="#2a1740"/>
<path d="M30,30L34,30" stroke="#2a1740" stroke-width="2"/>
<path d="M22,30L26,30" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-linecap="round"/>
<path d="M27,41Q32,45 37,41" stroke="#2a1740" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case 'controller':
      return `<path d="M15,23C8,23 4,33 5,43C6,51 12,54 17,49L23,43L41,43L47,49C52,54 58,51 59,43C60,33 56,23 49,23Z" fill="url(#${g}a)"/>
<path d="M14,33h4v-4h4v4h4v4h-4v4h-4v-4h-4Z" fill="#fff"/>
<circle cx="45" cy="30" r="2.6" fill="#ffd84a"/><circle cx="50" cy="35" r="2.6" fill="#ff4fa3"/><circle cx="40" cy="35" r="2.6" fill="#5eb8ff"/><circle cx="45" cy="40" r="2.6" fill="#6cf2b5"/>
<path d="M12,27Q16,24 22,25" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'trophy':
      return `<path d="M20,10H44V22C44,31 39,37 32,37C25,37 20,31 20,22Z" fill="url(#${g}a)"/>
<path d="M20,14H12C12,23 16,28 22,29M44,14H52C52,23 48,28 42,29" fill="none" stroke="#f3a51c" stroke-width="3.2" stroke-linecap="round"/>
<path d="M29,37H35V45H29Z" fill="#f3a51c"/><path d="M21,45H43V52H21Z" fill="#ffd84a"/><path d="M18,52H46V57H18Z" fill="#f3a51c"/>
<path d="M32,15L34,20L39,20.4L35.2,23.6L36.4,28.6L32,26L27.6,28.6L28.8,23.6L25,20.4L30,20Z" fill="#fff" fill-opacity=".9"/>`;
    case 'gg':
      return `<g transform="rotate(-8 32 32)"><rect x="4" y="16" width="56" height="32" rx="12" fill="url(#${g}a)"/>
<path d="M27,25.5A8,8 0 1,0 27,38.5L27,33L22,33" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M49,25.5A8,8 0 1,0 49,38.5L49,33L44,33" fill="none" stroke="#fff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    case 'crown':
      return `<path d="M8,22L20,34L32,14L44,34L56,22L51,50H13Z" fill="url(#${g}a)" stroke="#f3a51c" stroke-width="2" stroke-linejoin="round"/>
<rect x="13" y="46" width="38" height="7" rx="2" fill="#f3a51c"/>
<circle cx="32" cy="38" r="4" fill="#ff4fa3"/><circle cx="21" cy="41" r="2.8" fill="#5eb8ff"/><circle cx="43" cy="41" r="2.8" fill="#6cf2b5"/>
<circle cx="8" cy="21" r="3" fill="#ffd84a"/><circle cx="32" cy="13" r="3" fill="#ffd84a"/><circle cx="56" cy="21" r="3" fill="#ffd84a"/>`;
  }
}

const STICKER_GRADIENTS: Partial<Record<StickerId, [string, string]>> = {
  heart: ['#ff8fc7', '#ff3d8f'],
  shell: ['#ffd2bd', '#ff8f8f'],
  wave: ['#7df9ff', '#2a8fe0'],
  controller: ['#d2c0ff', '#8a63ee'],
  trophy: ['#fff1a6', '#f6bb2a'],
  gg: ['#7df9ff', '#b79cff'],
  crown: ['#fff1a6', '#f6bb2a'],
};

/** Die-cut sticker: the white outline + soft shadow come from an SVG filter, so any shape works. */
export function stickerSVG(id: StickerId | string | null | undefined, size = 48): string {
  const sid = (STICKERS.find((s) => s.id === id)?.id ?? 'donut') as StickerId;
  const g = uid('st');
  const grad = STICKER_GRADIENTS[sid] ?? ['#fff', '#ddd'];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="sticker" aria-hidden="true">
<defs>
<linearGradient id="${g}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${grad[0]}"/><stop offset="1" stop-color="${grad[1]}"/></linearGradient>
<filter id="${g}o" x="-25%" y="-25%" width="150%" height="150%">
<feMorphology in="SourceAlpha" operator="dilate" radius="2.8" result="d"/>
<feGaussianBlur in="d" stdDeviation="1.4" result="b"/><feOffset in="b" dy="1.6" result="bo"/>
<feFlood flood-color="#2a1740" flood-opacity=".32"/><feComposite in2="bo" operator="in" result="sh"/>
<feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="ol"/>
<feMerge><feMergeNode in="sh"/><feMergeNode in="ol"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
<g filter="url(#${g}o)">${stickerBody(sid, g)}</g>
</svg>`;
}

/* ─────────────────────── Frosting drip for card headers ─────────────────────── */

/** A drippy frosting edge (viewBox 0 0 400 120) unique to each seed. */
export function dripPath(seed: string, width = 400, base = 56): string {
  const rng = rngFor('drip:' + seed);
  const pts: string[] = [`M0,0`, `L${width},0`, `L${width},${base}`];
  let x = width;
  while (x > 0) {
    const w = range(rng, 26, 58);
    const isDrip = rng() < 0.42;
    const nx = Math.max(0, x - w);
    if (isDrip) {
      const depth = range(rng, 18, 54);
      const mid = (x + nx) / 2;
      const r = Math.min(w * 0.32, 11);
      pts.push(
        `C${f2(x - w * 0.18)},${base} ${f2(mid + r * 1.4)},${base + 2} ${f2(mid + r)},${f2(base + depth - r)}`,
        `A${f2(r)},${f2(r)} 0 0,1 ${f2(mid - r)},${f2(base + depth - r)}`,
        `C${f2(mid - r * 1.4)},${base + 2} ${f2(nx + w * 0.18)},${base} ${f2(nx)},${base}`,
      );
    } else {
      const wob = range(rng, -5, 7);
      pts.push(`Q${f2((x + nx) / 2)},${f2(base + wob)} ${f2(nx)},${base}`);
    }
    x = nx;
  }
  pts.push('Z');
  return pts.join('');
}

/** Little sprinkles scattered over a card's frosting band. */
export function frostingSprinkles(seed: string, colors: string[], width = 400, height = 52, count = 18) {
  const rng = rngFor('spr:' + seed);
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = range(rng, 8, width - 8);
    const y = range(rng, 8, height - 6);
    out += `<rect x="${f2(x - 5)}" y="${f2(y - 1.6)}" width="10" height="3.2" rx="1.6" fill="${pick(rng, colors)}" transform="rotate(${Math.floor(rng() * 180)} ${f2(x)} ${f2(y)})"/>`;
  }
  return out;
}

export const SPRINKLE_COLORS = RAINBOW;
