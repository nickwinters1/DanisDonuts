/* 05 · COLLECTION — seven hidden crystals and the legendary Donut Heart. */
import { h } from '../lib/dom';
import { config } from '../config';
import { sectionHead } from '../components/sectionHead';
import { CRYSTALS, HEART_CRYSTAL, crystalSVG } from '../components/crystals';
import { donutSVG } from '../components/art';
import { openModal } from '../components/modal';
import { openLocker } from '../components/hud';
import { fireworks } from '../components/confetti';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { app } from '../state';

function openSecret() {
  sound.crystal();
  fireworks(4);
  const names = app.messages.filter((m) => !m.pending).map((m) => m.name);
  const content = h(
    'div',
    { class: 'secret' },
    h('div', { class: 'secret__gem', html: crystalSVG('heart', 180) }),
    h('p', { class: 'hud-label' }, 'Legendary unlocked'),
    h('h2', { class: 'secret__title' }, config.secretMessage.title),
    h('p', { class: 'secret__body' }, config.secretMessage.body),
    names.length ? h('p', { class: 'secret__names' }, h('span', { class: 'hud-label' }, 'Forged from messages by'), names.slice(0, 60).join(' · ') + (names.length > 60 ? ` · +${names.length - 60} more` : '')) : null,
  );
  openModal(content, { label: config.secretMessage.title, className: 'modal--secret' });
}

export function mountCollection() {
  const grid = h('ul', { class: 'codex__grid' });
  const legendary = h('button', { class: 'codex__legendary', type: 'button' });
  const found = h('b', null, '0');
  const rankName = h('strong');
  const rankLv = h('span', { class: 'codex__lv' });
  const xpFill = h('span');
  const xpText = h('small');
  const avatar = h('div', { class: 'codex__avatar' });

  const render = () => {
    const have = new Set(progress.data.crystals);
    const count = CRYSTALS.filter((c) => have.has(c.id)).length;
    found.textContent = String(count);
    grid.replaceChildren(
      ...CRYSTALS.map((c, i) => {
        const got = have.has(c.id);
        return h(
          'li',
          { class: `codex__slot${got ? ' is-found' : ''}`, style: { '--glow': c.color[3], '--i': String(i) }, 'data-reveal': '' },
          h('div', { class: 'codex__gem', html: crystalSVG(c.id, 96, got) }),
          h('h3', { class: 'codex__name' }, got ? c.name : '???'),
          h('p', { class: 'codex__meaning' }, got ? c.meaning : 'Undiscovered'),
          h('p', { class: 'codex__line' }, got ? c.line : c.hint),
          h('span', { class: 'codex__where' }, got ? `Found in ${c.where}` : `Hidden in ${c.where}`),
        );
      }),
    );
    const unlocked = count >= 7;
    legendary.classList.toggle('is-unlocked', unlocked);
    legendary.toggleAttribute('disabled', !unlocked);
    legendary.replaceChildren(
      h('div', { class: 'codex__legend-gem', html: crystalSVG('heart', 150, unlocked) }),
      h(
        'div',
        { class: 'codex__legend-text' },
        h('p', { class: 'hud-label' }, unlocked ? 'Legendary · tap to open' : 'Legendary · locked'),
        h('h3', null, unlocked ? HEART_CRYSTAL.name : 'The ??? Heart'),
        h('p', null, unlocked ? HEART_CRYSTAL.meaning : `Find all seven crystals to unlock a secret message. ${7 - count} to go.`),
      ),
    );
    const r = progress.rankFor();
    rankName.textContent = r.name;
    rankLv.textContent = `LV ${r.level}`;
    xpFill.style.width = `${Math.round(r.progress * 100)}%`;
    xpText.textContent = r.next ? `${progress.data.xp} XP · ${r.next.xp - progress.data.xp} XP to ${r.next.name}` : `${progress.data.xp} XP · Max rank`;
    avatar.innerHTML = donutSVG(progress.data.handle || progress.data.name || 'visitor', { size: 76 });
    requestAnimationFrame(() => grid.querySelectorAll('[data-reveal]').forEach((n) => n.classList.add('is-in')));
  };
  legendary.addEventListener('click', () => {
    if (progress.data.crystals.filter((c) => c !== 'heart').length >= 7) openSecret();
  });

  render();
  progress.events.on('change', render);

  return h(
    'section',
    { id: 'collection', class: 'section collection' },
    sectionHead(
      5,
      'Collection',
      h('span', null, 'Seven crystals are ', h('span', { class: 'holo-text' }, 'hidden on this page')),
      'Each one means something. Find all seven to unlock a legendary secret that only the most dedicated Donuts will ever see.',
      h('p', { class: 'codex__count' }, found, ' / 7 found'),
    ),
    h('div', { class: 'codex', 'data-reveal': '' }, grid, legendary),
    h(
      'div',
      { class: 'codex__rank glass', 'data-reveal': '' },
      avatar,
      h('div', { class: 'codex__rank-text' }, h('p', { class: 'hud-label' }, 'Your Donut rank'), h('p', { class: 'codex__rank-name' }, rankLv, ' ', rankName), h('div', { class: 'xpbar' }, xpFill), xpText),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => openLocker() }, 'Open your locker'),
    ),
  );
}
