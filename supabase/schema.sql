-- ════════════════════════════════════════════════════════════════════════════
--  DANI'S DONUTS — Supabase schema
--  Paste this whole file into Supabase → SQL Editor → New query → Run.
--  Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════

-- ───────── Messages (the Donut Wall) ─────────
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  number      bigint generated always as identity,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  handle      text check (handle is null or handle ~ '^[A-Za-z0-9_]{1,25}$'),
  body        text not null check (char_length(btrim(body)) between 2 and 1000),
  flavor      text not null default 'strawberry'
              check (flavor in ('strawberry','lagoon','amethyst','seafoam','lemon','peach','cocoa','cotton','galaxy','vanilla','holo')),
  sticker     text check (sticker is null or sticker in ('donut','crystal','heart','star','shell','palm','wave','sun','controller','trophy','gg','crown')),
  since       smallint check (since is null or since between 2010 and 2100),
  media_url   text check (media_url is null or (char_length(media_url) <= 600 and media_url like 'https://%')),
  font        text not null default 'clean' check (font in ('clean','hand')),
  hearts      integer not null default 0,
  approved    boolean not null default false
);
create index if not exists messages_created_idx on public.messages (created_at);

-- ───────── Organizers (moderators) ─────────
-- After creating your account (Authentication → Users → Add user), run:
--   insert into public.organizers (email) values ('you@example.com');
create table if not exists public.organizers (email text primary key);
alter table public.organizers enable row level security; -- no policies: only editable from the SQL editor

create or replace function public.is_organizer() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organizers
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- The server, not the browser, decides approval and starting hearts.
create or replace function public.messages_before_insert() returns trigger
language plpgsql as $$
begin
  new.hearts := 0;
  new.created_at := now();
  -- ⬇ MODERATION
  --   false → every message waits for an organizer to approve it at  /#/admin  (recommended)
  --   true  → messages go straight onto the wall (then also set supabase.autoApprove = true in src/config.ts)
  new.approved := false;
  return new;
end $$;

drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

alter table public.messages enable row level security;

drop policy if exists "read approved" on public.messages;
create policy "read approved" on public.messages
  for select to anon, authenticated using (approved or public.is_organizer());

drop policy if exists "anyone can bake" on public.messages;
create policy "anyone can bake" on public.messages
  for insert to anon, authenticated with check (true);

drop policy if exists "organizers update" on public.messages;
create policy "organizers update" on public.messages
  for update to authenticated using (public.is_organizer()) with check (public.is_organizer());

drop policy if exists "organizers delete" on public.messages;
create policy "organizers delete" on public.messages
  for delete to authenticated using (public.is_organizer());

-- Hearts: one tap = +1, only on approved messages.
create or replace function public.heart_message(msg_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.messages set hearts = hearts + 1 where id = msg_id and approved;
$$;
grant execute on function public.heart_message(uuid) to anon, authenticated;

-- ───────── Global donut boop counter ─────────
create table if not exists public.counters (
  key   text primary key,
  value bigint not null default 0
);
insert into public.counters (key, value) values ('boops', 0) on conflict (key) do nothing;
alter table public.counters enable row level security;
drop policy if exists "read counters" on public.counters;
create policy "read counters" on public.counters for select to anon, authenticated using (true);

create or replace function public.boop(amount int) returns bigint
language sql security definer set search_path = public as $$
  update public.counters
     set value = value + greatest(1, least(coalesce(amount, 1), 50))
   where key = 'boops'
  returning value;
$$;
grant execute on function public.boop(int) to anon, authenticated;

-- ───────── Donut Drop leaderboard ─────────
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(btrim(name)) between 1 and 20),
  score       integer not null check (score between 0 and 99999)
);
create index if not exists scores_score_idx on public.scores (score desc);
alter table public.scores enable row level security;
drop policy if exists "read scores" on public.scores;
create policy "read scores" on public.scores for select to anon, authenticated using (true);
drop policy if exists "post scores" on public.scores;
create policy "post scores" on public.scores for insert to anon, authenticated with check (true);
drop policy if exists "organizers delete scores" on public.scores;
create policy "organizers delete scores" on public.scores for delete to authenticated using (public.is_organizer());

-- ───────── Photo uploads (public bucket, images only, 5 MB max) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "anyone can upload media" on storage.objects;
create policy "anyone can upload media" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'media');

drop policy if exists "organizers manage media" on storage.objects;
create policy "organizers manage media" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and public.is_organizer());

-- ───────── Realtime: new + approved messages appear live for everyone ─────────
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
