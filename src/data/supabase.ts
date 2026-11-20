import type { SupabaseClient } from '@supabase/supabase-js';
import type { FlavorId, StickerId } from '../components/art';
import type { ChangeEvent, Message, NewMessage, Score, Store } from './types';

interface Row {
  id: string;
  created_at: string;
  name: string;
  handle: string | null;
  body: string;
  flavor: string;
  sticker: string | null;
  since: number | null;
  media_url: string | null;
  font: string | null;
  hearts: number;
  number: number | null;
  approved: boolean;
}

const fromRow = (r: Row): Message => ({
  id: r.id,
  createdAt: r.created_at,
  name: r.name,
  handle: r.handle,
  body: r.body,
  flavor: r.flavor as FlavorId,
  sticker: r.sticker as StickerId | null,
  since: r.since,
  mediaUrl: r.media_url,
  font: (r.font as Message['font']) ?? 'clean',
  hearts: r.hearts,
  number: r.number,
  approved: r.approved,
});

/** Live Mode: a shared wall for everyone, realtime, with organizer moderation. */
export async function createSupabaseStore(url: string, anonKey: string, autoApprove: boolean): Promise<Store> {
  const { createClient } = await import('@supabase/supabase-js');
  const db: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });

  return {
    mode: 'supabase',
    autoApprove,
    canUpload: true,
    async list() {
      const out: Message[] = [];
      const page = 1000;
      for (let from = 0; from < 20000; from += page) {
        const { data, error } = await db
          .from('messages')
          .select('*')
          .eq('approved', true)
          .order('created_at', { ascending: true })
          .range(from, from + page - 1);
        if (error) throw error;
        out.push(...(data as Row[]).map(fromRow));
        if (!data || data.length < page) break;
      }
      return out;
    },
    async add(input: NewMessage) {
      const { error } = await db.from('messages').insert({
        name: input.name,
        handle: input.handle || null,
        body: input.body,
        flavor: input.flavor,
        sticker: input.sticker || null,
        since: input.since || null,
        media_url: input.mediaUrl || null,
        font: input.font || 'clean',
      });
      if (error) throw error;
      const message: Message = {
        ...input,
        id: `mine-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        hearts: 0,
        approved: autoApprove,
        pending: !autoApprove,
      };
      return { message, pending: !autoApprove };
    },
    async heart(id: string) {
      await db.rpc('heart_message', { msg_id: id });
    },
    async boops() {
      const { data } = await db.from('counters').select('value').eq('key', 'boops').maybeSingle();
      return Number(data?.value ?? 0);
    },
    async boop(count: number) {
      const { data, error } = await db.rpc('boop', { amount: count });
      if (error) return null;
      return Number(data);
    },
    async uploadMedia(file: Blob, ext: string) {
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const { error } = await db.storage.from('media').upload(path, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw error;
      return db.storage.from('media').getPublicUrl(path).data.publicUrl;
    },
    async topScores() {
      const { data, error } = await db
        .from('scores')
        .select('name, score, created_at')
        .order('score', { ascending: false })
        .limit(10);
      if (error) return [];
      return (data ?? []).map((s) => ({ name: s.name, score: s.score, createdAt: s.created_at })) as Score[];
    },
    async addScore(name: string, score: number) {
      await db.from('scores').insert({ name, score });
    },
    subscribe(cb: (e: ChangeEvent) => void) {
      const channel = db
        .channel('messages-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<Row>;
            if (old.id) cb({ type: 'delete', id: old.id });
            return;
          }
          const row = payload.new as Row;
          if (row.approved) cb({ type: 'upsert', message: fromRow(row) });
          else cb({ type: 'delete', id: row.id });
        })
        .subscribe();
      return () => {
        db.removeChannel(channel);
      };
    },
    admin: {
      async signIn(email: string, password: string) {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signOut() {
        await db.auth.signOut();
      },
      async isSignedIn() {
        const { data } = await db.auth.getSession();
        return !!data.session;
      },
      async listAll() {
        const { data, error } = await db.from('messages').select('*').order('created_at', { ascending: false }).limit(5000);
        if (error) throw error;
        return (data as Row[]).map(fromRow);
      },
      async setApproved(id: string, approved: boolean) {
        const { error } = await db.from('messages').update({ approved }).eq('id', id);
        if (error) throw error;
      },
      async remove(id: string) {
        const { error } = await db.from('messages').delete().eq('id', id);
        if (error) throw error;
      },
    },
  };
}
