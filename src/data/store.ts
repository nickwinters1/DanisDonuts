import { config } from '../config';
import { createLocalStore } from './local';
import type { Store } from './types';

let storePromise: Promise<Store> | null = null;

export const isLive = () => Boolean(config.supabase.url && config.supabase.anonKey);

export function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = isLive()
      ? import('./supabase')
          .then((m) => m.createSupabaseStore(config.supabase.url, config.supabase.anonKey, config.supabase.autoApprove))
          .catch((err) => {
            console.error('[Dani’s Donuts] Could not connect to Supabase, falling back to Preview Mode.', err);
            return createLocalStore();
          })
      : Promise.resolve(createLocalStore());
  }
  return storePromise;
}
