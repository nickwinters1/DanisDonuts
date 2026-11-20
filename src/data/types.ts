import type { FlavorId, StickerId } from '../components/art';

export interface Message {
  id: string;
  createdAt: string;
  name: string;
  handle?: string | null;
  body: string;
  flavor: FlavorId;
  sticker?: StickerId | null;
  since?: number | null;
  mediaUrl?: string | null;
  font?: 'hand' | 'clean' | null;
  hearts: number;
  number?: number | null;
  approved?: boolean;
  /** Local-only: the visitor's own message that is waiting for approval. */
  pending?: boolean;
  /** Local-only: a sample shown in Preview Mode. */
  sample?: boolean;
}

export type NewMessage = Pick<Message, 'name' | 'handle' | 'body' | 'flavor' | 'sticker' | 'since' | 'mediaUrl' | 'font'>;

export interface Score {
  name: string;
  score: number;
  createdAt: string;
}

export type ChangeEvent = { type: 'upsert'; message: Message } | { type: 'delete'; id: string };

export interface AdminApi {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  isSignedIn(): Promise<boolean>;
  listAll(): Promise<Message[]>;
  setApproved(id: string, approved: boolean): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface Store {
  mode: 'local' | 'supabase';
  autoApprove: boolean;
  canUpload: boolean;
  list(): Promise<Message[]>;
  add(input: NewMessage): Promise<{ message: Message; pending: boolean }>;
  heart(id: string): Promise<void>;
  boops(): Promise<number>;
  boop(count: number): Promise<number | null>;
  uploadMedia(file: Blob, ext: string): Promise<string>;
  topScores(): Promise<Score[]>;
  addScore(name: string, score: number): Promise<void>;
  subscribe(cb: (e: ChangeEvent) => void): () => void;
  admin: AdminApi;
}
