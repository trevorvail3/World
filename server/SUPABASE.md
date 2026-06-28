# World shared leaderboard — Supabase setup (one-time, ~2 minutes)

World reuses your **existing Supabase project** (the same one the idle game uses
for sign-in). Players sign into World with the **same email + password**, and
their scores attach to their real account. You only need to create one table.

The project URL and publishable key are already baked into the game
(`src/client/supabase.ts`) — they're public by design; security is the
Row-Level-Security (RLS) rules below.

## Create the table + security rules

1. Open your Supabase dashboard → **SQL Editor** → **New query**.
2. Paste **all** of this and click **Run**:

```sql
-- One row per signed-in user: their best World character's stats.
create table if not exists public.world_hiscores (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  name          text not null,
  total_level   integer not null default 0,
  combat        integer not null default 0,
  play_ms       bigint  not null default 0,
  diaries       integer not null default 0,
  monsters_slain integer not null default 0,
  gold_earned   bigint  not null default 0,
  updated_at    timestamptz not null default now()
);

-- Turn on Row-Level Security and define who can do what.
alter table public.world_hiscores enable row level security;

-- Anyone (even signed-out) can READ the board.
drop policy if exists "world_hiscores_read" on public.world_hiscores;
create policy "world_hiscores_read"
  on public.world_hiscores for select
  using (true);

-- You can INSERT only your own row.
drop policy if exists "world_hiscores_insert_own" on public.world_hiscores;
create policy "world_hiscores_insert_own"
  on public.world_hiscores for insert
  with check (auth.uid() = user_id);

-- You can UPDATE only your own row (the upsert path).
drop policy if exists "world_hiscores_update_own" on public.world_hiscores;
create policy "world_hiscores_update_own"
  on public.world_hiscores for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

That's it. Open the game → **World** tab → **Hiscores** → **Sign in** with your
idle-game account. Your stats upload each time you open the board, and the
rankings are shared with everyone who plays World.

## Cloud saves — second table (run this too)

So a character follows your account to any device, add the saves table. Same SQL
editor, paste and **Run**:

```sql
-- One row per signed-in user: their character's full save blob.
create table if not exists public.world_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.world_saves enable row level security;

-- Saves are PRIVATE: you can only read your own.
drop policy if exists "world_saves_read_own" on public.world_saves;
create policy "world_saves_read_own"
  on public.world_saves for select
  using (auth.uid() = user_id);

-- And only write/replace/delete your own.
drop policy if exists "world_saves_insert_own" on public.world_saves;
create policy "world_saves_insert_own"
  on public.world_saves for insert
  with check (auth.uid() = user_id);

drop policy if exists "world_saves_update_own" on public.world_saves;
create policy "world_saves_update_own"
  on public.world_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "world_saves_delete_own" on public.world_saves;
create policy "world_saves_delete_own"
  on public.world_saves for delete
  using (auth.uid() = user_id);
```

Now your character loads from the cloud at sign-in and uploads as you play. Sign
in on another device and the same character is there. (Unlike the hiscores
board, saves are private — the RLS rules above let you read only your own.)

## Ghosts — third table (run this too)

So you can see other signed-in players moving around the world as translucent
"ghosts". Each player publishes a lightweight presence (position + look + zone);
everyone reads the recent ones for their area. Same SQL editor, paste and **Run**:

```sql
-- One row per signed-in user: where they are right now.
create table if not exists public.world_presence (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text,
  x          double precision not null default 0,
  y          double precision not null default 0,
  zone       text not null default 'overworld',
  look       jsonb,
  updated_at timestamptz not null default now()
);

alter table public.world_presence enable row level security;

-- Anyone signed in can SEE everyone's presence (that's the point of ghosts).
drop policy if exists "world_presence_read" on public.world_presence;
create policy "world_presence_read"
  on public.world_presence for select
  using (true);

-- But you can only write/replace your own position.
drop policy if exists "world_presence_insert_own" on public.world_presence;
create policy "world_presence_insert_own"
  on public.world_presence for insert
  with check (auth.uid() = user_id);

drop policy if exists "world_presence_update_own" on public.world_presence;
create policy "world_presence_update_own"
  on public.world_presence for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

That's the last table. Now when two signed-in players are in the same area,
they'll see each other as faint figures with name labels. (Players inside their
own house don't show to others — interiors are private instances.)

## How it works
- **Read** is public: anyone can see the rankings, even before signing in.
- **Write** is locked to the owner: the RLS rules mean a signed-in user can only
  create/update *their own* row — no one can overwrite someone else's score.
- One row per user (`user_id` primary key), upserted on each board open, so the
  board always reflects each player's latest character.

## Notes
- Uses the project's **publishable** key (`sb_publishable_…`), which is safe in
  the browser. The secret `service_role` key is never used by the game.
- If sign-up says "check your email", your project has email confirmation on
  (Supabase default). Existing idle-game accounts just **sign in** — no
  confirmation needed.
