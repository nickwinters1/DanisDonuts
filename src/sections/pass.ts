/* 04 · SEASON PASS — the Dani Era, one tier at a time. Scroll sideways; claim every reward. */
import { h, prefersReducedMotion, clamp } from '../lib/dom';
import { config } from '../config';
import { stickerSVG } from '../components/art';
import { sectionHead } from '../components/sectionHead';
import { hiddenCrystal } from '../components/hidden';
import { burstFrom } from '../components/confetti';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { icon } from '../components/icons';

const RARITY_LABEL: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

export function mountPass() {
  const tiers = config.seasonPass;
  const fill = h('span', { class: 'pass__fill' });
  const tierNow = h('b', null, String(tiers[0].tier));
  const claimedCount = h('b', null, '0');

  const items = tiers.map((t, i) => {
    const claimed = progress.data.claimed.includes(t.tier);
    const claim = h('button', {
      class: `tier__claim${claimed ? ' is-claimed' : ''}`,
      type: 'button',
      html: claimed ? `${icon('check', 16)} Claimed` : 'Claim reward',
    });
    claim.addEventListener('click', () => {
      if (!progress.claimTier(t.tier, tiers.length)) return;
      claim.classList.add('is-claimed');
      claim.innerHTML = `${icon('check', 16)} Claimed`;
      card.classList.add('is-claimed', 'is-claim-anim');
      burstFrom(claim, { count: 46, power: 9 });
      sound.success();
      updateClaimed();
    });
    const card = h(
      'div',
      { class: `tier__card${claimed ? ' is-claimed' : ''}` },
      h('div', { class: 'tier__art', html: stickerSVG(t.icon, t.rarity === 'mythic' ? 120 : 92) }),
      h('p', { class: 'tier__rarity' }, RARITY_LABEL[t.rarity] ?? t.rarity),
      h('h3', { class: 'tier__title' }, t.title),
      h('p', { class: 'tier__reward' }, h('small', null, 'Reward unlocked'), t.reward),
      t.date ? h('p', { class: 'tier__date' }, t.date) : null,
      claim,
      t.icon === 'crystal' ? hiddenCrystal('amethyst', 'tier__amethyst') : null,
    );
    return h(
      'li',
      { class: `tier rarity-${t.rarity}`, style: { '--i': String(i) }, dataset: { tier: String(t.tier) } },
      h('div', { class: 'tier__node' }, h('span', null, 'Tier'), h('b', null, String(t.tier))),
      card,
    );
  });

  const track = h('ol', { class: 'pass__tiers' }, items);
  const rail = h('div', { class: 'pass__rail', 'aria-hidden': 'true' }, fill);
  const viewport = h('div', { class: 'pass__viewport' }, h('div', { class: 'pass__track' }, rail, track));

  const el = h(
    'section',
    { id: 'pass', class: 'section pass' },
    h(
      'div',
      { class: 'pass__sticky' },
      sectionHead(
        4,
        'Season pass',
        h('span', null, 'The ', h('span', { class: 'holo-text' }, `${config.streamer.name} Era`)),
        'Every tier unlocked something for all of us. Scroll the track — and claim your rewards.',
        h(
          'div',
          { class: 'pass__status' },
          h('span', { class: 'pass__chip' }, 'Current tier ', tierNow),
          h('span', { class: 'pass__chip' }, 'Rewards claimed ', claimedCount, ` / ${tiers.length}`),
        ),
      ),
      viewport,
      h('p', { class: 'pass__hint', html: `Keep scrolling ${icon('right', 16)}` }),
    ),
  );

  const updateClaimed = () => (claimedCount.textContent = String(progress.data.claimed.length));
  updateClaimed();

  const pinned = () => !prefersReducedMotion() && innerWidth >= 760;
  let maxShift = 0;
  const measure = () => {
    if (!pinned()) {
      el.classList.remove('is-pinned');
      el.style.height = '';
      track.parentElement!.style.transform = '';
      return;
    }
    el.classList.add('is-pinned');
    const trackW = (track.parentElement as HTMLElement).scrollWidth;
    maxShift = Math.max(0, trackW - viewport.clientWidth);
    el.style.height = `${innerHeight + maxShift * 1.1}px`;
    onScroll();
  };

  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      let p: number;
      if (pinned()) {
        const top = el.getBoundingClientRect().top;
        const total = el.offsetHeight - innerHeight;
        p = clamp(-top / Math.max(1, total), 0, 1);
        (track.parentElement as HTMLElement).style.transform = `translate3d(${-p * maxShift}px,0,0)`;
      } else {
        p = clamp(viewport.scrollLeft / Math.max(1, viewport.scrollWidth - viewport.clientWidth), 0, 1);
      }
      fill.style.transform = `scaleX(${p})`;
      const idx = Math.min(tiers.length - 1, Math.floor(p * tiers.length * 0.999));
      tierNow.textContent = String(tiers[idx].tier);
      items.forEach((it, i) => it.classList.toggle('is-reached', i <= idx));
    });
  };

  addEventListener('scroll', onScroll, { passive: true });
  viewport.addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', measure);
  requestAnimationFrame(() => requestAnimationFrame(measure));
  document.fonts?.ready.then(measure);
  return el;
}
