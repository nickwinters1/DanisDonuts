/* The holographic Donut Card — the heart of the wall. */
import { h, svgEl, isFinePointer, prefersReducedMotion, clamp, formatDate } from '../lib/dom';
import { donutSVG, dripPath, flavorById, frostingSprinkles, stickerSVG, SPRINKLE_COLORS } from './art';
import { icon } from './icons';
import type { Message } from '../data/types';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { burstFrom } from './confetti';
import { app } from '../state';
import { config } from '../config';

export type CardSize = 'wall' | 'inspect' | 'stream' | 'preview' | 'mini';

export const cardNo = (m: Message) => (m.number ? `#${String(m.number).padStart(4, '0')}` : m.pending ? '#····' : '#NEW');

export function safeMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  const u = url.trim();
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(u)) return u;
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function frostingSvg(m: Message) {
  const f = flavorById(m.flavor);
  const seed = m.id + m.name;
  const gid = `fg-${Math.random().toString(36).slice(2, 8)}`;
  const sprinkleColors = (f.sprinkles ?? SPRINKLE_COLORS).filter((c) => c !== f.frost);
  return `<svg class="dcard__frost" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${f.stops[0]}"/><stop offset=".55" stop-color="${f.stops[1]}"/><stop offset="1" stop-color="${f.stops[2]}"/></linearGradient></defs>
<path d="${dripPath(seed)}" fill="url(#${gid})"/>
<path d="${dripPath(seed)}" fill="none" stroke="${f.deep}" stroke-opacity=".25" stroke-width="2"/>
${frostingSprinkles(seed, sprinkleColors)}
<path d="M18,16 Q80,8 150,14" stroke="#fff" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;
}

export function renderCard(m: Message, size: CardSize = 'wall'): HTMLElement {
  const f = flavorById(m.flavor);
  const media = safeMediaUrl(m.mediaUrl);
  const hearted = progress.data.hearted.includes(m.id);

  const heartBtn =
    size === 'mini' || size === 'preview' || m.pending
      ? null
      : h(
          'button',
          {
            class: `dcard__heart${hearted ? ' is-on' : ''}`,
            type: 'button',
            'aria-label': hearted ? 'You loved this' : `Send a heart to ${m.name}`,
            'aria-pressed': hearted ? 'true' : 'false',
            html: `${icon('heart', 16)}<span>${m.hearts || 0}</span>`,
            onclick: (e: Event) => {
              e.stopPropagation();
              heartMessage(m, e.currentTarget as HTMLButtonElement);
            },
          },
        );

  const body = h('p', { class: `dcard__msg${m.font === 'hand' ? ' is-hand' : ''}` }, m.body);
  const len = m.body.length;
  body.style.setProperty('--len', String(len));
  if (len < 90) body.classList.add('is-short');
  else if (len > 420) body.classList.add('is-long');

  const card = h(
    'article',
    {
      class: `dcard dcard--${size} flavor-${f.id}${m.pending ? ' is-pending' : ''}${media ? ' has-media' : ''}`,
      style: { '--frost': f.frost, '--frost-deep': f.deep, '--frost-light': f.light },
      dataset: { id: m.id },
      tabindex: size === 'wall' ? '0' : null,
      'aria-label': `Message from ${m.name}`,
    },
    h(
      'div',
      { class: 'dcard__inner' },
      svgEl(frostingSvg(m)),
      h(
        'header',
        { class: 'dcard__head' },
        h('div', { class: 'dcard__avatar', html: donutSVG(m.handle || m.name, { flavor: m.flavor, size: 72 }) }),
        h(
          'div',
          { class: 'dcard__who' },
          h('h3', { class: 'dcard__name' }, m.name),
          h(
            'p',
            { class: 'dcard__meta' },
            m.handle ? h('span', { class: 'dcard__handle' }, '@' + m.handle) : null,
            m.since ? h('span', { class: 'dcard__since' }, `Donut since ${m.since}`) : null,
          ),
        ),
        h('span', { class: 'dcard__no' }, cardNo(m)),
      ),
      h('div', { class: 'dcard__body' }, body),
      media
        ? h(
            'figure',
            { class: 'dcard__media' },
            h('img', {
              src: media,
              alt: `Image shared by ${m.name}`,
              loading: 'lazy',
              decoding: 'async',
              referrerpolicy: 'no-referrer',
              onerror: (e: Event) => ((e.currentTarget as HTMLElement).closest('figure')?.remove()),
            }),
          )
        : null,
      h(
        'footer',
        { class: 'dcard__foot' },
        h('span', { class: 'dcard__sticker', html: stickerSVG(m.sticker, size === 'stream' ? 64 : 44) }),
        m.pending
          ? h('span', { class: 'dcard__oven' }, h('i'), 'In the oven — waiting for approval')
          : h('span', { class: 'dcard__flavor' }, f.name),
        heartBtn,
      ),
    ),
    h('div', { class: 'dcard__holo', 'aria-hidden': 'true' }),
    h('div', { class: 'dcard__glare', 'aria-hidden': 'true' }),
  );
  return card;
}

export function renderCardBack(m: Message): HTMLElement {
  const f = flavorById(m.flavor);
  return h(
    'article',
    {
      class: `dcard dcard--back dcard--inspect flavor-${f.id}`,
      style: { '--frost': f.frost, '--frost-deep': f.deep, '--frost-light': f.light },
      'aria-label': 'Back of card',
    },
    h(
      'div',
      { class: 'dcard__inner dcard__inner--back' },
      h('div', { class: 'back__pattern', 'aria-hidden': 'true' }),
      h('div', { class: 'back__emblem', html: donutSVG('HeyDani', { flavor: 'holo', size: 120 }) }),
      h('p', { class: 'back__kicker' }, `${config.streamer.community} · Collector card`),
      h('p', { class: 'back__no' }, cardNo(m)),
      h(
        'dl',
        { class: 'back__stats' },
        h('div', null, h('dt', null, 'Baked by'), h('dd', null, m.name)),
        h('div', null, h('dt', null, 'Flavor'), h('dd', null, f.name)),
        h('div', null, h('dt', null, 'Baked on'), h('dd', null, formatDate(m.createdAt))),
        h('div', null, h('dt', null, 'Rarity'), h('dd', { class: 'back__rarity' }, '1 of 1')),
      ),
      h('p', { class: 'back__foot' }, `For ${config.streamer.name}, with love`),
    ),
    h('div', { class: 'dcard__holo', 'aria-hidden': 'true' }),
    h('div', { class: 'dcard__glare', 'aria-hidden': 'true' }),
  );
}

export function heartMessage(m: Message, btn?: HTMLElement | null) {
  if (progress.data.hearted.includes(m.id)) {
    sound.pop();
    if (btn) {
      btn.classList.remove('is-bump');
      void btn.offsetWidth;
      btn.classList.add('is-bump');
    }
    return;
  }
  progress.markHearted(m.id);
  m.hearts = (m.hearts || 0) + 1;
  sound.heart();
  void app.store?.heart(m.id).catch(() => {});
  document.querySelectorAll<HTMLElement>(`.dcard[data-id="${CSS.escape(m.id)}"] .dcard__heart`).forEach((b) => {
    b.classList.add('is-on', 'is-bump');
    b.setAttribute('aria-pressed', 'true');
    const span = b.querySelector('span');
    if (span) span.textContent = String(m.hearts);
  });
  if (btn) burstFrom(btn, { count: 14, shapes: ['heart'], colors: ['#ff4fa3', '#ff8fc7', '#ffffff'], power: 5, gravity: 0.15 });
}

/* ───────── Holographic tilt ───────── */

export function attachTilt(el: HTMLElement, strength = 10) {
  if (prefersReducedMotion()) return () => {};
  let raf = 0;
  let rect: DOMRect | null = null;
  const set = (px: number, py: number) => {
    el.style.setProperty('--px', `${px * 100}%`);
    el.style.setProperty('--py', `${py * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - py) * strength}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * strength * 1.15}deg`);
    el.style.setProperty('--hyp', String(clamp(Math.hypot(px - 0.5, py - 0.5) * 2, 0, 1)));
  };
  const move = (e: PointerEvent) => {
    if (!rect) rect = el.getBoundingClientRect();
    const px = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => set(px, py));
  };
  const enter = () => {
    rect = el.getBoundingClientRect();
    el.classList.add('is-tilting');
    el.classList.remove('is-resetting');
  };
  const leave = () => {
    rect = null;
    cancelAnimationFrame(raf);
    el.classList.remove('is-tilting');
    el.classList.add('is-resetting');
    set(0.5, 0.5);
  };
  if (isFinePointer()) {
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
  }
  return () => {
    el.removeEventListener('pointerenter', enter);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerleave', leave);
  };
}

/** Phone tilt → holo shine (used in the inspector). */
export function attachGyro(el: HTMLElement) {
  if (prefersReducedMotion()) return () => {};
  let base: { b: number; g: number } | null = null;
  const handler = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    if (!base) base = { b: e.beta, g: e.gamma };
    const px = clamp(0.5 + (e.gamma - base.g) / 50, 0, 1);
    const py = clamp(0.5 + (e.beta - base.b) / 50, 0, 1);
    el.classList.add('is-tilting');
    el.style.setProperty('--px', `${px * 100}%`);
    el.style.setProperty('--py', `${py * 100}%`);
    el.style.setProperty('--rx', `${(0.5 - py) * 18}deg`);
    el.style.setProperty('--ry', `${(px - 0.5) * 20}deg`);
    el.style.setProperty('--hyp', String(clamp(Math.hypot(px - 0.5, py - 0.5) * 2, 0, 1)));
  };
  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
}
