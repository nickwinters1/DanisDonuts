/* Game HUD: logo, section tabs, rank ring, crystal counter, sound, the Bake button, pause menu + locker. */
import { h, $$ } from '../lib/dom';
import { donutSVG, stickerSVG } from './art';
import { icon } from './icons';
import { progress, ACHIEVEMENTS, RANKS } from '../lib/progress';
import { sound } from '../lib/sound';
import { openComposer } from './composer';
import { openModal } from './modal';
import { CRYSTALS, crystalSVG } from './crystals';
import { config } from '../config';
import { isLive } from '../data/store';

export const SECTIONS = [
  { id: 'lobby', label: 'Lobby' },
  { id: 'player', label: 'Player 1' },
  { id: 'wall', label: 'The Wall' },
  { id: 'pass', label: 'Season Pass' },
  { id: 'collection', label: 'Collection' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'live', label: 'Live' },
  { id: 'for-dani', label: `For ${config.streamer.name}` },
];

const RING = 2 * Math.PI * 17;

export function mountHud() {
  const indicator = h('span', { class: 'hud__indicator', 'aria-hidden': 'true' });
  const tabs = SECTIONS.map((s) => h('a', { class: 'hud__tab', href: `#${s.id}`, dataset: { target: s.id } }, s.label));
  const nav = h('nav', { class: 'hud__nav', 'aria-label': 'Sections' }, tabs, indicator);

  const ringFg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  const rankBtn = h('button', { class: 'hud__rank', type: 'button', 'aria-label': 'Your rank and trophies' });
  rankBtn.innerHTML = `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/></svg><span class="hud__lvl"></span>`;
  ringFg.setAttribute('cx', '20');
  ringFg.setAttribute('cy', '20');
  ringFg.setAttribute('r', '17');
  ringFg.setAttribute('fill', 'none');
  ringFg.setAttribute('stroke', 'url(#xpGrad)');
  ringFg.setAttribute('stroke-width', '3');
  ringFg.setAttribute('stroke-linecap', 'round');
  ringFg.setAttribute('stroke-dasharray', String(RING));
  ringFg.setAttribute('transform', 'rotate(-90 20 20)');
  const svg = rankBtn.querySelector('svg')!;
  svg.insertAdjacentHTML('afterbegin', '<defs><linearGradient id="xpGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8fc7"/><stop offset=".5" stop-color="#b79cff"/><stop offset="1" stop-color="#7df9ff"/></linearGradient></defs>');
  svg.appendChild(ringFg);
  const lvl = rankBtn.querySelector('.hud__lvl') as HTMLElement;

  const crystalsBtn = h('button', {
    class: 'hud__crystals',
    type: 'button',
    'aria-label': 'Crystal collection',
    html: `${crystalSVG('heart', 26)}<span class="hud__crystal-count">0/7</span>`,
  });
  const soundBtn = h('button', { class: 'hud__icon-btn', type: 'button', 'aria-label': 'Toggle sound' });
  const bakeBtn = h('button', { class: 'btn btn--primary btn--bake', type: 'button', html: `${icon('plus', 18)}<span>Bake a message</span>` });
  const menuBtn = h('button', { class: 'hud__icon-btn hud__menu', type: 'button', 'aria-label': 'Open menu', html: icon('menu', 22) });

  const hud = h(
    'header',
    { class: 'hud', id: 'hud' },
    h(
      'a',
      { class: 'hud__logo', href: '#lobby', 'aria-label': `${config.streamer.community} — back to top` },
      h('span', { class: 'hud__logo-donut', html: donutSVG('HeyDani', { flavor: 'strawberry', size: 36 }) }),
      h('span', { class: 'hud__logo-text' }, h('b', null, config.streamer.community.toUpperCase())),
    ),
    nav,
    h('div', { class: 'hud__right' }, isLive() ? null : h('span', { class: 'hud__preview', title: 'Preview Mode: sample messages, saved only in this browser. Connect Supabase to go live.' }, 'Preview'), crystalsBtn, rankBtn, soundBtn, bakeBtn, menuBtn),
  );
  document.body.prepend(hud);

  const updateRank = () => {
    const r = progress.rankFor();
    lvl.textContent = String(r.level);
    ringFg.setAttribute('stroke-dashoffset', String(RING * (1 - r.progress)));
    rankBtn.title = `Rank ${r.level}: ${r.name} · ${progress.data.xp} XP`;
    const found = progress.data.crystals.filter((c) => c !== 'heart').length;
    (crystalsBtn.querySelector('.hud__crystal-count') as HTMLElement).textContent = `${found}/7`;
    crystalsBtn.classList.toggle('is-complete', found >= 7);
  };
  const updateSound = (on: boolean) => {
    soundBtn.innerHTML = icon(on ? 'soundOn' : 'soundOff', 22);
    soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundBtn.title = on ? 'Sound on' : 'Sound off';
  };
  updateRank();
  updateSound(sound.enabled);
  progress.events.on('change', updateRank);
  progress.events.on('xp', () => {
    rankBtn.classList.remove('is-pulse');
    void rankBtn.offsetWidth;
    rankBtn.classList.add('is-pulse');
  });
  progress.events.on('crystal', () => {
    crystalsBtn.classList.remove('is-pulse');
    void crystalsBtn.offsetWidth;
    crystalsBtn.classList.add('is-pulse');
  });
  sound.onChange(updateSound);

  soundBtn.addEventListener('click', () => {
    sound.unlock();
    sound.toggle();
  });
  bakeBtn.addEventListener('click', () => openComposer());
  rankBtn.addEventListener('click', () => openLocker());
  crystalsBtn.addEventListener('click', () => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' }));
  menuBtn.addEventListener('click', () => openPauseMenu());

  // Scroll spy + sliding indicator
  const moveIndicator = (tab: HTMLElement | undefined) => {
    if (!tab) return;
    indicator.style.width = `${tab.offsetWidth}px`;
    indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
    tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
  };
  const visible = new Map<string, number>();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => visible.set(e.target.id, e.intersectionRatio));
      let best = '';
      let bestRatio = 0;
      for (const [id, ratio] of visible) if (ratio > bestRatio) [best, bestRatio] = [id, ratio];
      if (best) moveIndicator(tabs.find((t) => t.dataset.target === best));
    },
    { threshold: [0, 0.15, 0.3, 0.5, 0.7, 1] },
  );
  requestAnimationFrame(() => SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); }));
  tabs.forEach((t) => t.addEventListener('mouseenter', () => sound.hover()));

  let lastY = 0;
  addEventListener(
    'scroll',
    () => {
      const y = scrollY;
      hud.classList.toggle('is-scrolled', y > 40);
      hud.classList.toggle('is-hidden', y > 600 && y > lastY + 4 && !document.documentElement.classList.contains('modal-open'));
      if (y < lastY - 4) hud.classList.remove('is-hidden');
      lastY = y;
    },
    { passive: true },
  );
  addEventListener('resize', () => moveIndicator(tabs.find((t) => t.classList.contains('is-active'))));
  return hud;
}

