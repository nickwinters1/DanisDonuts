import './styles/main.css';
import { h, sleep, prefersReducedMotion } from './lib/dom';
import { config } from './config';
import { app } from './state';
import { progress } from './lib/progress';
import { sound } from './lib/sound';
import { donutSVG } from './components/art';
import { achievementToast, levelToast, toast } from './components/toast';
import { observeReveals } from './lib/reveal';
import { rain } from './components/confetti';

const route = location.hash.match(/^#\/(stream|overlay|admin)/)?.[1];

/* Switching between the site and a full-screen view is a clean reload. */
addEventListener('hashchange', () => {
  const next = location.hash.match(/^#\/(stream|overlay|admin)/)?.[1];
  if (next !== route) location.reload();
});

if (!route) {
  progress.events.on('achievement', achievementToast);
  progress.events.on('level', ({ level, name }) => levelToast(level, name));
}

if (route === 'stream') import('./views/stream').then((m) => m.mountStream());
else if (route === 'overlay') import('./views/overlay').then((m) => m.mountOverlay());
else if (route === 'admin') import('./views/admin').then((m) => m.mountAdmin());
else void mountSite();

const TIPS = [
  'TIP: Seven crystals are hidden on this page. Look closely.',
  'TIP: Click the donut. Then click it again. And again.',
  'TIP: Every card is holographic — tilt it.',
  'TIP: Seagulls will steal your donuts. Stay alert.',
  'TIP: Your donut avatar is unique to your name.',
  'TIP: There may or may not be a secret code. ↑ ↑ ↓ ↓',
  `TIP: ${config.streamer.name} reads these. Make it count.`,
];
const STATUS = ['Preheating the oven…', 'Baking donuts…', 'Polishing crystals…', 'Waxing surfboards…', 'Waking up chat…', 'Counting sprinkles…', 'Queueing with your Donuts…'];

async function mountSite() {
  const [{ mountHud }, { mountHero }, { mountPlayer }, { mountWall }, { mountPass }, { mountCollection }, { mountArcade }, { mountLive }, { mountFinale }, { mountSkyBackground }, { mountCursor }] =
    await Promise.all([
      import('./components/hud'),
      import('./sections/hero'),
      import('./sections/player'),
      import('./sections/wall'),
      import('./sections/pass'),
      import('./sections/collection'),
      import('./sections/arcade'),
      import('./sections/live'),
      import('./sections/finale'),
      import('./components/skybg'),
      import('./components/cursor'),
    ]);

  /* ── Boot screen ── */
  const bar = h('span', { class: 'boot__fill' });
  const status = h('p', { class: 'boot__status' }, STATUS[0]);
  const startBtn = h('button', { class: 'boot__start', type: 'button', disabled: true }, h('span', null, 'Press start'));
  const soundToggle = h('input', { type: 'checkbox', checked: sound.enabled });
  const boot = h(
    'div',
    { class: 'boot', role: 'dialog', 'aria-label': 'Loading' },
    h('div', { class: 'boot__bg', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'boot__inner' },
      h('div', { class: 'boot__donut', html: donutSVG('HeyDani', { flavor: 'strawberry', size: 132 }) }),
      h('p', { class: 'boot__brand' }, config.streamer.community),
      h('p', { class: 'boot__for' }, `A gift for ${config.streamer.name}`),
      h('div', { class: 'boot__bar', role: 'progressbar', 'aria-label': 'Loading' }, bar),
      status,
      startBtn,
      h('label', { class: 'boot__sound' }, soundToggle, h('span', { class: 'toggle__ui' }), h('span', null, 'Sound (waves, chimes & chill)')),
      h('p', { class: 'boot__tip' }, TIPS[Math.floor(Math.random() * TIPS.length)]),
    ),
  );
  document.body.appendChild(boot);
  document.querySelector('.prepaint')?.remove();
  document.documentElement.classList.add('is-booting');

  let shown = 0;
  let target = 0.06;
  const animateBar = () => {
    shown += (target - shown) * 0.08;
    bar.style.transform = `scaleX(${shown})`;
    if (shown < 0.999) requestAnimationFrame(animateBar);
  };
  requestAnimationFrame(animateBar);
  let si = 0;
  const statusTimer = setInterval(() => (status.textContent = STATUS[++si % STATUS.length]), 650);

  /* ── Build the page behind the boot screen ── */
  mountSkyBackground();
  mountHud();
  const main = h('main', { id: 'main' });
  document.body.appendChild(main);
  const hero = mountHero();
  main.append(hero.el, mountPlayer(), mountWall(), mountPass(), mountCollection(), mountArcade(), mountLive(), mountFinale());
  observeReveals(main);
  target = 0.25;

  const t0 = performance.now();
  const steps = [
    document.fonts.ready.then(() => (target = Math.max(target, 0.45))),
    app.init().then(() => (target = Math.max(target, 0.7))),
    hero.prepare().then(() => (target = Math.max(target, 0.9))),
  ];
  await Promise.allSettled(steps);
  await sleep(Math.max(0, (prefersReducedMotion() ? 300 : 1500) - (performance.now() - t0)));
  target = 1;
  clearInterval(statusTimer);
  status.textContent = `${app.approvedCount} messages baked · ready`;
  startBtn.removeAttribute('disabled');
  startBtn.classList.add('is-ready');
  startBtn.focus({ preventScroll: true });
  void mountCursor();

  const begin = () => {
    if (boot.classList.contains('is-leaving')) return;
    if (soundToggle.checked !== sound.enabled) sound.toggle(soundToggle.checked);
    sound.unlock();
    sound.click();
    boot.classList.add('is-leaving');
    document.documentElement.classList.remove('is-booting');
    setTimeout(() => boot.remove(), 1200);
    void hero.play().then(() => {
      progress.unlock('drop-in');
      const hour = new Date().getHours();
      if (hour < 4) progress.unlock('night-owl');
      handleDeepLink();
    });
  };
  startBtn.addEventListener('click', begin);
  boot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!startBtn.disabled) begin();
    }
  });

  /* ── Konami code → Golden Hour ── */
  const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let pos = 0;
  addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = key === code[pos] ? pos + 1 : key === code[0] ? 1 : 0;
    if (pos === code.length) {
      pos = 0;
      document.documentElement.classList.add('golden-hour');
      rain(5, ['#ffe45e', '#ffd38a', '#fff1a6', '#ffffff', '#f6bb2a']);
      sound.levelUp();
      toast('✨ Golden Hour activated ✨', { life: 4000 });
      progress.unlock('konami');
      setTimeout(() => document.documentElement.classList.remove('golden-hour'), 14000);
    }
  });
}

function handleDeepLink() {
  const m = location.hash.match(/^#card=(.+)$/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const list = app.messages.filter((x) => !x.pending);
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return;
  document.getElementById('wall')?.scrollIntoView();
  import('./components/inspect').then(({ openInspect }) => openInspect(list, idx));
}
