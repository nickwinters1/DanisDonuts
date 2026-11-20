/* The seven hidden crystals (+ the legendary Donut Heart). Faceted SVG gems, each with a meaning. */

export type CrystalId = 'citrine' | 'clear' | 'rose' | 'amethyst' | 'opal' | 'aquamarine' | 'moonstone' | 'heart';

export interface Crystal {
  id: CrystalId;
  name: string;
  color: [string, string, string, string]; // light, mid, dark, glow
  meaning: string;
  line: string;
  hint: string;
  where: string;
}

export const CRYSTALS: Crystal[] = [
  {
    id: 'citrine',
    name: 'Citrine',
    color: ['#fff3b8', '#ffcf4a', '#e8930f', '#ffd84a'],
    meaning: 'Sunshine, joy & warmth',
    line: 'Sunshine you can hold. Basically Florida in crystal form — basically Dani.',
    hint: 'Where the sun meets the sea. The very first view hides a little light.',
    where: 'Lobby',
  },
  {
    id: 'clear',
    name: 'Clear Quartz',
    color: ['#ffffff', '#e4f3ff', '#a9c4e8', '#d9f2ff'],
    meaning: 'The master amplifier',
    line: 'It turns up whatever energy you bring. She brings the best kind.',
    hint: 'Every player has a profile. Look closely at the loadout.',
    where: 'Player One',
  },
  {
    id: 'rose',
    name: 'Rose Quartz',
    color: ['#ffe1ee', '#ff9ccb', '#e15c98', '#ff8fc7'],
    meaning: 'Unconditional love',
    line: 'The stone of love. Fitting, for a wall with this much of it.',
    hint: 'Love lives on the wall. Read the room.',
    where: 'The Donut Wall',
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    color: ['#eadcff', '#b48cff', '#6f3fd6', '#b79cff'],
    meaning: 'Calm, protection & sweet dreams',
    line: 'For every late-night stream that turned a bad day around.',
    hint: 'Somewhere along the Season Pass track.',
    where: 'Season Pass',
  },
  {
    id: 'opal',
    name: 'Opal',
    color: ['#fff6fd', '#d8e8ff', '#b3a4f5', '#ffc2ec'],
    meaning: 'Creativity & every color at once',
    line: 'Every color at once — like a stream where literally anything can happen.',
    hint: 'Earned, not found. Score 500+ in Donut Drop.',
    where: 'Arcade',
  },
  {
    id: 'aquamarine',
    name: 'Aquamarine',
    color: ['#e3fffb', '#7ff0e6', '#1fb3c2', '#7df9ff'],
    meaning: 'The ocean’s stone — courage & clear water',
    line: 'Salt air, clear water, beach-girl energy.',
    hint: 'Where the links live, down by the water.',
    where: 'Live',
  },
  {
    id: 'moonstone',
    name: 'Moonstone',
    color: ['#f4f6ff', '#c9d4ff', '#7f8fd8', '#a9c7ff'],
    meaning: 'New beginnings & things that glow at night',
    line: 'Glows in the dark, just like chat at 2 a.m.',
    hint: 'Only comes out at night. Look up.',
    where: 'For Dani',
  },
];

export const HEART_CRYSTAL: Crystal = {
  id: 'heart',
  name: 'The Donut Heart',
  color: ['#ffffff', '#ffc2ec', '#8f7ae8', '#ffd1f0'],
  meaning: 'Made of every message on this page',
  line: 'Legendary. Only found by those who found everything else.',
  hint: 'Find all seven crystals.',
  where: '???',
};

export const crystalById = (id: string) => (id === 'heart' ? HEART_CRYSTAL : CRYSTALS.find((c) => c.id === id));

/* ───────── facet geometry ───────── */

