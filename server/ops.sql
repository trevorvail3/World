-- server/ops.sql
-- ---------------
-- Launch-ops tables for Varath: bug reports + session telemetry.
-- Run this ONCE in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Until it's run, the game still works — ops calls fail silently and bug
-- reports fall back to the player's clipboard.
--
-- Reading either table is dashboard-only (no select policy for clients):
-- open Table Editor → bug_reports to read what players filed.

-- Bug reports: whatever the player wrote + the game's own state snapshot.
create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid null,          -- signed-in reporter (null for offline players)
  description text not null,
  state       jsonb,              -- position, levels, quest, recent errors
  ua          text,
  version     text
);

alter table public.bug_reports enable row level security;

-- Anyone may FILE a report (that's the point); nobody may read them back.
drop policy if exists "bug_reports_insert" on public.bug_reports;
create policy "bug_reports_insert" on public.bug_reports
  for insert to anon, authenticated with check (true);

-- Telemetry: one row per session start. Enough for daily players + retention.
create table if not exists public.telemetry (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id    uuid null,
  kind       text not null,       -- "session_start"
  version    text,
  ua         text
);

alter table public.telemetry enable row level security;

drop policy if exists "telemetry_insert" on public.telemetry;
create policy "telemetry_insert" on public.telemetry
  for insert to anon, authenticated with check (true);

-- Handy dashboard queries -----------------------------------------------------
-- Daily sessions:
--   select date_trunc('day', created_at) d, count(*) from telemetry
--   where kind = 'session_start' group by 1 order by 1 desc;
-- Day-2 return (signed-in players who came back the next day):
--   select count(distinct t2.user_id) from telemetry t1
--   join telemetry t2 on t2.user_id = t1.user_id
--    and date_trunc('day', t2.created_at) = date_trunc('day', t1.created_at) + interval '1 day'
--   where t1.user_id is not null;
