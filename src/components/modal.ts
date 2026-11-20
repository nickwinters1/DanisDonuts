/* Accessible modal shell: focus trap, Esc to close, scroll lock, focus restore. */
import { h } from '../lib/dom';
import { icon } from './icons';

export interface ModalHandle {
  el: HTMLElement;
  panel: HTMLElement;
  close: () => void;
}

let openCount = 0;

export function openModal(
  content: Node,
  opts: { label: string; className?: string; onClose?: () => void; onKey?: (e: KeyboardEvent) => void; closeButton?: boolean } ,
): ModalHandle {
  const previous = document.activeElement as HTMLElement | null;
  const panel = h('div', { class: 'modal__panel' }, content);
  const closeBtn =
    opts.closeButton === false
      ? null
      : h('button', { class: 'modal__close', type: 'button', 'aria-label': 'Close', html: icon('close', 22) });
  const el = h(
    'div',
    { class: `modal ${opts.className ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.label },
    h('div', { class: 'modal__backdrop' }),
    closeBtn,
    panel,
  );

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('is-closing');
    document.removeEventListener('keydown', onKey, true);
    openCount--;
    if (openCount <= 0) document.documentElement.classList.remove('modal-open');
    setTimeout(() => el.remove(), 320);
    opts.onClose?.();
    previous?.focus?.({ preventScroll: true });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(
        el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((x) => !x.hasAttribute('disabled') && x.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    opts.onKey?.(e);
  };

  el.querySelector('.modal__backdrop')!.addEventListener('click', close);
  closeBtn?.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(el);
  openCount++;
  document.documentElement.classList.add('modal-open');
  requestAnimationFrame(() => {
    el.classList.add('is-open');
    (closeBtn ?? panel.querySelector<HTMLElement>('button, input, textarea'))?.focus({ preventScroll: true });
  });
  return { el, panel, close };
}
