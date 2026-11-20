import { h } from '../lib/dom';

export function sectionHead(index: number, kicker: string, title: string | Node, sub?: string | Node, extra?: Node | null) {
  return h(
    'header',
    { class: 'shead', 'data-reveal': '' },
    h(
      'p',
      { class: 'shead__kicker' },
      h('span', { class: 'shead__idx' }, String(index).padStart(2, '0')),
      h('span', { class: 'shead__line', 'aria-hidden': 'true' }),
      kicker,
    ),
    h('h2', { class: 'shead__title' }, title),
    sub ? h('p', { class: 'shead__sub' }, sub) : null,
    extra ?? null,
  );
}
