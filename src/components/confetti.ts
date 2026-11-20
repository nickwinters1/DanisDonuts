/* Sprinkle confetti + fireworks on one shared full-screen canvas. */
import { prefersReducedMotion } from '../lib/dom';
import { SPRINKLE_COLORS } from './art';

type Shape = 'sprinkle' | 'star' | 'heart' | 'dot' | 'spark';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: Shape;
  life: number;
  max: number;
  gravity: number;
  drag: number;
  wobble: number;
  trail?: boolean;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let running = false;
let dpr = 1;

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = innerWidth * dpr;
    canvas!.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);
}

function loop() {
  if (!ctx || !canvas) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.life < p.max);
  for (const p of particles) {
    p.life++;
    p.vx *= p.drag;
    p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx + Math.sin(p.life * 0.1 + p.wobble) * 0.4;
    p.y += p.vy;
    p.rot += p.vr;
    const fade = Math.min(1, (p.max - p.life) / 30);
    ctx.globalAlpha = fade;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    switch (p.shape) {
      case 'sprinkle': {
        const w = p.size * 2.4;
        const hgt = p.size * 0.8;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -hgt / 2, w, hgt, hgt / 2);
        ctx.fill();
        break;
      }
      case 'star': {
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.15, -s * 0.15, s, 0);
        ctx.quadraticCurveTo(s * 0.15, s * 0.15, 0, s);
        ctx.quadraticCurveTo(-s * 0.15, s * 0.15, -s, 0);
        ctx.quadraticCurveTo(-s * 0.15, -s * 0.15, 0, -s);
        ctx.fill();
        break;
      }
      case 'heart': {
        const s = p.size / 10;
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.bezierCurveTo(-6, 2, -9, -2, -6, -5);
        ctx.bezierCurveTo(-4, -7, -1, -6, 0, -3);
        ctx.bezierCurveTo(1, -6, 4, -7, 6, -5);
        ctx.bezierCurveTo(9, -2, 6, 2, 0, 6);
        ctx.fill();
        break;
      }
      case 'spark': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = fade * 0.25;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default: {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (particles.length) requestAnimationFrame(loop);
  else {
    running = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

function start() {
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

export interface BurstOptions {
  count?: number;
  shapes?: Shape[];
  colors?: string[];
  spread?: number; // radians
  angle?: number; // radians, direction of the burst (−π/2 = up)
  power?: number;
  gravity?: number;
}

export function burst(x: number, y: number, opts: BurstOptions = {}) {
  ensure();
  const reduce = prefersReducedMotion();
  const count = Math.round((opts.count ?? 80) * (reduce ? 0.25 : 1));
  const colors = opts.colors ?? SPRINKLE_COLORS;
  const shapes = opts.shapes ?? ['sprinkle', 'sprinkle', 'sprinkle', 'star', 'heart', 'dot'];
  const spread = opts.spread ?? Math.PI * 2;
  const angle = opts.angle ?? -Math.PI / 2;
  const power = opts.power ?? 11;
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread;
    const v = power * (0.35 + Math.random() * 0.75);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      size: 4 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      life: 0,
      max: 90 + Math.random() * 70,
      gravity: opts.gravity ?? 0.32,
      drag: 0.965,
      wobble: Math.random() * 10,
    });
  }
  start();
}

export function burstFrom(el: Element, opts: BurstOptions = {}) {
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

/** Sprinkles raining from the top of the screen. */
export function rain(seconds = 3, colors = SPRINKLE_COLORS) {
  ensure();
  if (prefersReducedMotion()) return;
  const end = performance.now() + seconds * 1000;
  const tick = () => {
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: Math.random() * innerWidth,
        y: -20,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        size: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() < 0.8 ? 'sprinkle' : 'heart',
        life: 0,
        max: 260,
        gravity: 0.05,
        drag: 0.995,
        wobble: Math.random() * 10,
      });
    }
    start();
    if (performance.now() < end) requestAnimationFrame(tick);
  };
  tick();
}

/** Fireworks in sprinkle colors. */
export function fireworks(seconds = 5) {
  ensure();
  if (prefersReducedMotion()) {
    burst(innerWidth / 2, innerHeight / 2, { count: 60 });
    return;
  }
  const end = performance.now() + seconds * 1000;
  const shell = () => {
    const x = innerWidth * (0.15 + Math.random() * 0.7);
    const y = innerHeight * (0.12 + Math.random() * 0.35);
    const color = SPRINKLE_COLORS[Math.floor(Math.random() * SPRINKLE_COLORS.length)];
    const count = 70;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const v = 4 + Math.random() * 3.5;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        rot: 0,
        vr: 0,
        size: 1.6 + Math.random() * 1.4,
        color: Math.random() < 0.15 ? '#ffffff' : color,
        shape: 'spark',
        life: 0,
        max: 70 + Math.random() * 40,
        gravity: 0.06,
        drag: 0.955,
        wobble: 0,
      });
    }
    burst(x, y, { count: 18, power: 6, gravity: 0.12 });
    start();
    if (performance.now() < end) setTimeout(shell, 280 + Math.random() * 420);
  };
  shell();
}
