/* Achievement pop-ups + quick toasts. */
import { h } from '../lib/dom';
import { stickerSVG } from './art';
import { crystalSVG, crystalById, type CrystalId } from './crystals';
import type { Achievement } from '../lib/progress';
import { sound } from '../lib/sound';

let root: HTMLElement | null = null;
const queue: (() => HTMLElement)[] = [];
let active = 0;
const MAX = 2;

function ensureRoot() {
  if (!root) {
    root = h('div', { class: 'toasts', 'aria-live': 'polite', role: 'status' });
    document.body.appendChild(root);
  }
  return root;
}

function pump() {
  while (active < MAX && queue.length) {
    const make = queue.shift()!;
    const el = make();
    active++;
    ensureRoot().appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    const life = Number(el.dataset.life ?? 4200);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => {
        el.remove();
        active--;
        pump();
      }, 450);
    }, life);
  }
}

export function achievementToast(a: Achievement) {
  queue.push(() => {
    sound.achievement();
    return h(
      'div',
      { class: 'toast toast--achievement', dataset: { life: '4800' } },
      h('div', { class: 'toast__icon', html: stickerSVG(a.icon, 44) }),
      h(
        'div',
        { class: 'toast__text' },
        h('span', { class: 'toast__kicker' }, 'Achievement unlocked'),
        h('strong', null, a.title),
        h('span', { class: 'toast__desc' }, a.desc),
      ),
      h('div', { class: 'toast__xp' }, `+${a.xp} XP`),
    );
  });
  pump();
}

export function crystalToast(id: CrystalId) {
  const c = crystalById(id)!;
  queue.push(() =>
    h(
      'div',
      { class: 'toast toast--crystal', dataset: { life: '5200' }, style: { '--glow': c.color[3] } },
      h('div', { class: 'toast__icon', html: crystalSVG(id, 52) }),
      h(
        'div',
        { class: 'toast__text' },
        h('span', { class: 'toast__kicker' }, 'Crystal found'),
        h('strong', null, c.name),
        h('span', { class: 'toast__desc' }, c.line),
      ),
    ),
  );
  pump();
}

export function levelToast(level: number, name: string) {
  queue.push(() => {
    sound.levelUp();
    return h(
      'div',
      { class: 'toast toast--level', dataset: { life: '4200' } },
      h('div', { class: 'toast__lvl' }, h('small', null, 'LV'), String(level)),
      h(
        'div',
        { class: 'toast__text' },
        h('span', { class: 'toast__kicker' }, 'Rank up!'),
        h('strong', null, name),
        h('span', { class: 'toast__desc' }, 'Your donut just got fancier.'),
      ),
    );
  });
  pump();
}

export function toast(text: string, opts: { icon?: string; life?: number; kind?: string } = {}) {
  queue.push(() =>
    h(
      'div',
      { class: `toast toast--info ${opts.kind ? 'toast--' + opts.kind : ''}`, dataset: { life: String(opts.life ?? 3200) } },
      opts.icon ? h('div', { class: 'toast__icon toast__icon--sm', html: opts.icon }) : null,
      h('div', { class: 'toast__text' }, h('strong', null, text)),
    ),
  );
  pump();
}
