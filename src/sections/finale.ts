/* 08 · FOR DANI — night falls. Every Donut becomes a star. A letter. A wish. */
import { h, clamp, easeInOutCubic, prefersReducedMotion } from '../lib/dom';
import { config } from '../config';
import { donutSVG } from '../components/art';
import { icon } from '../components/icons';
import { collectCrystal } from '../components/hidden';
import { openInspect } from '../components/inspect';
import { fireworks, rain, burstFrom } from '../components/confetti';
import { toast } from '../components/toast';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { rngFor, range, pick } from '../lib/rand';
import { app } from '../state';
import type { Message } from '../data/types';

interface Star {
  msg: Message | null;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  x: number;
  y: number;
  r: number;
  phase: number;
  delay: number;
  outline: boolean;
  hue: string;
}

const STAR_HUES = ['#ffffff', '#ffe9f6', '#e6f6ff', '#fff4d6', '#efe4ff'];

function heartPoint(t: number): [number, number] {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return [x / 17, y / 17];
}

function heartOutline(n: number): [number, number][] {
  const samples: [number, number][] = [];
  const lens: number[] = [0];
  const S = 1200;
  for (let i = 0; i <= S; i++) samples.push(heartPoint((i / S) * Math.PI * 2));
  for (let i = 1; i <= S; i++) lens.push(lens[i - 1] + Math.hypot(samples[i][0] - samples[i - 1][0], samples[i][1] - samples[i - 1][1]));
  const total = lens[S];
  const out: [number, number][] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (j < S && lens[j + 1] < target) j++;
    out.push(samples[j]);
  }
  return out;
}

function insideHeart(x: number, y: number) {
  // implicit heart: (x²+y²−1)³ − x²y³ ≤ 0, with y flipped + scaled to match heartPoint()
  const X = x * 1.12;
  const Y = -y * 1.12 + 0.1;
  const a = X * X + Y * Y - 1;
  return a * a * a - X * X * Y * Y * Y <= 0;
}

