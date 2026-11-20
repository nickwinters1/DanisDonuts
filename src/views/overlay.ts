/* OBS OVERLAY — add as a Browser Source (transparent). Cycles messages; new ones jump the queue.
 * Options:  #/overlay?every=25&pos=bl&scale=1   (pos: bl | br | tl | tr) */
import { h, clamp } from '../lib/dom';
import { app } from '../state';
import { renderCard } from '../components/card';
import { shuffle } from '../lib/rand';
import type { Message } from '../data/types';

export async function mountOverlay() {
  document.documentElement.classList.add('view-overlay');
  document.querySelector('.prepaint')?.remove();
  const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
  const every = clamp(Number(params.get('every') ?? 25), 6, 600) * 1000;
  const pos = (params.get('pos') ?? 'bl').replace(/[^a-z]/g, '');
  const scale = clamp(Number(params.get('scale') ?? 1), 0.4, 3);
  const root = h('div', { class: `overlay overlay--${pos}`, style: { '--scale': String(scale) } });
  document.body.appendChild(root);

  await app.init();
  let pool: Message[] = shuffle(app.messages.filter((m) => !m.pending));
  const urgent: Message[] = [];
  let i = 0;

  const showOne = (m: Message, fresh = false) => {
    const card = renderCard(m, 'mini');
    const wrap = h('div', { class: 'overlay__item' }, fresh ? h('span', { class: 'overlay__badge' }, 'New message for Dani!') : null, card);
    root.replaceChildren(wrap);
    requestAnimationFrame(() => wrap.classList.add('is-in'));
    const stay = clamp(6000 + m.body.length * 40, 8000, Math.min(every - 1500, 20000));
    setTimeout(() => wrap.classList.add('is-out'), stay);
  };

  const cycle = () => {
    const nextUrgent = urgent.shift();
    if (nextUrgent) showOne(nextUrgent, true);
    else if (pool.length) {
      showOne(pool[i % pool.length]);
      i++;
      if (i % pool.length === 0) pool = shuffle(pool);
    }
  };
  app.events.on('added', (m) => {
    if (m.pending) return;
    pool.push(m);
    urgent.push(m);
  });
  app.events.on('removed', (id) => (pool = pool.filter((m) => m.id !== id)));
  cycle();
  setInterval(cycle, every);
}
