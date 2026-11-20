/* Procedural sound design — every sound is synthesised live with WebAudio. No audio files.
 * UI blips, crystal chimes, achievement fanfares, ocean waves and a soft lo-fi pad. */
import { load, save } from './storage';

type Wave = OscillatorType;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private ambience: GainNode | null = null;
  private reverb!: ConvolverNode;
  private ambienceNodes: AudioNode[] = [];
  enabled = load<boolean>('sound', true);
  private listeners = new Set<(on: boolean) => void>();

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Must be called from a user gesture (the "Press Start" button). */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.55;
      this.sfx.connect(this.master);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.8, 2.6);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.35;
      this.reverb.connect(wet).connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.enabled) this.startAmbience();
  }

  toggle(force?: boolean) {
    this.enabled = force ?? !this.enabled;
    save('sound', this.enabled);
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0, t, 0.15);
      if (this.enabled) this.startAmbience();
    }
    this.listeners.forEach((fn) => fn(this.enabled));
  }

  get context() {
    return this.ctx;
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private tone(freq: number, opts: { type?: Wave; dur?: number; vol?: number; at?: number; slide?: number; wet?: boolean; attack?: number } = {}) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts.at ?? 0);
    const dur = opts.dur ?? 0.15;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
    const vol = opts.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfx);
    if (opts.wet) g.connect(this.reverb);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** Glassy FM bell — the crystal sound. */
  private bell(freq: number, at = 0, vol = 0.16) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 3.5;
    modGain.gain.setValueAtTime(freq * 2.2, t);
    modGain.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(modGain).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    car.connect(g);
    g.connect(this.sfx);
    g.connect(this.reverb);
    car.start(t);
    mod.start(t);
    car.stop(t + 1.7);
    mod.stop(t + 1.7);
  }

  hover() {
    this.tone(1320, { dur: 0.05, vol: 0.035, type: 'sine' });
  }
  click() {
    this.tone(660, { dur: 0.07, vol: 0.09, type: 'triangle' });
    this.tone(990, { dur: 0.09, vol: 0.06, type: 'sine', at: 0.035 });
  }
  pop() {
    this.tone(420 + Math.random() * 160, { dur: 0.12, vol: 0.16, type: 'sine', slide: 2.4 });
  }
  boop() {
    const base = 380 + Math.random() * 120;
    this.tone(base, { dur: 0.18, vol: 0.2, type: 'sine', slide: 1.9 });
    this.tone(base * 2, { dur: 0.08, vol: 0.05, type: 'triangle', at: 0.02 });
  }
  heart() {
    this.tone(880, { dur: 0.1, vol: 0.1, type: 'sine', slide: 1.5 });
    this.tone(1320, { dur: 0.14, vol: 0.08, type: 'sine', at: 0.06, wet: true });
  }
  whoosh() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.6);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(3200, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
  }
  crystal() {
    [1568, 2093, 2637, 3136].forEach((f, i) => this.bell(f, i * 0.07, 0.11));
  }
  achievement() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(f, { dur: 0.35, vol: 0.12, type: 'triangle', at: i * 0.08, wet: true });
    });
    this.bell(2093, 0.34, 0.08);
  }
  levelUp() {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone(f, { dur: 0.4, vol: 0.11, type: 'square', at: i * 0.06, wet: true });
    });
  }
  success() {
    [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => this.bell(f, i * 0.1, 0.13));
  }
  error() {
    this.tone(220, { dur: 0.18, vol: 0.1, type: 'sawtooth', slide: 0.7 });
  }
  catch(combo: number) {
    const f = 523.25 * Math.pow(2, Math.min(combo, 12) / 12);
    this.tone(f, { dur: 0.1, vol: 0.12, type: 'triangle' });
  }
  hit() {
    this.tone(160, { dur: 0.3, vol: 0.2, type: 'sawtooth', slide: 0.5 });
  }

  private noiseBuffer(seconds: number, brown = false) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = white;
    }
    return buf;
  }

  /** Ocean waves + a gentle generative pad. Very quiet; it's a vibe, not a soundtrack. */
  private startAmbience() {
    if (!this.ctx || this.ambience) return;
    const ctx = this.ctx;
    this.ambience = ctx.createGain();
    this.ambience.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.ambience.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 4);
    this.ambience.connect(this.master);

    // Waves: brown noise → lowpass, swelling on two slow LFOs.
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(6, true);
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 650;
    const swell = ctx.createGain();
    swell.gain.value = 0.05;
    const lfo1 = ctx.createOscillator();
    lfo1.frequency.value = 0.085;
    const lfo1g = ctx.createGain();
    lfo1g.gain.value = 0.035;
    lfo1.connect(lfo1g).connect(swell.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.053;
    const lfo2g = ctx.createGain();
    lfo2g.gain.value = 260;
    lfo2.connect(lfo2g).connect(lp.frequency);
    noise.connect(lp).connect(swell).connect(this.ambience);
    noise.start();
    lfo1.start();
    lfo2.start();
    this.ambienceNodes.push(noise, lfo1, lfo2);

    // Pad: Fmaj9 → Dm9 → Bbmaj9 → C6/9, slow and warm.
    const chords = [
      [174.61, 220, 261.63, 329.63, 392],
      [146.83, 174.61, 220, 261.63, 329.63],
      [116.54, 174.61, 220, 293.66, 349.23],
      [130.81, 196, 246.94, 293.66, 329.63],
    ];
    let step = 0;
    const playChord = () => {
      if (!this.ctx || !this.ambience) return;
      const t = ctx.currentTime;
      const chord = chords[step % chords.length];
      step++;
      const padBus = ctx.createGain();
      padBus.gain.setValueAtTime(0.0001, t);
      padBus.gain.exponentialRampToValueAtTime(0.026, t + 2.2);
      padBus.gain.setValueAtTime(0.026, t + 6.2);
      padBus.gain.exponentialRampToValueAtTime(0.0001, t + 9.5);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      padBus.connect(f);
      f.connect(this.ambience);
      f.connect(this.reverb);
      chord.forEach((freq) => {
        [-6, 6].forEach((detune) => {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = freq;
          o.detune.value = detune;
          o.connect(padBus);
          o.start(t);
          o.stop(t + 9.6);
        });
      });
      // a few crystal chimes on top, pentatonic
      const pent = [523.25, 587.33, 698.46, 783.99, 880, 1046.5];
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.6) {
          const at = 1 + Math.random() * 6;
          const fr = pent[Math.floor(Math.random() * pent.length)];
          if (this.enabled) this.bell(fr, at, 0.022);
        }
      }
    };
    playChord();
    window.setInterval(playChord, 8000);
  }
}

export const sound = new SoundEngine();
