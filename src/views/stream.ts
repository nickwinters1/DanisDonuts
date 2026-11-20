/* STREAM MODE — a full-screen, chat-readable slideshow for the big reveal on stream. */
import { h, clamp, sleep } from '../lib/dom';
import { config } from '../config';
import { app } from '../state';
import { renderCard } from '../components/card';
import { donutSVG } from '../components/art';
import { icon } from '../components/icons';
import { shuffle } from '../lib/rand';
import { sound } from '../lib/sound';
import { fireworks } from '../components/confetti';
import type { Message } from '../data/types';
import { progress } from '../lib/progress';

export async function mountStream() {
  document.documentElement.classList.add('view-stream');
  document.querySelector('.prepaint')?.remove();
  document.title = `Stream Mode · ${config.streamer.community}`;
  progress.unlock('presenter');

  const bg = h('div', { class: 'stage__bg', 'aria-hidden': 'true' }, h('i', { class: 'blob blob--a' }), h('i', { class: 'blob blob--b' }), h('i', { class: 'blob blob--c' }));
  for (let i = 0; i < 9; i++) {
    bg.appendChild(h('span', { class: 'stage__floater', style: { '--i': String(i), '--x': `${(i * 113) % 100}%` }, html: donutSVG(`float-${i}`, { size: 60 + (i % 3) * 24 }) }));
  }
  const counter = h('span', { class: 'stage__count' }, '');
  const slot = h('div', { class: 'stage__slot' });
  const progressBar = h('div', { class: 'stage__progress' }, h('span'));
  const playBtn = h('button', { class: 'stage__btn', type: 'button', 'aria-label': 'Pause' });
  const prevBtn = h('button', { class: 'stage__btn', type: 'button', 'aria-label': 'Previous', html: icon('left', 22) });
  const nextBtn = h('button', { class: 'stage__btn', type: 'button', 'aria-label': 'Next', html: icon('right', 22) });
  const shuffleBtn = h('button', { class: 'stage__btn', type: 'button', 'aria-label': 'Shuffle', html: icon('shuffle', 20) });
  const fsBtn = h('button', { class: 'stage__btn', type: 'button', 'aria-label': 'Fullscreen', html: icon('fullscreen', 20) });
  const exitBtn = h('a', { class: 'stage__btn', href: '#', 'aria-label': 'Exit Stream Mode', html: icon('close', 20) });
  const site = config.siteUrl ? config.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : location.host + location.pathname.replace(/\/$/, '');

  const stage = h(
    'div',
    { class: 'stage' },
    bg,
    h(
      'header',
      { class: 'stage__top' },
      h('div', { class: 'stage__brand' }, h('span', { html: donutSVG('HeyDani', { flavor: 'strawberry', size: 44 }) }), h('span', null, h('b', null, config.streamer.community), h('small', null, `Messages for ${config.streamer.name}`))),
      counter,
      h('div', { class: 'stage__controls' }, prevBtn, playBtn, nextBtn, shuffleBtn, fsBtn, exitBtn),
    ),
    slot,
    h('footer', { class: 'stage__bottom' }, progressBar, h('p', { class: 'stage__cta' }, 'Leave yours at ', h('b', null, site)), h('p', { class: 'stage__keys' }, '← → browse · Space pause · S shuffle · F fullscreen · H hide controls')),
  );
  document.body.appendChild(stage);

  await app.init();
  let queue: Message[] = app.messages.filter((m) => !m.pending).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let index = -1;
  let playing = true;
  let started = false;
  let slideStart = 0;
  let slideDur = 10000;
  let elapsedBeforePause = 0;
  let raf = 0;

  const setPlayIcon = () => {
    playBtn.innerHTML = icon(playing ? 'pause' : 'play', 22);
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };
  setPlayIcon();

  const intro = () => {
    slot.replaceChildren(
      h(
        'div',
        { class: 'stage__intro' },
        h('div', { class: 'stage__intro-donut', html: donutSVG('HeyDani', { flavor: 'holo', size: 220 }) }),
        h('p', { class: 'hud-label' }, `${queue.length} messages`),
        h('h1', { class: 'stage__title' }, `${config.occasion.kicker}, `, h('span', { class: 'holo-text' }, config.streamer.name)),
        h('p', { class: 'stage__sub' }, `From every single one of your Donuts.`),
        h('p', { class: 'stage__press' }, queue.length ? 'Press Space to begin' : 'No messages yet — they will appear here live.'),
      ),
    );
    counter.textContent = '';
  };

  const outro = () => {
    slot.replaceChildren(
      h(
        'div',
        { class: 'stage__intro stage__intro--end' },
        h('p', { class: 'hud-label' }, 'That’s everyone… for now'),
        h('h1', { class: 'stage__title' }, 'We love you, ', h('span', { class: 'holo-text' }, config.streamer.name)),
        h('p', { class: 'stage__sub' }, `— ${config.streamer.community} 💗`),
      ),
    );
    fireworks(5);
    slideStart = performance.now();
    slideDur = 12000;
    index = queue.length; // next() wraps to the start
  };

  const show = async (i: number, dir = 1) => {
    if (!queue.length) return intro();
    index = (i + queue.length) % queue.length;
    const m = queue[index];
    const old = slot.firstElementChild as HTMLElement | null;
    if (old) {
      old.classList.add(dir > 0 ? 'is-leaving' : 'is-leaving-back');
      await sleep(380);
    }
    const card = renderCard(m, 'stream');
    if (m.mediaUrl) card.classList.add('has-media');
    const wrap = h('div', { class: `stage__card ${dir > 0 ? 'is-entering' : 'is-entering-back'}` }, card);
    if ((m as Message & { fresh?: boolean }).fresh) wrap.appendChild(h('span', { class: 'stage__new' }, 'Just in!'));
    slot.replaceChildren(wrap);
    counter.textContent = `${index + 1} / ${queue.length}`;
    slideStart = performance.now();
    elapsedBeforePause = 0;
    slideDur = clamp(7000 + m.body.length * 42, 8000, 24000);
    sound.whoosh();
  };

  const next = () => {
    if (!started) return begin();
    if (index >= queue.length - 1) outro();
    else void show(index + 1, 1);
  };
  const prev = () => started && void show(index - 1, -1);

  const begin = () => {
    if (started || !queue.length) return;
    started = true;
    sound.unlock();
    void show(0, 1);
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!started) return;
    const t = playing ? elapsedBeforePause + (now - slideStart) : elapsedBeforePause;
    const p = clamp(t / slideDur, 0, 1);
    (progressBar.firstElementChild as HTMLElement).style.transform = `scaleX(${p})`;
    if (playing && p >= 1) next();
  };
  raf = requestAnimationFrame(tick);
  void raf;

  const togglePlay = () => {
    if (!started) return begin();
    if (playing) elapsedBeforePause += performance.now() - slideStart;
    else slideStart = performance.now();
    playing = !playing;
    setPlayIcon();
  };
  const doShuffle = () => {
    queue = shuffle(queue);
    if (started) void show(0, 1);
  };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());

  playBtn.addEventListener('click', togglePlay);
  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  shuffleBtn.addEventListener('click', doShuffle);
  fsBtn.addEventListener('click', () => void fullscreen());
  slot.addEventListener('click', () => (!started ? begin() : undefined));
  addEventListener('keydown', (e) => {
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 's') doShuffle();
    else if (e.key.toLowerCase() === 'f') void fullscreen();
    else if (e.key.toLowerCase() === 'h') stage.classList.toggle('hide-ui');
    else if (e.key === 'Escape' && !document.fullscreenElement) location.hash = '';
  });

  let idle = 0;
  addEventListener('pointermove', () => {
    stage.classList.add('show-cursor');
    clearTimeout(idle);
    idle = window.setTimeout(() => stage.classList.remove('show-cursor'), 2500);
  });

  app.events.on('added', (m) => {
    if (m.pending) return;
    const fresh = Object.assign(m, { fresh: true });
    if (!started) {
      queue.push(fresh);
      intro();
      return;
    }
    queue.splice(Math.min(index + 1, queue.length), 0, fresh);
    counter.textContent = `${index + 1} / ${queue.length}`;
  });
  app.events.on('removed', (id) => {
    queue = queue.filter((m) => m.id !== id);
  });

  intro();
}
