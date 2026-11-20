/* 07 · LIVE — the stream, the socials, the merch. */
import { h, svgEl } from '../lib/dom';
import { siTwitch, siTiktok, siInstagram } from 'simple-icons';
import { config } from '../config';
import { sectionHead } from '../components/sectionHead';
import { hiddenCrystal } from '../components/hidden';
import { icon } from '../components/icons';
import { donutSVG, stickerSVG } from '../components/art';
import { sound } from '../lib/sound';

const brand = (path: string, size = 30) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${path}"/></svg>`;

const wave = (y: number, amp: number) =>
  `M0,${y} C240,${y - amp} 480,${y + amp} 720,${y} C960,${y - amp} 1200,${y + amp} 1440,${y} C1680,${y - amp} 1920,${y + amp} 2160,${y} C2400,${y - amp} 2640,${y + amp} 2880,${y} V140 H0 Z`;
const WAVES = `<svg class="live__waves" viewBox="0 0 1440 140" preserveAspectRatio="none" aria-hidden="true">
<g class="wave wave--1"><path d="${wave(52, 26)}" fill="rgba(125,249,255,.18)"/></g>
<g class="wave wave--2"><path d="${wave(70, 22)}" fill="rgba(61,224,208,.22)"/></g>
<g class="wave wave--3"><path d="${wave(92, 18)}" fill="rgba(255,217,160,.9)"/></g>
</svg>`;

export function mountLive() {
  const L = config.links;
  const player = h('div', { class: 'live__player' });
  const loadPlayer = () => {
    const host = location.hostname;
    if (!host) {
      window.open(L.twitch, '_blank', 'noopener');
      return;
    }
    sound.click();
    const src = `https://player.twitch.tv/?channel=${encodeURIComponent(L.twitchChannel)}&parent=${encodeURIComponent(host)}&autoplay=true&muted=false`;
    player.replaceChildren(h('iframe', { src, title: `${config.streamer.handle} on Twitch`, allowfullscreen: true, allow: 'autoplay; fullscreen', loading: 'lazy' }));
    player.classList.add('is-loaded');
  };
  player.append(
    h(
      'button',
      { class: 'live__poster', type: 'button', onclick: loadPlayer },
      h('span', { class: 'live__poster-donut', html: donutSVG('HeyDani', { flavor: 'strawberry', size: 160 }) }),
      h('span', { class: 'live__poster-play', html: icon('play', 30) }),
      h('span', { class: 'live__poster-text' }, h('b', null, `Load ${config.streamer.handle}’s stream`), h('small', null, 'Plays right here — if she’s live, you’re in.')),
    ),
  );

  const tile = (href: string, cls: string, iconHtml: string, label: string, handle: string, note: string) =>
    h(
      'a',
      { class: `link-tile ${cls}`, href, target: '_blank', rel: 'noopener', onmouseenter: () => sound.hover(), 'data-reveal': '' },
      h('span', { class: 'link-tile__icon', html: iconHtml }),
      h('span', { class: 'link-tile__text' }, h('b', null, label), h('span', null, handle), h('small', null, note)),
      h('span', { class: 'link-tile__arrow', html: icon('external', 20) }),
    );

  return h(
    'section',
    { id: 'live', class: 'section live' },
    sectionHead(7, 'Live', h('span', null, 'Catch her ', h('span', { class: 'holo-text' }, 'live')), 'Pull up a beach chair. The lobby’s always open.'),
    h(
      'div',
      { class: 'live__grid' },
      h('div', { class: 'live__screen glass', 'data-reveal': '' }, player),
      h(
        'div',
        { class: 'live__links' },
        tile(L.twitch, 'link-tile--twitch', brand(siTwitch.path), 'Twitch', `twitch.tv/${L.twitchChannel}`, 'Follow + turn on notifications'),
        tile(L.tiktok, 'link-tile--tiktok', brand(siTiktok.path), 'TikTok', L.tiktokHandle, 'Clips, chaos & beach days'),
        tile(L.instagram, 'link-tile--insta', brand(siInstagram.path), 'Instagram', L.instagramHandle, 'Life between streams'),
        tile(L.shop, 'link-tile--shop', stickerSVG('donut', 40), 'Merch shop', 'Official HeyDani merch', 'Wear the Donut life'),
      ),
    ),
    h('div', { class: 'live__shore' }, svgEl(WAVES), hiddenCrystal('aquamarine', 'live__aqua')),
  );
}