function openPauseMenu() {
  sound.click();
  const items = SECTIONS.map((s, i) =>
    h(
      'a',
      { class: 'pause__item', href: `#${s.id}`, style: { '--i': String(i) } },
      h('span', { class: 'pause__num' }, String(i + 1).padStart(2, '0')),
      s.label,
    ),
  );
  const resume = h('button', { class: 'btn btn--primary', type: 'button' }, 'Resume');
  const content = h(
    'div',
    { class: 'pause' },
    h('p', { class: 'pause__title' }, 'Paused'),
    h('nav', { class: 'pause__list', 'aria-label': 'Sections' }, items),
    h('div', { class: 'pause__actions' }, resume, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { modal.close(); openComposer(); } }, 'Bake a message')),
  );
  const modal = openModal(content, { label: 'Menu', className: 'modal--pause' });
  resume.addEventListener('click', () => modal.close());
  items.forEach((a) => a.addEventListener('click', () => modal.close()));
}

export function openLocker() {
  sound.click();
  const r = progress.rankFor();
  const found = new Set(progress.data.crystals);
  const content = h(
    'div',
    { class: 'locker' },
    h(
      'div',
      { class: 'locker__rank' },
      h('div', { class: 'locker__donut', html: donutSVG(progress.data.handle || progress.data.name || 'visitor', { size: 96 }) }),
      h(
        'div',
        null,
        h('p', { class: 'hud-label' }, 'Your Donut rank'),
        h('h2', { class: 'locker__name' }, h('span', { class: 'locker__lv' }, `LV ${r.level}`), ' ', r.name),
        h('div', { class: 'xpbar' }, h('span', { style: { width: `${Math.round(r.progress * 100)}%` } })),
        h('p', { class: 'locker__xp' }, r.next ? `${progress.data.xp} XP · ${r.next.xp - progress.data.xp} to ${r.next.name}` : `${progress.data.xp} XP · Max rank. Legendary.`),
      ),
    ),
    h('p', { class: 'hud-label' }, `Crystals · ${[...found].filter((c) => c !== 'heart').length}/7`),
    h(
      'div',
      { class: 'locker__crystals' },
      CRYSTALS.map((c) => h('div', { class: `locker__crystal${found.has(c.id) ? ' is-found' : ''}`, title: found.has(c.id) ? c.name : 'Not found yet', html: crystalSVG(c.id, 44, found.has(c.id)) })),
    ),
    h('p', { class: 'hud-label' }, `Trophies · ${progress.data.achievements.length}/${ACHIEVEMENTS.length}`),
    h(
      'ul',
      { class: 'trophies' },
      ACHIEVEMENTS.map((a) => {
        const got = progress.has(a.id);
        return h(
          'li',
          { class: `trophy${got ? ' is-got' : ''}` },
          h('span', { class: 'trophy__icon', html: got || !a.secret ? stickerSVG(a.icon, 36) : '' }, got || !a.secret ? null : '?'),
          h('span', { class: 'trophy__text' }, h('strong', null, got || !a.secret ? a.title : 'Secret trophy'), h('small', null, got || !a.secret ? a.desc : 'Keep exploring…')),
          h('span', { class: 'trophy__xp' }, `${a.xp} XP`),
        );
      }),
    ),
    h('p', { class: 'locker__ranks' }, RANKS.map((x) => x.name).join(' → ')),
  );
  openModal(content, { label: 'Your locker', className: 'modal--locker' });
}

export function highlightTabs() {
  return $$('.hud__tab');
}
