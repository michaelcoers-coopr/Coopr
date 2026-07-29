-- COOPR cloud Postgres schema (sync target). Mirrors the local SQLite tables in
-- packages/core/src/db/schema.ts. Every synced table carries owner_id (for row-level
-- security), updated_at (ms epoch, bigint), and deleted_at (soft delete). The local
-- SyncEngine does last-write-wins by updated_at; this side is a durable mirror.
--
-- This file is the starting point: it covers the sync-critical tables and the RLS +
-- changes_since pattern. The remaining tables (recommendations, course_shots,
-- integration_connections, caddie_profiles) follow the identical shape. Run one
-- migration pass and verify against the app before shipping sync.

create extension if not exists "uuid-ossp";

-- Ownership + timestamps helper columns are repeated per table for clarity.

create table if not exists golfer_profiles (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text, handicap real, risk_preference text not null default 'neutral',
  caddie_profile_id uuid, distance_unit text not null default 'yards',
  partial_wedge_system text not null default 'percent', notes text,
  updated_at bigint not null, deleted_at bigint
);

create table if not exists bags (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My Bag', is_active integer not null default 1,
  updated_at bigint not null, deleted_at bigint
);

create table if not exists clubs (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  bag_id uuid not null, type text not null, label text not null,
  manufacturer text, model text, loft_deg real, shaft_flex text, shaft_model text,
  shaft_material text, bounce_deg real, in_bag integer not null default 1,
  updated_at bigint not null, deleted_at bigint
);

create table if not exists sessions (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  date bigint not null, environment text not null, intent text,
  validation_required integer not null default 0, notes text,
  updated_at bigint not null, deleted_at bigint
);

create table if not exists shots (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null, club_id uuid not null, club_label text not null, loft_deg real,
  session_id uuid not null, session_date bigint not null, shot_number integer,
  environment text not null, swing_mode text not null,
  carry_yards real, total_yards real, offline_yards real, side text,
  club_speed_mph real, ball_speed_mph real, smash_factor real,
  launch_angle_deg real, spin_rate_rpm real, spin_axis_deg real,
  peak_height_yards real, landing_angle_deg real, attack_angle_deg real,
  club_path_deg real, face_angle_deg real, face_to_path_deg real, dynamic_loft_deg real,
  impact_height real, impact_offset real, quality_label text, quality_reason text,
  source text, source_image text, notes text,
  updated_at bigint not null, deleted_at bigint
);
create index if not exists idx_shots_owner_updated on shots (owner_id, updated_at);

create table if not exists calibration_profiles (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null, scope text not null, club_id uuid, status text not null,
  delta_min_yards real, delta_max_yards real, confidence text not null,
  apply_automatically integer not null default 0, note text,
  updated_at bigint not null, deleted_at bigint
);

create table if not exists rounds (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  course_id text, course_name text, tees text, date bigint not null,
  status text not null default 'in_progress',
  updated_at bigint not null, deleted_at bigint
);

create table if not exists hole_scores (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  round_id uuid not null, hole integer not null, par integer, strokes integer,
  putts integer, penalties integer, fairway text, gir integer, bunker integer,
  notes text, clubs_used jsonb,
  updated_at bigint not null, deleted_at bigint
);

-- Row-level security: a user sees and writes only their own rows.
do $$
declare t text;
begin
  foreach t in array array['golfer_profiles','bags','clubs','sessions','shots','calibration_profiles','rounds','hole_scores']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format($p$create policy %I on %I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());$p$, t || '_owner', t);
  end loop;
end $$;

-- Pull endpoint: all rows the caller owns changed after a watermark. The app calls
-- this via rpc('changes_since', { since_ms }). Extend the union with the remaining
-- tables as they come online.
create or replace function changes_since(since_ms bigint)
returns table (tbl text, id uuid, updated_at bigint, deleted_at bigint, data jsonb)
language sql stable security invoker as $$
  select 'shots', s.id, s.updated_at, s.deleted_at, to_jsonb(s) from shots s
    where s.owner_id = auth.uid() and s.updated_at > since_ms
  union all
  select 'sessions', x.id, x.updated_at, x.deleted_at, to_jsonb(x) from sessions x
    where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all
  select 'clubs', c.id, c.updated_at, c.deleted_at, to_jsonb(c) from clubs c
    where c.owner_id = auth.uid() and c.updated_at > since_ms
  union all
  select 'bags', b.id, b.updated_at, b.deleted_at, to_jsonb(b) from bags b
    where b.owner_id = auth.uid() and b.updated_at > since_ms
  union all
  select 'golfer_profiles', g.id, g.updated_at, g.deleted_at, to_jsonb(g) from golfer_profiles g
    where g.owner_id = auth.uid() and g.updated_at > since_ms;
$$;
