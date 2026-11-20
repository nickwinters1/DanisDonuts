/* The day passes as you scroll: sunset → dusk → twilight → night → midnight under the stars. */
import { h } from '../lib/dom';

const PALETTES: Record<string, [string, string, string]> = {
  lobby: ['#1b0f3d', '#5b2280', '#ff7a85'],
  player: ['#170b35', '#45186d', '#d0488f'],
  wall: ['#120a2a', '#2c1252', '#8a2f8f'],
  pass: ['#0f0826', '#27104c', '#5d2aa0'],
  collection: ['#0c0720', '#1e1048', '#3d2d90'],
  arcade: ['#0b0620', '#1f0b40', '#9a1f7c'],
  live: ['#06101f', '#0e2748', '#1c6488'],
  'for-dani': ['#03040f', '#090a24', '#191346'],
};

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};

export function mountSkyBackground() {
  const el = h('div', { class: 'sky-bg', 'aria-hidden': 'true' }, h('div', { class: 'sky-bg__orb sky-bg__orb--a' }), h('div', { class: 'sky-bg__orb sky-bg__orb--b' }), h('div', { class: 'sky-bg__orb sky-bg__orb--c' }), h('div', { class: 'sky-bg__grain' }));
  document.body.prepend(el);
  const ids = Object.keys(PALETTES);
  let raf = 0;
  const update = () => {
    raf = 0;
    const mid = scrollY + innerHeight * 0.5;
    const secs = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!secs.length) return;
    let i = 0;
    for (let k = 0; k < secs.length; k++) if (secs[k].offsetTop <= mid) i = k;
    const cur = secs[i];
    const next = secs[i + 1];
    let t = 0;
    if (next) {
      const start = cur.offsetTop + cur.offsetHeight * 0.55;
      const end = next.offsetTop + innerHeight * 0.1;
      t = Math.min(1, Math.max(0, (mid - start) / Math.max(1, end - start)));
    }
    const a = PALETTES[cur.id];
    const b = next ? PALETTES[next.id] : a;
    const root = document.documentElement.style;
    root.setProperty('--bg-a', mix(a[0], b[0], t));
    root.setProperty('--bg-b', mix(a[1], b[1], t));
    root.setProperty('--bg-c', mix(a[2], b[2], t));
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  update();
  return queue;
}
