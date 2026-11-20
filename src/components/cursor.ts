/* A donut cursor (hardware-rendered, zero lag) + a soft sprinkle trail. */
import { donutSVG, SPRINKLE_COLORS } from './art';
import { isFinePointer, prefersReducedMotion } from '../lib/dom';

export async function mountCursor() {
  if (!isFinePointer()) return;
  try {
    const make = async (flavor: 'strawberry' | 'holo', size: number) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(donutSVG('cursor', { flavor, size }));
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d')!.drawImage(img, 0, 0, size, size);
      return c.toDataURL('image/png');
    };
    const [base, hover] = await Promise.all([make('strawberry', 28), make('holo', 32)]);
    document.documentElement.style.setProperty('--cursor', `url(${base}) 14 14, auto`);
    document.documentElement.style.setProperty('--cursor-hover', `url(${hover}) 16 16, pointer`);
    document.documentElement.classList.add('has-donut-cursor');
  } catch {
    /* keep the system cursor */
  }

  if (prefersReducedMotion()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'trail-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);
  type P = { x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string; life: number };
  const parts: P[] = [];
  let lx = 0;
  let ly = 0;
  let running = false;
  addEventListener(
    'pointermove',
    (e) => {
      const d = Math.hypot(e.clientX - lx, e.clientY - ly);
      if (d > 14) {
        lx = e.clientX;
        ly = e.clientY;
        parts.push({
          x: e.clientX,
          y: e.clientY,
          vx: (Math.random() - 0.5) * 1.2,
          vy: Math.random() * 0.6,
          r: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.2,
          c: SPRINKLE_COLORS[Math.floor(Math.random() * SPRINKLE_COLORS.length)],
          life: 1,
        });
        if (parts.length > 60) parts.shift();
        if (!running) {
          running = true;
          requestAnimationFrame(tick);
        }
      }
    },
    { passive: true },
  );
  function tick() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= 0.022;
      if (p.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      p.vy += 0.08;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = p.life * 0.9;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.roundRect(-4.5, -1.5, 9, 3, 1.5);
      ctx.fill();
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(tick);
    else {
      running = false;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }
}