type Pt = [number, number];
interface Facet {
  pts: Pt[];
  shade: number; // -1 dark … +1 light
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const A = hex(a);
  const B = hex(b);
  const r = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${r[0]},${r[1]},${r[2]})`;
}

function shadeColor(c: Crystal['color'], shade: number) {
  return shade >= 0 ? mix(c[1], c[0], shade) : mix(c[1], c[2], -shade);
}

function point(cx: number, tip: number, shoulder: number, bottom: number, hw: number, rot = 0, scale = 1): Facet[] {
  const T: Pt = [cx, tip];
  const L: Pt = [cx - hw, shoulder];
  const CL: Pt = [cx - hw * 0.42, shoulder + hw * 0.28];
  const CR: Pt = [cx + hw * 0.42, shoulder + hw * 0.28];
  const R: Pt = [cx + hw, shoulder];
  const BL: Pt = [cx - hw * 0.94, bottom - 2];
  const BCL: Pt = [cx - hw * 0.42, bottom + 1];
  const BCR: Pt = [cx + hw * 0.42, bottom + 1];
  const BR: Pt = [cx + hw * 0.94, bottom - 2];
  const facets: Facet[] = [
    { pts: [T, L, CL], shade: 0.85 },
    { pts: [T, CL, CR], shade: 0.45 },
    { pts: [T, CR, R], shade: -0.15 },
    { pts: [L, CL, BCL, BL], shade: 0.35 },
    { pts: [CL, CR, BCR, BCL], shade: -0.05 },
    { pts: [CR, R, BR, BCR], shade: -0.6 },
  ];
  if (!rot && scale === 1) return facets;
  const rad = (rot * Math.PI) / 180;
  const ox = cx;
  const oy = bottom;
  return facets.map((f) => ({
    shade: f.shade,
    pts: f.pts.map(([x, y]) => {
      const dx = (x - ox) * scale;
      const dy = (y - oy) * scale;
      return [ox + dx * Math.cos(rad) - dy * Math.sin(rad), oy + dx * Math.sin(rad) + dy * Math.cos(rad)] as Pt;
    }),
  }));
}

function ring(cx: number, cy: number, rOut: number, rIn: number, n: number, rot = 0): Pt[][] {
  const out: Pt[] = [];
  const inn: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut]);
    inn.push([cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn]);
  }
  return [out, inn];
}

const lightShade = (x: number, y: number) => {
  // light from the upper-left
  const v = (-x - y) / Math.hypot(x, y || 1);
  return Math.max(-1, Math.min(1, v * 0.85));
};

function facetsFor(id: CrystalId): Facet[] {
  switch (id) {
    case 'citrine':
      return point(50, 10, 34, 90, 22);
    case 'clear':
      return point(50, 4, 26, 94, 15);
    case 'amethyst':
      return [
        ...point(50, 30, 46, 88, 13, -28, 0.9),
        ...point(50, 30, 46, 88, 13, 26, 0.85),
        ...point(50, 8, 28, 86, 15),
        {
          pts: [
            [20, 84],
            [34, 78],
            [50, 82],
            [68, 77],
            [82, 85],
            [74, 94],
            [28, 95],
          ],
          shade: -0.8,
        },
      ];
    case 'rose': {
      const heart: Pt[] = [];
      const N = 20;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        heart.push([50 + x * 2.6, 50 - y * 2.6]);
      }
      const c: Pt = [50, 46];
      return heart.map((p, i) => {
        const q = heart[(i + 1) % N];
        const mx = (p[0] + q[0]) / 2 - c[0];
        const my = (p[1] + q[1]) / 2 - c[1];
        return { pts: [c, p, q], shade: lightShade(mx, my) };
      });
    }
    case 'aquamarine': {
      const o: Pt[] = [
        [30, 12],
        [70, 12],
        [82, 24],
        [82, 76],
        [70, 88],
        [30, 88],
        [18, 76],
        [18, 24],
      ];
      const i: Pt[] = [
        [37, 26],
        [63, 26],
        [68, 31],
        [68, 69],
        [63, 74],
        [37, 74],
        [32, 69],
        [32, 31],
      ];
      const facets: Facet[] = o.map((p, k) => {
        const q = o[(k + 1) % 8];
        const mx = (p[0] + q[0]) / 2 - 50;
        const my = (p[1] + q[1]) / 2 - 50;
        return { pts: [p, q, i[(k + 1) % 8], i[k]], shade: lightShade(mx, my) };
      });
      facets.push({ pts: i, shade: 0.25 });
      return facets;
    }
    case 'opal': {
      const [o, i] = ring(50, 50, 40, 22, 16, -Math.PI / 2);
      const facets: Facet[] = [];
      for (let k = 0; k < 16; k++) {
        const p = o[k];
        const q = o[(k + 1) % 16];
        const a = i[k];
        const b = i[(k + 1) % 16];
        facets.push({ pts: [p, q, b, a], shade: lightShade((p[0] + q[0]) / 2 - 50, (p[1] + q[1]) / 2 - 50) * 0.7 });
      }
      facets.push({ pts: i, shade: 0.4 });
      return facets;
    }
    case 'moonstone':
      return [];
    case 'heart': {
      const [o, i] = ring(50, 50, 42, 16, 12, -Math.PI / 2);
      const [m] = ring(50, 50, 29, 0, 12, -Math.PI / 2 + Math.PI / 12);
      const facets: Facet[] = [];
      for (let k = 0; k < 12; k++) {
        const p = o[k];
        const q = o[(k + 1) % 12];
        const a = i[k];
        const b = i[(k + 1) % 12];
        const mm = m[k];
        facets.push({ pts: [p, q, mm], shade: lightShade(mm[0] - 50, mm[1] - 50) });
        facets.push({ pts: [a, b, mm], shade: lightShade(mm[0] - 50, mm[1] - 50) * 0.4 + 0.2 });
        facets.push({ pts: [q, b, mm], shade: lightShade(q[0] - 50, q[1] - 50) * 0.6 });
      }
      return facets;
    }
  }
}

let n = 0;

/**
 * @param found  false → a mysterious silhouette for the collection log.
 */
export function crystalSVG(id: CrystalId, size = 64, found = true): string {
  const c = crystalById(id) ?? CRYSTALS[0];
  const g = `cr${(n++).toString(36)}`;
  const stroke = found ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.16)';
  const fill = (shade: number) => (found ? shadeColor(c.color, shade) : shade > 0.3 ? '#2c1b50' : '#1f1240');
  let body = '';

  if (id === 'moonstone') {
    body = found
      ? `<ellipse cx="50" cy="52" rx="34" ry="40" fill="url(#${g}m)"/>
