/* Hidden crystals scattered through the page. Find all seven → unlock the Donut Heart. */
import { h } from '../lib/dom';
import { crystalSVG, crystalById, type CrystalId } from './crystals';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { burstFrom } from './confetti';
import { crystalToast } from './toast';

export function hiddenCrystal(id: CrystalId, className = ''): HTMLElement {
  const c = crystalById(id)!;
  const btn = h('button', {
    class: `hidden-crystal ${className}${progress.data.crystals.includes(id) ? ' is-found' : ''}`,
    type: 'button',
    'aria-label': progress.data.crystals.includes(id) ? `${c.name} (collected)` : 'Something sparkly…',
    style: { '--glow': c.color[3] },
    html: crystalSVG(id, 34),
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    collectCrystal(id, btn);
  });
  return btn;
}

export function collectCrystal(id: CrystalId, from?: Element | null) {
  const c = crystalById(id)!;
  if (from) burstFrom(from, { count: 40, colors: [c.color[0], c.color[1], c.color[3], '#ffffff'], shapes: ['star', 'star', 'dot'], power: 7 });
  if (!progress.collectCrystal(id)) {
    sound.pop();
    return false;
  }
  sound.crystal();
  crystalToast(id);
  document.querySelectorAll(`.hidden-crystal`).forEach((el) => {
    if ((el as HTMLElement).innerHTML.includes(`crystal--${id}`)) el.classList.add('is-found');
  });
  // Fly a little crystal up to the HUD counter.
  const target = document.querySelector('.hud__crystals');
  if (from && target) {
    const a = from.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const fly = h('div', { class: 'crystal-fly', html: crystalSVG(id, 40) });
    fly.style.left = `${a.left + a.width / 2 - 20}px`;
    fly.style.top = `${a.top + a.height / 2 - 20}px`;
    document.body.appendChild(fly);
    fly.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${(b.left - a.left) * 0.5}px, ${(b.top - a.top) * 0.5 - 80}px) scale(1.6)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(.4)`, opacity: 0.2 },
      ],
      { duration: 1100, easing: 'cubic-bezier(.5,0,.3,1)' },
    ).onfinish = () => fly.remove();
  }
  return true;
}
