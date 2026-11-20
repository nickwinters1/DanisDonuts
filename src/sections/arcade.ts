/* 06 · ARCADE — "Donut Drop: Beach Edition". Catch donuts + crystals, dodge burnt ones and seagulls. */
import { h, clamp, formatNumber, prefersReducedMotion } from '../lib/dom';
import { sectionHead } from '../components/sectionHead';
import { donutSVG, FLAVORS } from '../components/art';
import { CRYSTALS, crystalSVG } from '../components/crystals';
import { collectCrystal } from '../components/hidden';
import { icon } from '../components/icons';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { app } from '../state';
import type { Score } from '../data/types';

const W = 800;
const H = 520;
const GROUND = H - 58;
const ROUND = 60;

type Kind = 'donut' | 'crystal' | 'gold' | 'burnt';
interface Item {
  kind: Kind;
  x: number;
  y: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  img: CanvasImageSource;
  dead?: boolean;
}
interface Gull {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  dir: 1 | -1;
  hit?: boolean;
}
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}
interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

const svgImg = (svg: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });

async function makeSprites() {
  const donuts = await Promise.all(FLAVORS.filter((f) => f.id !== 'cocoa').map((f, i) => svgImg(donutSVG(`game-${i}`, { flavor: f.id, size: 96 }))));
  const crystals = await Promise.all(CRYSTALS.map((c) => svgImg(crystalSVG(c.id, 96))));
  const gold = await svgImg(donutSVG('golden', { flavor: 'lemon', size: 96 }));
  const burntSrc = await svgImg(donutSVG('burnt', { flavor: 'cocoa', size: 96 }));
  const burnt = document.createElement('canvas');
  burnt.width = burnt.height = 96;
  const bctx = burnt.getContext('2d')!;
  bctx.filter = 'brightness(.32) saturate(.3) contrast(1.2)';
  bctx.drawImage(burntSrc, 0, 0);
  return { donuts, crystals, gold, burnt };
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62);
  sky.addColorStop(0, '#1a0b3d');
  sky.addColorStop(0.5, '#6a1f78');
  sky.addColorStop(1, '#ff7a85');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.6})`;
    ctx.fillRect(Math.random() * W, Math.random() * H * 0.35, 1.5, 1.5);
  }
  // retro sun
  const sx = W / 2;
  const sy = H * 0.62;
  const sr = 120;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, sr, Math.PI, 0);
  ctx.closePath();
  ctx.clip();
  const sun = ctx.createLinearGradient(0, sy - sr, 0, sy);
  sun.addColorStop(0, '#ffe45e');
  sun.addColorStop(0.55, '#ff9a6b');
  sun.addColorStop(1, '#ff4fa3');
  ctx.fillStyle = sun;
  ctx.fillRect(sx - sr, sy - sr, sr * 2, sr);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const y = sy - 8 - i * 13;
    ctx.fillRect(sx - sr, y, sr * 2, 2 + (6 - i) * 0.9);
  }
  ctx.restore();
  // sea
  const sea = ctx.createLinearGradient(0, H * 0.62, 0, GROUND);
  sea.addColorStop(0, '#5a2a8a');
  sea.addColorStop(1, '#1c6488');
  ctx.fillStyle = sea;
  ctx.fillRect(0, H * 0.62, W, GROUND - H * 0.62 + 6);
  // sand
  const sand = ctx.createLinearGradient(0, GROUND, 0, H);
  sand.addColorStop(0, '#ffd9a0');
  sand.addColorStop(1, '#f0a868');
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 4);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, GROUND + Math.sin(x / 60) * 4);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  // palms
  const palm = (x: number, flip: number) => {
    ctx.save();
    ctx.translate(x, GROUND + 6);
    ctx.scale(flip, 1);
    ctx.fillStyle = '#2a1238';
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.quadraticCurveTo(10, -120, 34, -210);
    ctx.lineTo(42, -206);
    ctx.quadraticCurveTo(20, -120, 8, 0);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.translate(38, -208);
      ctx.rotate(-2.6 + i * 0.95);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(40, -24, 86, 6);
      ctx.quadraticCurveTo(40, -6, 0, 6);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  };
  palm(26, 1);
  palm(W - 26, -1);
}

function drawGull(ctx: CanvasRenderingContext2D, g: Gull) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.dir, 1);
  const flap = Math.sin(g.t * 14) * 14;
  ctx.strokeStyle = '#3a2350';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#c9c3d6';
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.quadraticCurveTo(-22, -16 - flap, -40, -6 - flap * 0.6);
  ctx.quadraticCurveTo(-22, -6, -4, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 2, 24, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(20, -6, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.moveTo(27, -7);
  ctx.lineTo(40, -3);
  ctx.lineTo(27, -1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a1740';
  ctx.beginPath();
  ctx.arc(22, -8, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ece7f4';
  ctx.strokeStyle = '#3a2350';
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.quadraticCurveTo(-14, -18 + flap, -30, -10 + flap * 0.8);
  ctx.quadraticCurveTo(-12, -4, 4, 6);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBox(ctx: CanvasRenderingContext2D, x: number, squash: number, flash: number) {
  const w = 118 * (1 + squash * 0.12);
  const hh = 50 * (1 - squash * 0.15);
  const y = GROUND - hh + 10;
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = 'rgba(42,23,64,.35)';
  ctx.beginPath();
  ctx.ellipse(0, GROUND + 12, w * 0.55, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // lid flaps
  ctx.fillStyle = '#ffd0e8';
  ctx.beginPath();
  ctx.moveTo(-w / 2, y);
  ctx.lineTo(-w / 2 - 22, y - 18);
  ctx.lineTo(-w / 2 + 16, y - 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w / 2, y);
  ctx.lineTo(w / 2 + 22, y - 18);
  ctx.lineTo(w / 2 - 16, y - 12);
  ctx.closePath();
  ctx.fill();
  // body with stripes
  ctx.beginPath();
  ctx.roundRect(-w / 2, y, w, hh, [4, 4, 12, 12]);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#fff6ee';
  ctx.fillRect(-w / 2, y, w, hh);
  ctx.fillStyle = '#ff8fc7';
  for (let i = -6; i < 8; i++) {
    ctx.save();
    ctx.translate(i * 22, y);
    ctx.rotate(0.5);
    ctx.fillRect(0, -10, 10, 120);
    ctx.restore();
  }
  ctx.restore();
  ctx.strokeStyle = '#e0559b';
  ctx.lineWidth = 3;
  ctx.stroke();
  // label
  ctx.fillStyle = '#2a1740';
  ctx.beginPath();
  ctx.roundRect(-34, y + hh / 2 - 11, 68, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 11px "Unbounded Variable", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DONUTS', 0, y + hh / 2 + 1);
  if (flash > 0) {
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#ff3b6b';
    ctx.beginPath();
    ctx.roundRect(-w / 2, y, w, hh, 10);
    ctx.fill();
  }
  ctx.restore();
}

export function mountArcade() {
  const canvas = h('canvas', { class: 'arcade__canvas', tabindex: '0', 'aria-label': 'Donut Drop game. Use arrow keys or drag to move the box.' });
  const ctx = canvas.getContext('2d')!;
  const board = h('ol', { class: 'scores' });
  const boardLabel = h('p', { class: 'hud-label' }, 'High scores');
  const overlay = h('form', { class: 'arcade__submit', hidden: true });
  const nameIn = h('input', { type: 'text', maxlength: '20', placeholder: 'Your name', 'aria-label': 'Name for the leaderboard', required: true });
  const submitBtn = h('button', { class: 'btn btn--primary btn--sm', type: 'submit' }, 'Post score');
  overlay.append(nameIn, submitBtn);

  const el = h(
    'section',
    { id: 'arcade', class: 'section arcade' },
    sectionHead(6, 'Arcade', h('span', null, 'Donut Drop: ', h('span', { class: 'holo-text' }, 'Beach Edition')), 'Catch the donuts. Grab the crystals. Dodge the burnt ones — and watch out for seagulls. Score 500+ for a rare crystal.'),
    h(
      'div',
      { class: 'arcade__grid' },
      h(
        'div',
        { class: 'cabinet', 'data-reveal': '' },
        h('div', { class: 'cabinet__marquee' }, h('span', null, 'DONUT DROP'), h('small', null, 'insert sprinkles')),
        h('div', { class: 'cabinet__screen' }, canvas, overlay),
        h(
          'div',
          { class: 'cabinet__controls' },
          h('span', { html: `${icon('left', 16)}${icon('right', 16)} or <b>A</b>/<b>D</b> to move` }),
          h('span', null, h('b', null, 'Space'), ' to start'),
          h('span', null, 'Touch: drag'),
        ),
      ),
      h('aside', { class: 'leaderboard glass', 'data-reveal': '' }, boardLabel, board, h('p', { class: 'leaderboard__note' }, app.store?.mode === 'supabase' ? 'Global leaderboard — every Donut, everywhere.' : 'Preview Mode: scores are saved on this device.')),
    ),
  );

  /* ── Leaderboard ── */
  const renderBoard = (scores: Score[]) => {
    boardLabel.textContent = app.store?.mode === 'supabase' ? 'Global high scores' : 'High scores';
    if (!scores.length) {
      board.replaceChildren(h('li', { class: 'scores__empty' }, 'No scores yet. Be the first legend.'));
      return;
    }
    board.replaceChildren(
      ...scores.map((s, i) =>
        h(
          'li',
          { class: `scores__row${i < 3 ? ' is-top' : ''}` },
          h('span', { class: 'scores__rank' }, String(i + 1)),
          h('span', { class: 'scores__donut', html: donutSVG(s.name, { size: 32 }) }),
          h('span', { class: 'scores__name' }, s.name),
          h('span', { class: 'scores__score' }, formatNumber(s.score)),
        ),
      ),
    );
  };
  const loadBoard = () => app.store?.topScores().then(renderBoard).catch(() => renderBoard([]));
  app.events.on('ready', loadBoard);

  /* ── Game state ── */
  let sprites: Awaited<ReturnType<typeof makeSprites>> | null = null;
  let bg: HTMLCanvasElement | null = null;
  let mode: 'title' | 'play' | 'over' = 'title';
  let items: Item[] = [];
  let gulls: Gull[] = [];
  let parts: Part[] = [];
  let floaters: Floater[] = [];
  let score = 0;
  let lives = 3;
  let combo = 0;
  let time = ROUND;
  let rush = 0;
  let spawnT = 0;
  let gullT = 8;
  let elapsed = 0;
  let boxX = W / 2;
  let targetX = W / 2;
  let squash = 0;
  let flash = 0;
  let shake = 0;
  let keys = { left: false, right: false };
  let overReason = '';
  let newBest = false;
  let earnedOpal = false;
  let running = false;
  let visible = false;
  let raf = 0;
  let last = 0;
  let scale = 1;
  let dpr = 1;
  let t0 = 0;
  let endedAt = 0;

  const fit = () => {
    const wrap = canvas.parentElement!;
    const cw = wrap.clientWidth;
    scale = cw / W;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    canvas.style.height = `${H * scale}px`;
    if (!running) draw();
  };

  const reset = () => {
    items = [];
    gulls = [];
    parts = [];
    floaters = [];
    score = 0;
    lives = 3;
    combo = 0;
    time = ROUND;
    rush = 0;
    spawnT = 0.6;
    gullT = 9;
    elapsed = 0;
    newBest = false;
    earnedOpal = false;
    overlay.hidden = true;
  };

  const start = () => {
    if (!sprites || (mode === 'over' && performance.now() - endedAt < 900)) return;
    sound.unlock();
    reset();
    mode = 'play';
    canvas.focus({ preventScroll: true });
    progress.unlock('arcade');
    sound.click();
  };

  const end = (reason: string) => {
    mode = 'over';
    endedAt = performance.now();
    overReason = reason;
    newBest = progress.setBest(score);
    if (score >= 500 && !progress.data.crystals.includes('opal')) {
      earnedOpal = true;
      collectCrystal('opal', canvas);
    }
    if (score >= 1000) progress.unlock('high-roller');
    progress.addXp(Math.min(120, Math.round(score / 25)), 'Donut Drop');
    if (score > 0) {
      overlay.hidden = false;
      nameIn.value = progress.data.name || '';
    }
    sound.success();
  };

  const spawn = () => {
    const difficulty = clamp(elapsed / ROUND, 0, 1);
    const roll = Math.random();
    let kind: Kind = 'donut';
    if (roll < 0.05 + difficulty * 0.13) kind = 'burnt';
    else if (roll < 0.13 + difficulty * 0.13) kind = 'crystal';
    else if (roll < 0.155 + difficulty * 0.13) kind = 'gold';
    const s = sprites!;
    const img = kind === 'donut' ? s.donuts[Math.floor(Math.random() * s.donuts.length)] : kind === 'crystal' ? s.crystals[Math.floor(Math.random() * s.crystals.length)] : kind === 'gold' ? s.gold : s.burnt;
    items.push({
      kind,
      x: 40 + Math.random() * (W - 80),
      y: -30,
      vy: 150 + difficulty * 230 + Math.random() * 60,
      r: kind === 'crystal' ? 20 : 24,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 3,
      img,
    });
  };

  const pop = (x: number, y: number, colors: string[], n = 14) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 80 + Math.random() * 220;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 1, color: colors[i % colors.length], size: 3 + Math.random() * 3 });
    }
  };

  const update = (dt: number) => {
    squash *= 0.86;
    flash = Math.max(0, flash - dt * 3);
    shake = Math.max(0, shake - dt * 30);
    parts = parts.filter((p) => (p.life -= dt * 1.4) > 0);
    parts.forEach((p) => {
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    floaters = floaters.filter((f) => (f.life -= dt * 1.1) > 0);
    floaters.forEach((f) => (f.y -= 50 * dt));
    if (mode !== 'play') return;

    elapsed += dt;
    time -= dt;
    rush = Math.max(0, rush - dt);
    if (time <= 0) {
      time = 0;
      end('Time!');
      return;
    }

    // movement
    const speed = 640;
    if (keys.left) targetX -= speed * dt;
    if (keys.right) targetX += speed * dt;
    targetX = clamp(targetX, 64, W - 64);
    boxX += (targetX - boxX) * Math.min(1, dt * 16);

    // spawns
    spawnT -= dt;
    if (spawnT <= 0) {
      spawn();
      spawnT = Math.max(0.3, 0.78 - (elapsed / ROUND) * 0.45) * (0.75 + Math.random() * 0.5);
    }
    gullT -= dt;
    if (gullT <= 0 && elapsed > 6) {
      const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      gulls.push({ x: dir === 1 ? -60 : W + 60, y: 90 + Math.random() * 120, vx: dir * (210 + Math.random() * 90), vy: 70 + Math.random() * 50, t: 0, dir });
      gullT = Math.max(3.2, 7.5 - elapsed * 0.06) + Math.random() * 2.5;
      sound.whoosh();
    }

    const boxTop = GROUND - 40;
    const mult = (1 + Math.min(4, Math.floor(combo / 5))) * (rush > 0 ? 2 : 1);
    for (const it of items) {
      it.y += it.vy * dt;
      it.rot += it.vr * dt;
      if (!it.dead && it.y + it.r > boxTop && it.y - it.r < boxTop + 20 && Math.abs(it.x - boxX) < 64) {
        it.dead = true;
        squash = 1;
        if (it.kind === 'burnt') {
          lives--;
          combo = 0;
          flash = 1;
          shake = 10;
          sound.hit();
          floaters.push({ x: it.x, y: it.y - 20, text: 'BURNT! −1 ♥', life: 1, color: '#ff6b8a' });
          pop(it.x, it.y, ['#3a2418', '#6b5a50', '#999'], 18);
          if (lives <= 0) end('Out of lives');
        } else {
          combo++;
          const base = it.kind === 'crystal' ? 50 : it.kind === 'gold' ? 100 : 10;
          const pts = base * mult;
          score += pts;
          sound.catch(combo);
          if (it.kind === 'gold') {
            rush = 6;
            floaters.push({ x: it.x, y: it.y - 40, text: 'SUGAR RUSH ×2!', life: 1.3, color: '#ffe45e' });
            sound.levelUp();
          }
          floaters.push({ x: it.x, y: it.y - 10, text: `+${pts}`, life: 1, color: it.kind === 'crystal' ? '#7df9ff' : '#ffffff' });
          pop(it.x, it.y, it.kind === 'crystal' ? ['#7df9ff', '#b79cff', '#fff'] : ['#ff8fc7', '#ffd84a', '#6cf2b5', '#5eb8ff']);
        }
      }
      if (!it.dead && it.y - it.r > GROUND + 10) {
        it.dead = true;
        if (it.kind !== 'burnt') {
          combo = 0;
          pop(it.x, GROUND + 4, ['#ffd9a0', '#f0a868'], 8);
        }
      }
    }
    items = items.filter((i) => !i.dead);

    for (const g of gulls) {
      g.t += dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt * (g.t < 1.4 ? 1 : -0.6);
      if (!g.hit && Math.abs(g.x - boxX) < 70 && Math.abs(g.y - (GROUND - 30)) < 46) {
        g.hit = true;
        lives--;
        combo = 0;
        flash = 1;
        shake = 14;
        const stolen = Math.min(score, 40);
        score -= stolen;
        sound.hit();
        floaters.push({ x: boxX, y: GROUND - 90, text: `SEAGULL! −${stolen}`, life: 1.3, color: '#ff6b8a' });
        if (lives <= 0) end('A seagull got you');
      }
    }
    gulls = gulls.filter((g) => g.x > -120 && g.x < W + 120 && g.y > -100);
  };

  const text = (str: string, x: number, y: number, size: number, color = '#fff', weight = 800, align: CanvasTextAlign = 'center', font = 'Unbounded Variable') => {
    ctx.font = `${weight} ${size}px "${font}", sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(26,11,46,.55)';
    ctx.fillText(str, x + 2, y + 3);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  };

  const draw = () => {
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = '#1a0b3d';
      ctx.fillRect(0, 0, W, H);
    }
    // shimmer on the sea
    const now = performance.now() / 1000;
    ctx.fillStyle = 'rgba(255,220,180,.35)';
    for (let i = 0; i < 9; i++) {
      const y = H * 0.64 + i * 9;
      const w = 120 - i * 9;
      ctx.fillRect(W / 2 - w / 2 + Math.sin(now * 1.4 + i) * 12, y, w, 2);
    }

    if (sprites) {
      for (const it of items) {
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot);
        if (it.kind === 'gold') {
          ctx.shadowColor = '#ffe45e';
          ctx.shadowBlur = 24;
        }
        if (it.kind === 'crystal') {
          ctx.shadowColor = '#7df9ff';
          ctx.shadowBlur = 16;
        }
        const s = it.r * 2.3;
        ctx.drawImage(it.img, -s / 2, -s / 2, s, s);
        ctx.restore();
        if (it.kind === 'burnt') {
          ctx.fillStyle = 'rgba(160,150,170,.35)';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(it.x + Math.sin(now * 3 + k) * 6, it.y - 28 - k * 10, 5 + k * 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    gulls.forEach((g) => drawGull(ctx, g));
    drawBox(ctx, boxX, squash, flash);
    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    floaters.forEach((f) => {
      ctx.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 18, f.color, 800);
    });
    ctx.globalAlpha = 1;
    ctx.restore();

    if (mode === 'play') {
      text(formatNumber(score), 24, 34, 26, '#fff', 800, 'left');
      const mult = (1 + Math.min(4, Math.floor(combo / 5))) * (rush > 0 ? 2 : 1);
      if (mult > 1) text(`×${mult}${rush > 0 ? ' RUSH' : ''}`, 24, 64, 14, rush > 0 ? '#ffe45e' : '#7df9ff', 700, 'left');
      text(`${Math.ceil(time)}`, W / 2, 34, 26, time < 10 ? '#ff8fc7' : '#fff');
      text('♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, 3 - lives)), W - 24, 34, 24, '#ff4fa3', 400, 'right', 'Plus Jakarta Sans Variable');
    } else {
      ctx.fillStyle = 'rgba(14,6,34,.62)';
      ctx.fillRect(0, 0, W, H);
      if (mode === 'title') {
        text('DONUT DROP', W / 2, H * 0.2, 56, '#ffffff', 900);
        text('BEACH EDITION', W / 2, H * 0.2 + 44, 16, '#7df9ff', 700);
        const blink = Math.sin(t0 * 4) > -0.2;
        if (blink) text(sprites ? 'PRESS SPACE  ·  TAP TO START' : 'LOADING…', W / 2, H * 0.62, 18, '#ffe45e', 700);
        text(`BEST ${formatNumber(progress.data.best)}`, W / 2, H * 0.62 + 40, 13, 'rgba(255,255,255,.7)', 600, 'center', 'JetBrains Mono Variable');
        if (sprites) {
          const legend: [CanvasImageSource, string][] = [
            [sprites.donuts[0], '+10'],
            [sprites.crystals[2], '+50'],
            [sprites.gold, 'RUSH ×2'],
            [sprites.burnt, '−1 ♥'],
          ];
          legend.forEach(([img, label], i) => {
            const x = W / 2 - 210 + i * 140;
            ctx.drawImage(img, x - 20, H * 0.44 - 20, 40, 40);
            text(label, x + 30, H * 0.44, 13, '#fff', 700, 'left', 'JetBrains Mono Variable');
          });
        }
      } else {
        text(overReason.toUpperCase(), W / 2, H * 0.22, 40, '#ff8fc7', 900);
        text(formatNumber(score), W / 2, H * 0.38, 64, '#ffffff', 900);
        text(newBest ? '★ NEW PERSONAL BEST ★' : `BEST ${formatNumber(progress.data.best)}`, W / 2, H * 0.38 + 50, 15, newBest ? '#ffe45e' : 'rgba(255,255,255,.75)', 700, 'center', 'JetBrains Mono Variable');
        if (earnedOpal) text('You earned the OPAL crystal 💎', W / 2, H * 0.38 + 80, 15, '#7df9ff', 700, 'center', 'Plus Jakarta Sans Variable');
        else if (score < 500) text('Score 500+ to earn a rare crystal', W / 2, H * 0.38 + 80, 13, 'rgba(255,255,255,.7)', 600, 'center', 'Plus Jakarta Sans Variable');
        text('SPACE / TAP TO PLAY AGAIN', W / 2, H * 0.86, 15, '#ffe45e', 700);
      }
    }
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    t0 += dt;
    update(dt);
    draw();
  };
  const run = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const halt = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  /* ── Input ── */
  const toLogical = (clientX: number) => {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'play') start();
    targetX = toLogical(e.clientX);
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (mode === 'play') targetX = toLogical(e.clientX);
  });
  canvas.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = true;
    else if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = true;
    else if (e.key === ' ' || e.key === 'Enter') {
      if (mode !== 'play') start();
    } else return;
    e.preventDefault();
  });
  canvas.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = false;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = false;
  });
  canvas.addEventListener('blur', () => (keys = { left: false, right: false }));

  overlay.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameIn.value.trim().slice(0, 20);
    if (!name || score <= 0) return;
    submitBtn.setAttribute('disabled', '');
    try {
      await app.store.addScore(name, Math.min(score, 99999));
      overlay.hidden = true;
      await loadBoard();
      sound.success();
    } finally {
      submitBtn.removeAttribute('disabled');
    }
  });

  /* ── Lifecycle ── */
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !document.hidden) {
      if (!sprites) {
        makeSprites()
          .then((s) => {
            sprites = s;
            bg = document.createElement('canvas');
            bg.width = W * 2;
            bg.height = H * 2;
            const b = bg.getContext('2d')!;
            b.scale(2, 2);
            drawBackground(b);
          })
          .catch((err) => console.error(err));
      }
      run();
    } else {
      halt();
    }
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? halt() : visible && run()));
  new ResizeObserver(fit).observe(el);
  requestAnimationFrame(fit);
  if (prefersReducedMotion()) shake = 0;
  return el;
}
