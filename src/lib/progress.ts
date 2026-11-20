/* The visitor's own save file: XP, rank, crystals and trophies. Lives in localStorage. */
import { Emitter } from './emitter';
import { load, save } from './storage';
import type { CrystalId } from '../components/crystals';

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  xp: number;
  icon: string; // sticker id or crystal id
  secret?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'drop-in', title: 'Dropped In', desc: 'Pressed start. Welcome to the lobby.', xp: 25, icon: 'controller' },
  { id: 'baker', title: 'Master Baker', desc: 'Baked a message for Dani.', xp: 150, icon: 'donut' },
  { id: 'reader', title: 'Card Collector', desc: 'Opened 10 cards on the wall.', xp: 60, icon: 'star' },
  { id: 'heart-eyes', title: 'Heart Eyes', desc: 'Gave 10 hearts.', xp: 50, icon: 'heart' },
  { id: 'first-crystal', title: 'Shiny!', desc: 'Found your first hidden crystal.', xp: 30, icon: 'crystal' },
  { id: 'geode', title: 'Geode', desc: 'Found all seven crystals.', xp: 300, icon: 'crown' },
  { id: 'arcade', title: 'Arcade Rat', desc: 'Played a round of Donut Drop.', xp: 40, icon: 'controller' },
  { id: 'high-roller', title: 'High Roller', desc: 'Scored 1,000+ in Donut Drop.', xp: 120, icon: 'trophy' },
  { id: 'booper', title: 'Professional Booper', desc: 'Booped the donut 25 times.', xp: 40, icon: 'donut' },
  { id: 'season-pass', title: 'Pass Complete', desc: 'Claimed every Season Pass tier.', xp: 100, icon: 'gg' },
  { id: 'wish', title: 'Make a Wish', desc: 'Blew out the birthday candle.', xp: 100, icon: 'star' },
  { id: 'presenter', title: 'On Air', desc: 'Opened Stream Mode.', xp: 30, icon: 'controller' },
  { id: 'konami', title: 'Up, Up, Down, Down…', desc: 'You know the code.', xp: 77, icon: 'gg', secret: true },
  { id: 'night-owl', title: 'Night Owl', desc: 'Visited between midnight and 4 a.m.', xp: 30, icon: 'star', secret: true },
];

export const RANKS = [
  { level: 1, name: 'Sprinkle', xp: 0 },
  { level: 2, name: 'Glazed', xp: 80 },
  { level: 3, name: 'Frosted', xp: 200 },
  { level: 4, name: 'Jelly-Filled', xp: 380 },
  { level: 5, name: 'Boston Cream', xp: 600 },
  { level: 6, name: 'Crystal Glaze', xp: 880 },
  { level: 7, name: 'Golden Ring', xp: 1220 },
  { level: 8, name: 'Holo Sprinkle', xp: 1620 },
  { level: 9, name: 'Prismatic', xp: 2100 },
  { level: 10, name: 'Legendary Donut', xp: 2700 },
];

interface SaveFile {
  xp: number;
  crystals: CrystalId[];
  achievements: string[];
  read: string[];
  hearted: string[];
  claimed: number[];
  boops: number;
  best: number;
  name: string;
  handle: string;
}

interface Events {
  xp: { xp: number; gained: number; reason?: string };
  level: { level: number; name: string };
  achievement: Achievement;
  crystal: CrystalId;
  change: SaveFile;
  [key: string]: unknown;
}

const DEFAULT: SaveFile = {
  xp: 0,
  crystals: [],
  achievements: [],
  read: [],
  hearted: [],
  claimed: [],
  boops: 0,
  best: 0,
  name: '',
  handle: '',
};

class Progress {
  data: SaveFile = { ...DEFAULT, ...load<Partial<SaveFile>>('save', {}) };
  readonly events = new Emitter<Events>();

  private persist() {
    save('save', this.data);
    this.events.emit('change', this.data);
  }

  rankFor(xp = this.data.xp) {
    let rank = RANKS[0];
    for (const r of RANKS) if (xp >= r.xp) rank = r;
    const next = RANKS.find((r) => r.level === rank.level + 1);
    const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
    return { ...rank, next, progress };
  }

  addXp(amount: number, reason?: string) {
    const before = this.rankFor();
    this.data.xp += amount;
    this.persist();
    this.events.emit('xp', { xp: this.data.xp, gained: amount, reason });
    const after = this.rankFor();
    if (after.level > before.level) this.events.emit('level', { level: after.level, name: after.name });
  }

  unlock(id: string) {
    if (this.data.achievements.includes(id)) return false;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return false;
    this.data.achievements.push(id);
    this.persist();
    this.events.emit('achievement', a);
    this.addXp(a.xp, a.title);
    return true;
  }

  has(id: string) {
    return this.data.achievements.includes(id);
  }

  collectCrystal(id: CrystalId) {
    if (this.data.crystals.includes(id)) return false;
    this.data.crystals.push(id);
    this.persist();
    this.events.emit('crystal', id);
    this.addXp(50, 'Crystal found');
    this.unlock('first-crystal');
    if (this.data.crystals.filter((c) => c !== 'heart').length >= 7) this.unlock('geode');
    return true;
  }

  markRead(id: string) {
    if (this.data.read.includes(id)) return;
    this.data.read.push(id);
    this.persist();
    this.addXp(5);
    if (this.data.read.length >= 10) this.unlock('reader');
  }

  markHearted(id: string) {
    if (this.data.hearted.includes(id)) return false;
    this.data.hearted.push(id);
    this.persist();
    this.addXp(3);
    if (this.data.hearted.length >= 10) this.unlock('heart-eyes');
    return true;
  }

  claimTier(tier: number, total: number) {
    if (this.data.claimed.includes(tier)) return false;
    this.data.claimed.push(tier);
    this.persist();
    this.addXp(15, `Tier ${tier}`);
    if (this.data.claimed.length >= total) this.unlock('season-pass');
    return true;
  }

  addBoops(n: number) {
    this.data.boops += n;
    this.persist();
    if (this.data.boops >= 25) this.unlock('booper');
  }

  setBest(score: number) {
    if (score <= this.data.best) return false;
    this.data.best = score;
    this.persist();
    return true;
  }

  setIdentity(name: string, handle: string) {
    this.data.name = name;
    this.data.handle = handle;
    this.persist();
  }

  reset() {
    this.data = { ...DEFAULT };
    this.persist();
  }
}

export const progress = new Progress();
