import { load, save } from '../lib/storage';
import { sampleMessages } from './samples';
import type { ChangeEvent, Message, NewMessage, Score, Store } from './types';

/** Preview Mode: everything lives in this browser. Great for building + demoing. */
export function createLocalStore(): Store {
  const listeners = new Set<(e: ChangeEvent) => void>();
  const own = () => load<Message[]>('local-messages', []);
  const hearts = () => load<Record<string, number>>('local-hearts', {});

  const all = (): Message[] => {
    const h = hearts();
    const samples = load<boolean>('local-hide-samples', false) ? [] : sampleMessages();
    return [...samples, ...own()].map((m) => ({ ...m, hearts: m.hearts + (h[m.id] ?? 0) }));
  };

  return {
    mode: 'local',
    autoApprove: true,
    canUpload: true,
    async list() {
      return all();
    },
    async add(input: NewMessage) {
      const list = own();
      const message: Message = {
        ...input,
        id: `local-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        hearts: 0,
        number: all().length + 1,
        approved: true,
      };
      list.push(message);
      if (!save('local-messages', list)) throw new Error('Your browser storage is full or blocked.');
      listeners.forEach((fn) => fn({ type: 'upsert', message }));
      return { message, pending: false };
    },
    async heart(id: string) {
      const h = hearts();
      h[id] = (h[id] ?? 0) + 1;
      save('local-hearts', h);
    },
    async boops() {
      return load<number>('local-boops', 1337);
    },
    async boop(count: number) {
      const next = load<number>('local-boops', 1337) + count;
      save('local-boops', next);
      return next;
    },
    async uploadMedia(file: Blob) {
      // Preview Mode keeps a small data URL so you can see how photos look.
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },
    async topScores() {
      return load<Score[]>('local-scores', [])
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    },
    async addScore(name: string, score: number) {
      const scores = load<Score[]>('local-scores', []);
      scores.push({ name, score, createdAt: new Date().toISOString() });
      save('local-scores', scores.sort((a, b) => b.score - a.score).slice(0, 50));
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    admin: {
      async signIn() {},
      async signOut() {},
      async isSignedIn() {
        return true;
      },
      async listAll() {
        return all();
      },
      async setApproved() {},
      async remove(id: string) {
        if (id.startsWith('sample-')) {
          save('local-hide-samples', true);
        } else {
          save('local-messages', own().filter((m) => m.id !== id));
        }
        listeners.forEach((fn) => fn({ type: 'delete', id }));
      },
    },
  };
}