function mountSky() {
  const canvas = h('canvas', { class: 'finale__canvas', 'aria-hidden': 'true' });
  const ctx = canvas.getContext('2d')!;
  const tip = h('div', { class: 'star-tip', hidden: true, role: 'tooltip' });
  const countEl = h('b', null, '0');
  const moon = h('button', { class: 'moon', type: 'button', 'aria-label': 'The moon' }, h('span', { class: 'moon__crater moon__crater--a' }), h('span', { class: 'moon__crater moon__crater--b' }), h('span', { class: 'moon__crater moon__crater--c' }));
  moon.addEventListener('click', () => {
    if (!collectCrystal('moonstone', moon)) toast('🌙 Goodnight, Donuts.');
  });

  const wrap = h(
    'div',
    { class: 'finale__sky' },
    canvas,
    moon,
    h(
      'div',
      { class: 'finale__sky-text' },
      h('p', { class: 'shead__kicker' }, h('span', { class: 'shead__idx' }, '08'), h('span', { class: 'shead__line' }), `For ${config.streamer.name}`),
      h('h2', { class: 'finale__title', 'data-reveal': '' }, 'Every star up here is ', h('em', null, 'one of your Donuts.')),
      h('p', { class: 'finale__count', 'data-reveal': '' }, countEl, ' stars and counting. Hover one to see who.'),
    ),
    tip,
  );

  let stars: Star[] = [];
  let bgStars: { x: number; y: number; r: number; p: number }[] = [];
  let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let formedAt = 0;
  let visible = false;
  let running = false;
  let hover: Star | null = null;
  let raf = 0;
  const reduce = prefersReducedMotion();

  const build = () => {
    const rect = wrap.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const msgs = app.messages.filter((m) => !m.pending);
    countEl.textContent = String(msgs.length);
    const rng = rngFor('sky');
    bgStars = Array.from({ length: Math.round((W * H) / 3800) }, () => ({ x: rng() * W, y: rng() * H * 0.9, r: range(rng, 0.3, 1.3), p: rng() * 10 }));
    const size = Math.min(W * 0.36, H * 0.36);
    const cx = W < 700 ? W / 2 : W * 0.6;
    const cy = H * (W < 700 ? 0.6 : 0.54);
    const outlineN = Math.max(48, Math.min(msgs.length, 160));
    const outline = heartOutline(outlineN);
    const targets: { x: number; y: number; outline: boolean }[] = outline.map(([x, y]) => ({ x: cx + x * size, y: cy + y * size, outline: true }));
    let guard = 0;
    while (targets.length < msgs.length && guard++ < 40000) {
      const x = rng() * 2 - 1;
      const y = rng() * 2 - 1.1;
      if (insideHeart(x, y)) targets.push({ x: cx + x * size * 0.92, y: cy + y * size * 0.92, outline: false });
    }
    const order = msgs.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    // Named stars are spread evenly around the heart first, then fill the inside.
    const slotOf: number[] = [];
    const onOutline = Math.min(order.length, outlineN);
    for (let k = 0; k < onOutline; k++) {
      const idx = Math.floor((k * outlineN) / onOutline);
      slotOf.push(idx);
    }
    for (let i = outlineN; i < targets.length && slotOf.length < order.length; i++) slotOf.push(i);
    const msgAt = new Map<number, Message>();
    slotOf.forEach((slot, k) => msgAt.set(slot, order[k]));
    stars = targets.map((t, i) => {
      const msg = msgAt.get(i) ?? null;
      return {
        msg,
        sx: rng() * W,
        sy: rng() * H,
        tx: t.x,
        ty: t.y,
        x: 0,
        y: 0,
        r: msg ? range(rng, 1.6, 2.8) : range(rng, 0.8, 1.4),
        phase: rng() * 10,
        delay: rng() * 0.5,
        outline: t.outline,
        hue: pick(rng, STAR_HUES),
      };
    });
  };

  const draw = (now: number) => {
    const t = now / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const s of bgStars) {
      ctx.globalAlpha = 0.25 + 0.35 * Math.sin(t * 0.8 + s.p) ** 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    const f = formedAt ? clamp((now - formedAt) / (reduce ? 1 : 3200), 0, 1) : 0;
    // constellation lines
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    const outl = stars.filter((s) => s.outline);
    stars.forEach((s) => {
      const k = easeInOutCubic(clamp((f - s.delay * 0.4) / 0.6, 0, 1));
      s.x = s.sx + (s.tx - s.sx) * k;
      s.y = s.sy + (s.ty - s.sy) * k;
    });
    if (f > 0.6) {
      ctx.strokeStyle = `rgba(255,190,230,${0.22 * (f - 0.6) / 0.4})`;
      ctx.beginPath();
      outl.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
      ctx.closePath();
      ctx.stroke();
    }
    for (const s of stars) {
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + s.phase);
      const isHover = s === hover;
      const r = s.r * (isHover ? 2.4 : 1) * (s.msg ? 1 : 0.8);
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 7);
      glow.addColorStop(0, s.msg ? 'rgba(255,200,235,.55)' : 'rgba(200,210,255,.25)');
      glow.addColorStop(1, 'rgba(255,200,235,0)');
      ctx.globalAlpha = (s.msg ? 1 : 0.5) * tw;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = s.hue;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (s.msg && (isHover || r > 2.5)) {
        ctx.strokeStyle = s.hue;
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x - r * 3.5, s.y);
        ctx.lineTo(s.x + r * 3.5, s.y);
        ctx.moveTo(s.x, s.y - r * 3.5);
        ctx.lineTo(s.x, s.y + r * 3.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // shooting star
    if (!reduce) {
      if (!shooting && Math.random() < 0.004) shooting = { x: Math.random() * W * 0.6, y: Math.random() * H * 0.3, vx: 9 + Math.random() * 5, vy: 3 + Math.random() * 2, life: 1 };
      if (shooting) {
        const s = shooting;
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 12, s.y - s.vy * 12);
        grad.addColorStop(0, `rgba(255,255,255,${s.life})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 12, s.y - s.vy * 12);
        ctx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.015;
        if (s.life <= 0) shooting = null;
      }
    }
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    draw(now);
  };
  const run = () => {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(loop);
  };
  const halt = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const nearest = (x: number, y: number) => {
    let best: Star | null = null;
    let bd = 26;
    for (const s of stars) {
      if (!s.msg) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };
  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const s = nearest(x, y);
    if (s !== hover) {
      hover = s;
      if (s?.msg) {
        sound.hover();
        tip.hidden = false;
        tip.replaceChildren(
          h('span', { class: 'star-tip__donut', html: donutSVG(s.msg.handle || s.msg.name, { flavor: s.msg.flavor, size: 34 }) }),
          h('span', null, h('b', null, s.msg.name), h('small', null, s.msg.body.length > 90 ? s.msg.body.slice(0, 88) + '…' : s.msg.body)),
        );
      } else tip.hidden = true;
      wrap.style.cursor = s ? 'pointer' : '';
    }
    if (s) {
      tip.style.left = `${clamp(s.x, 140, W - 140)}px`;
      tip.style.top = `${s.y}px`;
    }
  });
  wrap.addEventListener('pointerleave', () => {
    hover = null;
    tip.hidden = true;
  });
  wrap.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.moon')) return;
    const r = wrap.getBoundingClientRect();
    const s = nearest(e.clientX - r.left, e.clientY - r.top);
    if (s?.msg) {
      const list = app.messages.filter((m) => !m.pending);
      openInspect(list, list.indexOf(s.msg));
    }
  });

  new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      if (visible) {
        if (!formedAt) formedAt = performance.now() + 300;
        run();
      } else halt();
    },
    { threshold: 0.15 },
  ).observe(wrap);
  new ResizeObserver(() => build()).observe(wrap);
  app.events.on('ready', build);
  app.events.on('added', build);
  app.events.on('removed', build);
  return wrap;
}

function mountLetter() {
  const L = config.letter;
  const names = h('div', { class: 'signatures', 'aria-label': 'Signed by' });
  const renderNames = () => {
    const list = app.messages.filter((m) => !m.pending);
    const rng = rngFor('sig');
    const colors = ['#e0559b', '#7b55e6', '#2a8fe0', '#22b583', '#ef6f48', '#6a2bb5'];
    names.replaceChildren(
      h('p', { class: 'hud-label signatures__label' }, `Signed by ${list.length} Donut${list.length === 1 ? '' : 's'}`),
      ...list.map((m) =>
        h('span', { class: 'sig', style: { '--rot': `${range(rng, -6, 6).toFixed(1)}deg`, '--c': pick(rng, colors), '--s': range(rng, 0.85, 1.35).toFixed(2) } }, m.name),
      ),
    );
  };
  app.events.on('ready', renderNames);
  app.events.on('added', renderNames);
  app.events.on('removed', renderNames);
  return h(
    'article',
    { class: 'letter', 'data-reveal': '' },
    h(
      'div',
      { class: 'letter__paper' },
      h('div', { class: 'letter__stamp', html: donutSVG('stamp', { flavor: 'strawberry', size: 78 }) }),
      h('p', { class: 'letter__greeting' }, L.greeting),
      L.paragraphs.map((p, i) => h('p', { class: 'letter__p', 'data-reveal': '', style: { '--i': String(i) } }, p)),
      h('p', { class: 'letter__signoff' }, L.signoff),
      h('p', { class: 'letter__from' }, L.from),
      names,
    ),
  );
}

const CAKE = `<svg viewBox="0 0 300 250" class="cake" aria-hidden="true">
<defs>
<radialGradient id="ckDough" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#ffe3b3"/><stop offset=".7" stop-color="#e2a35f"/><stop offset="1" stop-color="#b8733a"/></radialGradient>
<linearGradient id="ckGlaze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc4e3"/><stop offset=".5" stop-color="#ff8fc7"/><stop offset="1" stop-color="#f2629f"/></linearGradient>
<pattern id="ckStripe" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="14" height="14" fill="#fff6ee"/><rect width="6" height="14" fill="#b79cff"/></pattern>
<radialGradient id="ckFlame" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe45e"/><stop offset=".75" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></radialGradient>
<radialGradient id="ckGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd38a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd38a" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="150" cy="228" rx="128" ry="14" fill="rgba(0,0,0,.35)"/>
<path d="M22,160 C22,225 278,225 278,160 L278,150 C278,95 22,95 22,150Z" fill="url(#ckDough)"/>
<path d="M30,146 C30,110 270,110 270,146 C270,160 262,168 255,170 C252,186 244,186 241,172 C220,182 200,184 182,183 C180,200 168,201 166,184 C140,186 120,185 100,182 C97,194 86,195 84,180 C64,176 50,172 40,166 C38,178 28,178 30,160Z" fill="url(#ckGlaze)"/>
<ellipse cx="150" cy="140" rx="40" ry="14" fill="#9a5a2c"/>
<ellipse cx="150" cy="137" rx="34" ry="10" fill="#6b3a1c"/>
<g>
<rect x="64" y="128" width="16" height="5" rx="2.5" fill="#ffd84a" transform="rotate(-20 72 130)"/>
<rect x="98" y="118" width="16" height="5" rx="2.5" fill="#5eb8ff" transform="rotate(15 106 120)"/>
<rect x="204" y="122" width="16" height="5" rx="2.5" fill="#6cf2b5" transform="rotate(-35 212 124)"/>
<rect x="232" y="142" width="16" height="5" rx="2.5" fill="#fff" transform="rotate(60 240 144)"/>
<rect x="52" y="150" width="16" height="5" rx="2.5" fill="#b79cff" transform="rotate(40 60 152)"/>
<rect x="120" y="162" width="16" height="5" rx="2.5" fill="#ffd84a" transform="rotate(-10 128 164)"/>
<rect x="184" y="160" width="16" height="5" rx="2.5" fill="#5eb8ff" transform="rotate(25 192 162)"/>
<rect x="215" y="160" width="16" height="5" rx="2.5" fill="#ff4fa3" transform="rotate(-50 223 162)"/>
<rect x="88" y="146" width="16" height="5" rx="2.5" fill="#6cf2b5" transform="rotate(75 96 148)"/>
</g>
<path d="M50,132 C70,118 100,113 128,112" stroke="#fff" stroke-opacity=".6" stroke-width="6" fill="none" stroke-linecap="round"/>
<rect x="140" y="44" width="20" height="96" rx="5" fill="url(#ckStripe)" stroke="#e7d9ff" stroke-width="1"/>
<path d="M150,44 L150,32" stroke="#3a2350" stroke-width="2.4" stroke-linecap="round"/>
<g class="cake__flame">
<circle cx="150" cy="18" r="36" fill="url(#ckGlow)"/>
<path class="cake__flame-shape" d="M150,-6 C160,8 166,18 162,28 C159,36 141,36 138,28 C134,18 141,8 150,-6Z" fill="url(#ckFlame)"/>
<path d="M150,12 C154,18 155,23 153,27 C151,30 149,30 147,27 C145,23 146,18 150,12Z" fill="#fff" opacity=".85"/>
</g>
<g class="cake__smoke"><circle cx="150" cy="22" r="6"/><circle cx="146" cy="10" r="8"/><circle cx="154" cy="-4" r="10"/></g>
</svg>`;

function mountWish() {
  const cake = h('div', { class: 'wish__cake', html: CAKE });
  const meter = h('div', { class: 'wish__meter' }, h('span'));
  const micBtn = h('button', { class: 'btn btn--glass', type: 'button', html: `${icon('mic', 18)}<span>Blow into your mic</span>` });
  const holdBtn = h('button', { class: 'btn btn--primary wish__hold', type: 'button', html: '<span>Hold to blow</span><i class="wish__hold-fill"></i>' });
  const status = h('p', { class: 'wish__status', 'aria-live': 'polite' });
  const done = h(
    'div',
    { class: 'wish__done', hidden: true },
    h('p', { class: 'hud-label' }, 'Wish granted'),
    h('h2', { class: 'wish__title' }, h('span', { class: 'holo-text' }, `${config.occasion.kicker}, ${config.streamer.name}`)),
    h('p', { class: 'wish__line' }, 'May every drop be a hot drop, every pull be a rare one, and every day be as sweet as you make ours.'),
    h('p', { class: 'wish__love' }, `We love you. — ${config.streamer.community} 💗`),
    h('button', { class: 'link-btn', type: 'button', onclick: () => relight() }, 'Relight the candle'),
  );
  const actions = h('div', { class: 'wish__actions' }, micBtn, holdBtn);
  const el = h(
    'div',
    { class: 'wish', 'data-reveal': '' },
    cake,
    h('div', { class: 'wish__copy' }, h('p', { class: 'hud-label' }, 'One last thing'), h('h3', { class: 'wish__ask' }, `Make a wish, ${config.streamer.name}`), h('p', { class: 'wish__how' }, 'Blow into your microphone — really! — or press and hold the button.'), meter, actions, status),
    done,
  );

  let blown = false;
  let micStream: MediaStream | null = null;
  let micCtx: AudioContext | null = null;
  const setLevel = (v: number) => {
    cake.style.setProperty('--blow', v.toFixed(3));
    (meter.firstElementChild as HTMLElement).style.transform = `scaleX(${clamp(v, 0, 1)})`;
  };

  const stopMic = () => {
    micStream?.getTracks().forEach((t) => t.stop());
    micStream = null;
    void micCtx?.close();
    micCtx = null;
  };

  const blowOut = () => {
    if (blown) return;
    blown = true;
    stopMic();
    setLevel(1);
    cake.classList.add('is-out');
    sound.whoosh();
    setTimeout(() => sound.success(), 300);
    status.textContent = '';
    progress.unlock('wish');
    setTimeout(() => {
      fireworks(7);
      rain(4);
      burstFrom(cake, { count: 160, power: 16 });
      el.classList.add('is-granted');
      done.hidden = false;
      requestAnimationFrame(() => done.classList.add('is-in'));
    }, 650);
  };

  const relight = () => {
    blown = false;
    setLevel(0);
    cake.classList.remove('is-out');
    el.classList.remove('is-granted');
    done.hidden = true;
    done.classList.remove('is-in');
  };

  micBtn.addEventListener('click', async () => {
    if (blown) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'No microphone available here — use the hold button instead.';
      return;
    }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      micCtx = new AudioContext();
      const src = micCtx.createMediaStreamSource(micStream);
      const an = micCtx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const binHz = micCtx.sampleRate / an.fftSize;
      const maxBin = Math.floor(900 / binHz);
      let charge = 0;
      status.textContent = 'Listening… blow like it’s your birthday 🎂';
      micBtn.classList.add('is-listening');
      const listen = () => {
        if (!micStream || blown) {
          micBtn.classList.remove('is-listening');
          return;
        }
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 1; i <= maxBin; i++) sum += data[i];
        const level = clamp(sum / maxBin / 190, 0, 1);
        charge = clamp(charge + (level > 0.5 ? level * 0.045 : -0.02), 0, 1);
        setLevel(Math.max(level * 0.6, charge));
        if (charge >= 1) blowOut();
        else requestAnimationFrame(listen);
      };
      listen();
    } catch {
      status.textContent = 'Mic permission was blocked — no worries, hold the button instead.';
    }
  });

  let holdStart = 0;
  let holdRaf = 0;
  const holdTick = (now: number) => {
    const p = clamp((now - holdStart) / 1500, 0, 1);
    setLevel(p);
    holdBtn.style.setProperty('--p', String(p));
    if (p >= 1) blowOut();
    else holdRaf = requestAnimationFrame(holdTick);
  };
  const holdEnd = () => {
    cancelAnimationFrame(holdRaf);
    if (!blown) {
      setLevel(0);
      holdBtn.style.setProperty('--p', '0');
    }
  };
  holdBtn.addEventListener('pointerdown', (e) => {
    if (blown) return;
    e.preventDefault();
    sound.unlock();
    holdStart = performance.now();
    holdRaf = requestAnimationFrame(holdTick);
  });
  holdBtn.addEventListener('pointerup', holdEnd);
  holdBtn.addEventListener('pointerleave', holdEnd);
  holdBtn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !blown) {
      e.preventDefault();
      holdStart = performance.now();
      holdRaf = requestAnimationFrame(holdTick);
    }
  });
  holdBtn.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') holdEnd();
  });
  holdBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  return el;
}

export function mountFinale() {
  const year = new Date().getFullYear();
  return h(
    'section',
    { id: 'for-dani', class: 'finale' },
    mountSky(),
    h('div', { class: 'finale__body' }, mountLetter(), mountWish()),
    h(
      'footer',
      { class: 'credits' },
      h('div', { class: 'credits__donut', html: donutSVG('HeyDani', { flavor: 'holo', size: 56 }) }),
      h('p', { class: 'credits__made' }, 'Made with love by ', h('b', null, config.streamer.community), ` for ${config.streamer.name} · ${year}`),
      h(
        'p',
        { class: 'credits__links' },
        h('a', { href: '#lobby' }, 'Back to the lobby'),
        h('a', { href: '#/stream' }, 'Stream Mode'),
        h('a', { href: '#/overlay' }, 'OBS overlay'),
        h('a', { href: '#/admin' }, 'Organizers'),
      ),
      h('p', { class: 'credits__fine' }, 'A fan-made community gift. Not affiliated with any game, platform or brand mentioned.'),
    ),
  );
}
