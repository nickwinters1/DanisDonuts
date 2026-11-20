/* 02 · PLAYER ONE — a character-select profile, with love. */
import { h } from '../lib/dom';
import { config } from '../config';
import { donutSVG, stickerSVG } from '../components/art';
import { sectionHead } from '../components/sectionHead';
import { hiddenCrystal } from '../components/hidden';
import { attachTilt } from '../components/card';
import { sound } from '../lib/sound';

const LOADOUT = [
  { icon: 'donut', name: 'Donut', rarity: 'legendary', desc: 'Restores 100% happiness. Cannot be shared (she will share anyway).' },
  { icon: 'crystal', name: 'Crystal', rarity: 'epic', desc: '+50 Good Vibes. Collection size: yes.' },
  { icon: 'controller', name: 'Controller', rarity: 'epic', desc: 'Clutch +25. Also used for victory dances.' },
  { icon: 'sun', name: 'Florida Sun', rarity: 'rare', desc: 'Permanent buff. Never expires. Slight sunburn risk.' },
  { icon: 'shell', name: 'Seashell', rarity: 'uncommon', desc: 'Found on a Florida beach. Smells like vacation.' },
  { icon: 'heart', name: 'Her Donuts', rarity: 'mythic', desc: 'The community. Infinite stack. Bound to account.' },
] as const;

export function mountPlayer() {
  const photo = config.streamer.photo;
  const portrait = h(
    'div',
    { class: 'player__card', 'data-reveal': '' },
    h(
      'div',
      { class: 'player__frame' },
      photo
        ? h('img', { class: 'player__photo', src: photo, alt: config.streamer.name, loading: 'lazy' })
        : h('div', { class: 'player__donut', html: donutSVG('HeyDani', { flavor: 'holo', size: 320 }) }),
      h('div', { class: 'player__holo', 'aria-hidden': 'true' }),
      h('span', { class: 'player__badge' }, 'P1'),
    ),
    h(
      'div',
      { class: 'player__plate' },
      h('p', { class: 'player__tag' }, config.profile.gamertag),
      h('p', { class: 'player__class' }, `${config.profile.title} · ${config.streamer.homeBase}`),
    ),
  );
  attachTilt(portrait, 8);

  const stats = h(
    'div',
    { class: 'stats' },
    config.profile.stats.map((s, i) =>
      h(
        'div',
        { class: `statbar${s.value > 100 ? ' is-over' : ''}`, style: { '--v': String(Math.min(s.value, 100)), '--i': String(i) } },
        h('span', { class: 'statbar__label' }, s.label),
        h('span', { class: 'statbar__track' }, h('span', { class: 'statbar__fill' })),
        h('span', { class: 'statbar__val' }, s.value > 100 ? `${s.value}!!` : String(s.value)),
      ),
    ),
  );

  const loadout = h(
    'ul',
    { class: 'loadout', 'aria-label': 'Loadout' },
    LOADOUT.map((item) =>
      h(
        'li',
        { class: `slot rarity-${item.rarity}`, tabindex: '0', onmouseenter: () => sound.hover() },
        h('span', { class: 'slot__icon', html: stickerSVG(item.icon, 54) }),
        h('span', { class: 'slot__tip', role: 'tooltip' }, h('strong', null, item.name), h('em', null, item.rarity), h('span', null, item.desc)),
      ),
    ),
    h('li', { class: 'slot slot--secret rarity-common' }, hiddenCrystal('clear', 'player__crystal')),
  );

  const facts = h(
    'dl',
    { class: 'facts' },
    [
      ['Player', `${config.streamer.name} (aka ${config.streamer.handle})`],
      ['Guild', config.profile.guild],
      ['Home base', config.streamer.homeBase],
      ['Mains', config.profile.mains.join(' · ')],
      ['Loves', config.profile.loves.join(' · ')],
    ].map(([k, v]) => h('div', { class: 'fact' }, h('dt', null, k), h('dd', null, v))),
  );

  return h(
    'section',
    { id: 'player', class: 'section player' },
    sectionHead(2, 'Player one', h('span', null, 'Meet the ', h('span', { class: 'holo-text' }, 'main character')), `Every lobby needs a legend. Ours happens to live on a Florida beach.`),
    h(
      'div',
      { class: 'player__grid' },
      portrait,
      h(
        'div',
        { class: 'player__panel glass', 'data-reveal': '' },
        h('p', { class: 'hud-label' }, 'Player profile'),
        facts,
        h('p', { class: 'hud-label' }, 'Stats'),
        stats,
        h('p', { class: 'hud-label' }, 'Loadout'),
        loadout,
        h('div', { class: 'player__special' }, h('span', { class: 'hud-label' }, 'Special ability'), h('p', null, config.profile.special)),
      ),
    ),
  );
}
