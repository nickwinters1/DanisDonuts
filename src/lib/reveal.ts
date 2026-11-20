/* Scroll reveals: anything with [data-reveal] eases in when it enters the viewport. */
let io: IntersectionObserver | null = null;

export function observeReveals(root: ParentNode = document) {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io!.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
  }
  root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io!.observe(el));
}

/** Split a heading into per-character spans for staggered animation (keeps it readable to screen readers). */
export function splitChars(el: HTMLElement) {
  const text = el.textContent ?? '';
  el.setAttribute('aria-label', text);
  el.textContent = '';
  [...text].forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'char';
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', String(i));
    s.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(s);
  });
  return el;
}