<ellipse cx="50" cy="52" rx="34" ry="40" fill="url(#${g}s)" class="moon-sheen"/>
<ellipse cx="38" cy="30" rx="10" ry="6" fill="#fff" fill-opacity=".7" transform="rotate(-30 38 30)"/>`
      : `<ellipse cx="50" cy="52" rx="34" ry="40" fill="#22143f" stroke="${stroke}" stroke-width="1"/>`;
  } else {
    for (const f of facetsFor(id)) {
      body += `<polygon points="${f.pts.map((p) => p.map((v) => Math.round(v * 10) / 10).join(',')).join(' ')}" fill="${fill(f.shade)}" stroke="${stroke}" stroke-width=".7" stroke-linejoin="round"/>`;
    }
    if (found && (id === 'opal' || id === 'heart')) {
      body += `<g style="mix-blend-mode:screen" opacity=".55"><circle cx="50" cy="50" r="42" fill="url(#${g}o)"/></g>`;
    }
  }

  const sparkle = found
    ? `<path class="crystal-sparkle" d="M80,14Q81.5,20.5 88,22Q81.5,23.5 80,30Q78.5,23.5 72,22Q78.5,20.5 80,14Z" fill="#fff"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" class="crystal crystal--${id}${found ? '' : ' crystal--unknown'}" aria-hidden="true">
<defs>
<radialGradient id="${g}g" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="${c.color[3]}" stop-opacity="${found ? 0.55 : 0}"/><stop offset="1" stop-color="${c.color[3]}" stop-opacity="0"/></radialGradient>
<radialGradient id="${g}m" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="${c.color[1]}"/><stop offset="1" stop-color="${c.color[2]}"/></radialGradient>
<linearGradient id="${g}s" x1="0" y1="0" x2="1" y2="1"><stop offset=".2" stop-color="#7df9ff" stop-opacity="0"/><stop offset=".5" stop-color="#7df9ff" stop-opacity=".55"/><stop offset=".8" stop-color="#b79cff" stop-opacity="0"/></linearGradient>
<linearGradient id="${g}o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ac8"/><stop offset=".3" stop-color="#ffe45e"/><stop offset=".55" stop-color="#6cf2b5"/><stop offset=".8" stop-color="#5eb8ff"/><stop offset="1" stop-color="#b79cff"/></linearGradient>
</defs>
<circle cx="50" cy="52" r="48" fill="url(#${g}g)"/>
${body}
${sparkle}
</svg>`;
}
