import { getStore } from './data/store';
import type { Message, Store } from './data/types';
import { Emitter } from './lib/emitter';
import { load, save } from './lib/storage';

interface Events {
  ready: Message[];
  added: Message;
  updated: Message;
  removed: string;
  [key: string]: unknown;
}

const sameMessage = (a: Message, b: Message) => a.name === b.name && a.body === b.body;

class AppState {
  messages: Message[] = [];
  store!: Store;
  ready = false;
  readonly events = new Emitter<Events>();

  async init() {
    this.store = await getStore();
    let list: Message[] = [];
    try {
      list = await this.store.list();
    } catch (err) {
      console.error('[Dani’s Donuts] Could not load messages', err);
    }
    // Your own messages that are still waiting for approval stay visible to you.
    const mine = load<Message[]>('my-pending', []).filter((p) => !list.some((m) => sameMessage(m, p)));
    save('my-pending', mine);
    this.messages = [...list, ...mine];
    this.ready = true;
    this.events.emit('ready', this.messages);

    this.store.subscribe((e) => {
      if (e.type === 'delete') {
        const before = this.messages.length;
        this.messages = this.messages.filter((m) => m.id !== e.id);
        if (this.messages.length !== before) this.events.emit('removed', e.id);
        return;
      }
      const msg = e.message;
      const pendingTwin = this.messages.find((m) => m.pending && sameMessage(m, msg));
      if (pendingTwin) {
        this.messages = this.messages.filter((m) => m !== pendingTwin);
        this.events.emit('removed', pendingTwin.id);
        save('my-pending', load<Message[]>('my-pending', []).filter((p) => !sameMessage(p, msg)));
      }
      const idx = this.messages.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        this.messages[idx] = msg;
        this.events.emit('updated', msg);
      } else {
        this.messages.push(msg);
        this.events.emit('added', msg);
      }
    });
  }

  /** Called after the visitor bakes a message. */
  addOwn(msg: Message, pending: boolean) {
    if (this.store.mode === 'local') return; // the local store already broadcast it
    if (pending) {
      const mine = load<Message[]>('my-pending', []);
      mine.push(msg);
      save('my-pending', mine);
    }
    this.messages.push(msg);
    this.events.emit('added', msg);
  }

  get approvedCount() {
    return this.messages.filter((m) => !m.pending).length;
  }
}

export const app = new AppState();
