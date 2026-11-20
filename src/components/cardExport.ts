/* Export a Donut Card as a 1080×1350 PNG — perfect for Instagram / TikTok / Discord. */
import type { Message } from '../data/types';
import { config } from '../config';
import { donutSVG, dripPath, flavorById, stickerSVG, SPRINKLE_COLORS } from './art';
import { rngFor, pick, range } from '../lib/rand';
import { safeMediaUrl, cardNo } from './card';

const W = 1080;
const H = 1350;

function loadImage(src: string, cors = false) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const svgUrl = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= max) line = test;
      else {
        if (line) lines.push(line);
        if (ctx.measureText(word).width > max) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > max) {
              lines.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        } else line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function exportCardPNG(m: Message): Promise<Blob> {
  await Promise.all([
    document.fonts.load('800 40px "Unbounded Variable"'),
    document.fonts.load('500 40px "Plus Jakarta Sans Variable"'),
    document.fonts.load('600 40px "Caveat Variable"'),
    document.fonts.load('500 20px "JetBrains Mono Variable"'),
    document.fonts.load('italic 400 40px "Fraunces Variable"'),
  ]).catch(() => {});

  const f = flavorById(m.flavor);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Twilight backdrop
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#160b33');
  bg.addColorStop(0.55, '#3b1a63');
  bg.addColorStop(1, '#c2408a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.95, 10, W / 2, H * 0.95, W * 0.8);
  glow.addColorStop(0, 'rgba(255,179,138,.75)');
  glow.addColorStop(1, 'rgba(255,179,138,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const rng = rngFor('export' + m.id);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${range(rng, 0.2, 0.8)})`;
    ctx.beginPath();
    ctx.arc(range(rng, 0, W), range(rng, 0, H * 0.6), range(rng, 0.6, 2.2), 0, Math.PI * 2);
    ctx.fill();
  }

  // Card body
  const cx = 90;
  const cy = 150;
  const cw = W - 180;
  const ch = H - 300;
  ctx.save();
  ctx.shadowColor = 'rgba(10,4,30,.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#fff7f0';
  ctx.beginPath();
  ctx.roundRect(cx, cy, cw, ch, 44);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx, cy, cw, ch, 44);
  ctx.clip();

  // Frosting drip (same path as the on-screen card)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(cw / 400, 2.4);
  const fg = ctx.createLinearGradient(0, 0, 400, 120);
  fg.addColorStop(0, f.stops[0]);
  fg.addColorStop(0.55, f.stops[1]);
  fg.addColorStop(1, f.stops[2]);
  ctx.fillStyle = fg;
  ctx.fill(new Path2D(dripPath(m.id + m.name)));
  ctx.restore();
  const sprinkleColors = (f.sprinkles ?? SPRINKLE_COLORS).filter((c) => c !== f.frost);
  for (let i = 0; i < 26; i++) {
    const x = cx + range(rng, 30, cw - 30);
    const y = cy + range(rng, 20, 112);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.fillStyle = pick(rng, sprinkleColors);
    ctx.beginPath();
    ctx.roundRect(-13, -4, 26, 8, 4);
    ctx.fill();
    ctx.restore();
  }

  // Holo sheen
  ctx.globalCompositeOperation = 'soft-light';
  const holo = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
  ['#ff7ac8', '#ffe45e', '#6cf2b5', '#5eb8ff', '#b79cff', '#ff7ac8'].forEach((c, i, a) => holo.addColorStop(i / (a.length - 1), c));
  ctx.fillStyle = holo;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(cx, cy, cw, ch);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // Avatar + name
  const avatar = await loadImage(svgUrl(donutSVG(m.handle || m.name, { flavor: m.flavor, size: 240 })));
  ctx.save();
  ctx.shadowColor = 'rgba(42,23,64,.35)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(avatar, cx + 48, cy + 150, 190, 190);
  ctx.restore();

  ctx.fillStyle = '#2a1740';
  ctx.font = '800 50px "Unbounded Variable", sans-serif';
  let name = m.name;
  while (ctx.measureText(name).width > cw - 330 && name.length > 3) name = name.slice(0, -2) + '…';
  ctx.fillText(name, cx + 262, cy + 250);
  ctx.font = '500 26px "JetBrains Mono Variable", monospace';
  ctx.fillStyle = '#7a5c93';
  const meta = [m.handle ? '@' + m.handle : '', m.since ? `Donut since ${m.since}` : ''].filter(Boolean).join('  ·  ');
  if (meta) ctx.fillText(meta, cx + 264, cy + 296);
  ctx.textAlign = 'right';
  ctx.fillStyle = f.deep;
  ctx.fillText(cardNo(m), cx + cw - 48, cy + 60);
  ctx.textAlign = 'left';

  // Message
  const media = safeMediaUrl(m.mediaUrl);
  let mediaImg: HTMLImageElement | null = null;
  if (media) mediaImg = await loadImage(media, true).catch(() => null);
  const textTop = cy + 400;
  const textMax = cw - 120;
  const textBottom = cy + ch - (mediaImg ? 470 : 170);
  const hand = m.font === 'hand';
  let size = hand ? 66 : 50;
  let lines: string[] = [];
  for (; size >= 22; size -= 2) {
    ctx.font = hand ? `600 ${size}px "Caveat Variable", cursive` : `500 ${size}px "Plus Jakarta Sans Variable", sans-serif`;
    lines = wrap(ctx, m.body, textMax);
    if (lines.length * size * 1.36 <= textBottom - textTop) break;
  }
  ctx.fillStyle = '#2a1740';
  lines.forEach((line, i) => ctx.fillText(line, cx + 60, textTop + size + i * size * 1.36));

  if (mediaImg) {
    const mh = 380;
    const mw = Math.min(cw - 120, (mediaImg.width / mediaImg.height) * mh);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cx + 60, cy + ch - 450, mw, mh, 24);
    ctx.clip();
    ctx.drawImage(mediaImg, cx + 60, cy + ch - 450, mw, mh);
    ctx.restore();
  }

  // Footer
  const sticker = await loadImage(svgUrl(stickerSVG(m.sticker, 160)));
  ctx.drawImage(sticker, cx + cw - 190, cy + ch - 190, 150, 150);
  ctx.font = '600 24px "JetBrains Mono Variable", monospace';
  ctx.fillStyle = f.deep;
  ctx.fillText(f.name.toUpperCase(), cx + 60, cy + ch - 64);

  // Caption under the card
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '800 34px "Unbounded Variable", sans-serif';
  ctx.fillText(`${config.streamer.community.toUpperCase()}`, W / 2, 96);
  ctx.font = 'italic 400 32px "Fraunces Variable", serif';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText(`for ${config.streamer.name}, with love${config.siteUrl ? ' · ' + config.siteUrl.replace(/^https?:\/\//, '') : ''}`, W / 2, H - 82);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png'),
  );
}

export async function downloadCard(m: Message) {
  const blob = await exportCardPNG(m);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `danis-donuts-${(m.handle || m.name).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
