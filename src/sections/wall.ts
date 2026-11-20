/* 03 · THE DONUT WALL — every message, as a one-of-a-kind holo card. */
import { h, countUp } from '../lib/dom';
import { config } from '../config';
import { sectionHead } from '../components/sectionHead';
import { renderCard, attachTilt } from '../components/card';
import { openInspect } from '../components/inspect';
import { openComposer } from '../components/composer';
import { icon } from '../components/icons';
import { donutSVG } from '../components/art';
import { hiddenCrystal } from '../components/hidden';
import { toast } from '../components/toast';
import { shuffle } from '../lib/rand';
import { sound } from '../lib/sound';
import { app } from '../state';
import type { Message } from '../data/types';

type Sort = 'newest' | 'oldest' | 'loved' | 'shuffle';
const BATCH = 18;

export function mountWall() {
  let sort: Sort = 'newest';
  let query = '';
  let mediaOnly = false;
  let list: Message[] = [];
  let rendered = 0;
  let cols: HTMLElement[] = [];
  let shuffleSeed: Message[] | null = null;

  const count = h('span', { class: 'wall__count-num' }, '0');
  const grid = h('div', { class: 'wall__grid', 'aria-live': 'polite' });
  const sentinel = h('div', { class: 'wall__sentinel', 'aria-hidden': 'true' });
  const empty = h(
    'div',
    { class: 'wall__empty', hidden: true },
    h('div', { class: 'wall__empty-donut', html: donutSVG('empty-box', { flavor: 'vanilla', size: 120 }) }),
    h('h3', null, 'The box is empty…'),
    h('p', null, `Be the very first Donut to leave ${config.streamer.name} a message.`),
    h('button', { class: 'btn btn--primary', type: 'button', onclick: () => openComposer() }, 'Bake the first message'),
  );
  const noResults = h('p', { class: 'wall__noresults', hidden: true }, 'No donuts match that search. Try another name?');

  const sortBtns = (['newest', 'oldest', 'loved', 'shuffle'] as Sort[]).map((s) =>
    h(
      'button',
      {
        class: `seg__btn${s === sort ? ' is-on' : ''}`,
        type: 'button',
        'aria-pressed': s === sort ? 'true' : 'false',
        html: s === 'shuffle' ? `${icon('shuffle', 16)}<span>Shuffle</span>` : `<span>${{ newest: 'Newest', oldest: 'Oldest', loved: 'Most loved' }[s]}</span>`,
        onclick: () => {
          if (s === 'shuffle') shuffleSeed = null;
          sort = s;
          sortBtns.forEach((b, i) => {
            const on = ['newest', 'oldest', 'loved', 'shuffle'][i] === s;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          sound.click();
          refresh();
        },
      },
    ),
  );
  const search = h('input', { type: 'search', class: 'wall__search', placeholder: 'Find a Donut…', 'aria-label': 'Search messages' });
  const mediaToggle = h('button', { class: 'seg__btn', type: 'button', 'aria-pressed': 'false', html: `${icon('image', 16)}<span>Photos</span>` });

  const el = h(
    'section',
    { id: 'wall', class: 'section wall' },
    sectionHead(
      3,
      'The Donut Wall',
      h('span', null, 'Baked with love, ', h('span', { class: 'holo-text' }, 'by your Donuts')),
      `Every card here is one person telling ${config.streamer.name} what she means to them. Tap one to pull it out of the box.`,
      h(
        'div',
        { class: 'wall__counter' },
        h('span', { class: 'wall__count' }, count, h('small', null, ' messages')),
        hiddenCrystal('rose', 'wall__rose'),
      ),
    ),
    h(
      'div',
      { class: 'wall__bar glass', 'data-reveal': '' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Sort' }, sortBtns),
      h('div', { class: 'wall__search-wrap', html: icon('search', 18) }, search),
      mediaToggle,
      h('a', { class: 'btn btn--ghost btn--sm wall__stream', href: '#/stream', title: 'A full-screen slideshow for reading messages on stream', html: `${icon('tv', 18)}<span>Stream Mode</span>` }),
      h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => openComposer(), html: `${icon('plus', 18)}<span>Bake yours</span>` }),
    ),
    grid,
    noResults,
    empty,
    sentinel,
  );

  const columnCount = () => {
    const w = grid.clientWidth || innerWidth;
    return w >= 1240 ? 4 : w >= 900 ? 3 : w >= 560 ? 2 : 1;
  };

  const compute = (): Message[] => {
    let out = app.messages.slice();
    if (query) {
      const q = query.toLowerCase();
      out = out.filter((m) => m.name.toLowerCase().includes(q) || (m.handle ?? '').toLowerCase().includes(q) || m.body.toLowerCase().includes(q));
    }
    if (mediaOnly) out = out.filter((m) => !!m.mediaUrl);
    switch (sort) {
      case 'newest':
        out.sort((a, b) => (b.pending ? 1 : 0) - (a.pending ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
        break;
      case 'oldest':
        out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        break;
      case 'loved':
        out.sort((a, b) => b.hearts - a.hearts);
        break;
      case 'shuffle':
        if (!shuffleSeed) shuffleSeed = shuffle(out);
        out = shuffleSeed.filter((m) => out.includes(m));
        break;
    }
    return out;
  };

  const shortest = () => cols.reduce((a, b) => (b.offsetHeight < a.offsetHeight ? b : a), cols[0]);

  const makeCard = (m: Message, i: number) => {
    const card = renderCard(m, 'wall');
    card.classList.add('is-entering');
    card.style.setProperty('--d', `${(i % BATCH) * 45}ms`);
    card.addEventListener('animationend', () => card.classList.remove('is-entering'), { once: true });
    const open = () => {
      const idx = list.findIndex((x) => x.id === m.id);
      openInspect(list, Math.max(0, idx));
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    card.addEventListener('mouseenter', () => sound.hover());
    attachTilt(card, 9);
    return card;
  };

  const renderMore = () => {
    const batch = list.slice(rendered, rendered + BATCH);
    batch.forEach((m, i) => shortest().appendChild(makeCard(m, i)));
    rendered += batch.length;
    sentinel.hidden = rendered >= list.length;
  };

  const layout = () => {
    const n = columnCount();
    cols = Array.from({ length: n }, () => h('div', { class: 'wall__col' }));
    grid.replaceChildren(...cols);
    grid.style.setProperty('--cols', String(n));
    rendered = 0;
    renderMore();
  };

  const refresh = () => {
    list = compute();
    empty.hidden = app.messages.length > 0;
    noResults.hidden = !(app.messages.length > 0 && list.length === 0);
    countUp(count, app.approvedCount, 900);
    layout();
  };

  let t = 0;
  search.addEventListener('input', () => {
    clearTimeout(t);
    t = window.setTimeout(() => {
      query = search.value.trim();
      refresh();
    }, 220);
  });
  mediaToggle.addEventListener('click', () => {
    mediaOnly = !mediaOnly;
    mediaToggle.classList.toggle('is-on', mediaOnly);
    mediaToggle.setAttribute('aria-pressed', mediaOnly ? 'true' : 'false');
    sound.click();
    refresh();
  });

  new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && rendered < list.length) renderMore();
    },
    { rootMargin: '900px 0px' },
  ).observe(sentinel);

  let lastCols = 0;
  new ResizeObserver(() => {
    const n = columnCount();
    if (n !== lastCols && app.ready) {
      lastCols = n;
      layout();
    }
  }).observe(grid);

  app.events.on('ready', () => {
    lastCols = columnCount();
    refresh();
  });
  app.events.on('added', (m) => {
    list = compute();
    countUp(count, app.approvedCount, 600);
    empty.hidden = true;
    if (!list.includes(m) || !cols.length) return;
    const card = makeCard(m, 0);
    card.classList.add('is-fresh');
    if (sort === 'newest') cols[0].prepend(card);
    else shortest().appendChild(card);
    rendered++;
    if (!m.pending && m.id && !m.id.startsWith('local-') && !m.id.startsWith('mine-')) {
      toast(`${m.name} just baked a donut 🍩`, { kind: 'live' });
    }
  });
  app.events.on('removed', (id) => {
    grid.querySelector(`.dcard[data-id="${CSS.escape(id)}"]`)?.remove();
    list = compute();
    countUp(count, app.approvedCount, 600);
  });
  app.events.on('updated', (m) => {
    // Usually a heart from someone else: just update the count, no re-render.
    grid.querySelectorAll(`.dcard[data-id="${CSS.escape(m.id)}"] .dcard__heart span`).forEach((s) => (s.textContent = String(m.hearts)));
    list = compute();
  });

  return el;
}
