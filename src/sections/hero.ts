/* 01 · LOBBY — the cinematic first impression. */
import { h, countUp, formatNumber, prefersReducedMotion } from '../lib/dom';
import { config } from '../config';
import { donutSVG } from '../components/art';
import { icon } from '../components/icons';
import { openComposer } from '../components/composer';
import { hiddenCrystal } from '../components/hidden';
import { crystalById } from '../components/crystals';
import { toast } from '../components/toast';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { app } from '../state';
import type { HeroScene } from '../scene/heroScene';
import type { CrystalId } from '../components/crystals';

export interface HeroHandle {
  el: HTMLElement;
  /** Loads three.js + builds the scene. Resolves false if WebGL is unavailable. */
  prepare(): Promise<boolean>;
  play(): Promise<void>;
}

function floridaTime() {
  try {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: config.streamer.timezone }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

function countdownParts(target: Date) {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function mountHero(): HeroHandle {
  const canvas = h('canvas', { class: 'hero__canvas', 'aria-label': 'A crystal donut floating over a sunset ocean. Click it to boop.' });
  const fallback = h('div', { class: 'hero__fallback', html: donutSVG('HeyDani', { flavor: 'strawberry', size: 420 }) });
  const messagesStat = h('span', { class: 'stat__num' }, '0');
  const boopsStat = h('span', { class: 'stat__num' }, '0');
  const clock = h('span', { class: 'stat__num' }, floridaTime());
  const countdown = h('div', { class: 'hero__countdown', hidden: true });
  const dropHud = h('div', { class: 'hero__drop', 'aria-hidden': 'true' }, h('span', { class: 'hero__drop-label' }, 'Dropping in'), h('span', { class: 'hero__drop-alt' }, 'ALT 1,200m'));

  const title = h('h1', { class: 'hero__title' }, h('span', { class: 'hero__kicker' }, config.occasion.kicker), h('span', { class: 'hero__name', 'data-text': config.occasion.headline }, config.occasion.headline));

  const el = h(
    'section',
    { id: 'lobby', class: 'hero', 'aria-label': 'Lobby' },
    canvas,
    fallback,
    h('div', { class: 'hero__vignette', 'aria-hidden': 'true' }),
    hiddenCrystal('citrine', 'hero__citrine'),
    h(
      'div',
      { class: 'hero__content' },
      h('p', { class: 'hero__tag' }, h('span', { class: 'live-dot' }), `${config.streamer.community} presents`),
      title,
      h('p', { class: 'hero__sub' }, config.occasion.subline),
      countdown,
      h(
        'div',
        { class: 'hero__ctas' },
        h('a', { class: 'btn btn--primary btn--xl', href: '#wall', html: `<span>Read the wall</span>${icon('right', 20)}` }),
        h('button', { class: 'btn btn--glass btn--xl', type: 'button', onclick: () => openComposer(), html: `${icon('plus', 20)}<span>Bake a message</span>` }),
      ),
      h(
        'dl',
        { class: 'hero__stats' },
        h('div', { class: 'stat' }, h('dt', null, 'Messages'), h('dd', null, messagesStat)),
        h('div', { class: 'stat' }, h('dt', null, 'Donut boops'), h('dd', null, boopsStat)),
        h('div', { class: 'stat' }, h('dt', null, 'Florida time'), h('dd', null, clock)),
      ),
    ),
    h('p', { class: 'hero__hint' }, h('span', { class: 'hero__hint-key' }, 'Drag'), ' to spin · ', h('span', { class: 'hero__hint-key' }, 'Click'), ' the donut to boop'),
    h('a', { class: 'hero__scroll', href: '#player', 'aria-label': 'Scroll down' }, h('span', null, 'Scroll'), h('i')),
    dropHud,
  );

  /* Live counters */
  const updateMessages = () => countUp(messagesStat, app.approvedCount, 1600);
  app.events.on('ready', updateMessages);
  app.events.on('added', updateMessages);
  app.events.on('removed', updateMessages);
  setInterval(() => (clock.textContent = floridaTime()), 15_000);

  /* Countdown */
  if (config.occasion.date) {
    const target = new Date(config.occasion.date + 'T00:00:00');
    const tick = () => {
      const p = countdownParts(target);
      countdown.hidden = false;
      if (!p) {
        const today = new Date().toDateString() === target.toDateString();
        countdown.replaceChildren(h('span', { class: 'hero__today' }, today ? '✨ It’s today! ✨' : '✨ The big day ✨'));
        return;
      }
      countdown.replaceChildren(
        h('span', { class: 'hud-label' }, 'Countdown'),
        ...(['d', 'h', 'm', 's'] as const).map((k) => h('span', { class: 'cd' }, h('b', null, String(p[k]).padStart(2, '0')), h('small', null, k))),
      );
    };
    tick();
    setInterval(tick, 1000);
  }

  /* Boops — batched to the server */
  let boops = 0;
  let pending = 0;
  let flushTimer = 0;
  app.events.on('ready', async () => {
    boops = await app.store.boops().catch(() => 0);
    countUp(boopsStat, boops, 1600);
  });
  const flush = async () => {
    flushTimer = 0;
    const n = pending;
    pending = 0;
    const server = await app.store.boop(Math.min(n, 50)).catch(() => null);
    if (server !== null && server > boops) {
      boops = server;
      boopsStat.textContent = formatNumber(boops);
    }
  };
  const onBoop = (x: number, y: number) => {
    boops++;
    pending++;
    boopsStat.textContent = formatNumber(boops);
    boopsStat.dataset.value = String(boops);
    progress.addBoops(1);
    sound.boop();
    const plus = h('span', { class: 'boop-float' }, '+1 boop');
    plus.style.left = `${x}px`;
    plus.style.top = `${y}px`;
    document.body.appendChild(plus);
    setTimeout(() => plus.remove(), 1000);
    if (!flushTimer) flushTimer = window.setTimeout(flush, 1500);
  };

  let scene: HeroScene | null = null;
  let visible = true;

  const prepare = async () => {
    try {
      const test = document.createElement('canvas');
      if (!test.getContext('webgl2')) throw new Error('no webgl2');
      const { createHeroScene } = await import('../scene/heroScene');
      scene = createHeroScene(canvas, {
        reducedMotion: prefersReducedMotion(),
        onBoop,
        onCrystalClick: (id) => {
          // The orbiting shards mirror your collection; an unfound one teases where to look.
          const c = crystalById(id);
          if (!c) return;
          sound.hover();
          if (progress.data.crystals.includes(id as CrystalId)) toast(`${c.name}: ${c.line}`, { life: 4200 });
          else toast(`That glimmer is ${c.name}. Hint: ${c.hint}`, { life: 5200 });
        },
      });
      scene.setCrystals(progress.data.crystals);
      progress.events.on('change', (d) => scene?.setCrystals(d.crystals));
      el.classList.add('has-webgl');
      // Render one frame early so the boot screen hands off to a live picture.
      scene.start();
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !document.hidden) scene?.start();
        else scene?.stop();
      }).observe(el);
      document.addEventListener('visibilitychange', () => (document.hidden || !visible ? scene?.stop() : scene?.start()));
      let raf = 0;
      addEventListener(
        'scroll',
        () => {
          if (raf) return;
          raf = requestAnimationFrame(() => {
            raf = 0;
            const p = Math.min(1, Math.max(0, scrollY / Math.max(1, el.offsetHeight)));
            scene?.setScroll(p);
            el.style.setProperty('--hero-p', String(p));
          });
        },
        { passive: true },
      );
      return true;
    } catch (err) {
      console.warn('[Dani’s Donuts] WebGL unavailable, using the 2D lobby.', err);
      el.classList.add('no-webgl');
      return false;
    }
  };

  const play = async () => {
    el.classList.add('is-playing');
    if (!scene) {
      el.classList.add('is-ready');
      return;
    }
    const alt = dropHud.querySelector('.hero__drop-alt') as HTMLElement;
    el.classList.add('is-dropping');
    await scene.intro((t) => {
      alt.textContent = `ALT ${formatNumber(Math.max(0, 1200 * (1 - t) * (1 - t)))}m`;
    });
    el.classList.remove('is-dropping');
    el.classList.add('is-ready');
  };

  return { el, prepare, play };
}
