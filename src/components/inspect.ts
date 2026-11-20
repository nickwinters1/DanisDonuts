/* Card Inspector: the "pulled a rare card" moment. Big holo, flip, hearts, export, deep links. */
import { h, isFinePointer } from '../lib/dom';
import type { Message } from '../data/types';
import { renderCard, renderCardBack, attachTilt, attachGyro, heartMessage } from './card';
import { openModal } from './modal';
import { icon } from './icons';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { downloadCard } from './cardExport';
import { toast } from './toast';

export function openInspect(list: Message[], startIndex: number) {
  if (!list.length) return;
  let index = Math.max(0, Math.min(startIndex, list.length - 1));
  let flipped = false;
  let cleanup: (() => void)[] = [];

  const stage = h('div', { class: 'inspect__stage' });
  const counter = h('span', { class: 'inspect__count' });
  const heartBtn = h('button', { class: 'pill-btn', type: 'button', html: `${icon('heart', 18)}<span>Heart</span>` });
  const flipBtn = h('button', { class: 'pill-btn', type: 'button', html: `${icon('flip', 18)}<span>Flip</span>` });
  const dlBtn = h('button', { class: 'pill-btn', type: 'button', html: `${icon('download', 18)}<span>Save card</span>` });
  const linkBtn = h('button', { class: 'pill-btn', type: 'button', html: `${icon('link', 18)}<span>Copy link</span>` });
  const prev = h('button', { class: 'inspect__nav inspect__nav--prev', type: 'button', 'aria-label': 'Previous card', html: icon('left', 28) });
  const next = h('button', { class: 'inspect__nav inspect__nav--next', type: 'button', 'aria-label': 'Next card', html: icon('right', 28) });

  const gyroBtn =
    !isFinePointer() && typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function'
      ? h('button', { class: 'pill-btn', type: 'button', html: `${icon('sparkle', 18)}<span>Tilt to shine</span>` })
      : null;

  const content = h(
    'div',
    { class: 'inspect' },
    prev,
    stage,
    next,
    h('div', { class: 'inspect__bar' }, heartBtn, flipBtn, dlBtn, linkBtn, gyroBtn, counter),
  );

  const render = (dir = 0) => {
    cleanup.forEach((fn) => fn());
    cleanup = [];
    const m = list[index];
    flipped = false;
    const front = renderCard(m, 'inspect');
    const back = renderCardBack(m);
    const flipper = h('div', { class: 'flip' }, h('div', { class: 'flip__face flip__face--front' }, front), h('div', { class: 'flip__face flip__face--back' }, back));
    const wrap = h('div', { class: `inspect__card ${dir ? (dir > 0 ? 'from-right' : 'from-left') : 'from-pack'}` }, flipper);
    stage.replaceChildren(wrap);
    cleanup.push(attachTilt(front, 16), attachTilt(back, 16));
    if (!gyroBtn) cleanup.push(attachGyro(front));
    counter.textContent = `${index + 1} / ${list.length}`;
    prev.toggleAttribute('disabled', list.length < 2);
    next.toggleAttribute('disabled', list.length < 2);
    const hearted = progress.data.hearted.includes(m.id);
    heartBtn.classList.toggle('is-on', hearted);
    heartBtn.querySelector('span')!.textContent = hearted ? 'Loved' : 'Heart';
    heartBtn.toggleAttribute('disabled', !!m.pending);
    if (!m.pending && !m.sample) history.replaceState(null, '', `#card=${encodeURIComponent(m.id)}`);
    if (!m.pending) progress.markRead(m.id);
    modal.el.setAttribute('aria-label', `Message from ${m.name}`);
  };

  const go = (d: number) => {
    if (list.length < 2) return;
    index = (index + d + list.length) % list.length;
    sound.whoosh();
    render(d);
  };

  const flip = () => {
    flipped = !flipped;
    stage.querySelector('.flip')?.classList.toggle('is-flipped', flipped);
    sound.whoosh();
  };

  const modal = openModal(content, {
    label: 'Card inspector',
    className: 'modal--inspect',
    onClose: () => {
      cleanup.forEach((fn) => fn());
      if (location.hash.startsWith('#card=')) history.replaceState(null, '', '#wall');
    },
    onKey: (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key.toLowerCase() === 'f') flip();
      else if (e.key.toLowerCase() === 'h') heartMessage(list[index], heartBtn);
    },
  });

  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  flipBtn.addEventListener('click', flip);
  stage.addEventListener('dblclick', flip);
  heartBtn.addEventListener('click', () => {
    heartMessage(list[index], heartBtn);
    heartBtn.classList.add('is-on');
    heartBtn.querySelector('span')!.textContent = 'Loved';
  });
  dlBtn.addEventListener('click', async () => {
    dlBtn.setAttribute('disabled', '');
    try {
      await downloadCard(list[index]);
      toast('Card saved — go show it off ✨');
    } catch {
      toast('Could not export that card, sorry!');
    }
    dlBtn.removeAttribute('disabled');
  });
  linkBtn.addEventListener('click', async () => {
    const m = list[index];
    const url = `${location.origin}${location.pathname}#card=${encodeURIComponent(m.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied 🔗');
    } catch {
      toast(url);
    }
  });
  gyroBtn?.addEventListener('click', async () => {
    try {
      const res = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      if (res === 'granted') {
        const front = stage.querySelector<HTMLElement>('.flip__face--front .dcard');
        if (front) cleanup.push(attachGyro(front));
        gyroBtn.remove();
      }
    } catch {
      /* ignore */
    }
  });

  // Swipe on touch
  let sx = 0;
  stage.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  });

  sound.whoosh();
  render();
  return modal;
}
