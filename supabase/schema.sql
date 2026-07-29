-- COOPR cloud Postgres schema (sync target). Mirrors the local SQLite tables in
-- packages/core/src/db/schema.ts column-for-column, plus an owner_id for row-level
-- security. The local SyncEngine does last-write-wins by updated_at; this side is a
-- durable, per-user mirror. Idempotent: safe to re-run.
--
-- Design notes:
--   * id columns are text (they hold client-generated UUIDv7 strings).
--   * owner_id uuid defaults to auth.uid(), so the app never sends it; the FK to
--     auth.users(id) on delete cascade is what makes account deletion remove all rows.
--   * The `users` mirror table is NOT synced (Supabase auth.users is authoritative).
--   * changes_since strips owner_id so the payload matches local columns exactly.

-- ---- Tables -----------------------------------------------------------------

create table if not exists golfer_profiles (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_id text, name text, handicap double precision, risk_preference text,
  caddie_profile_id text, distance_unit text, partial_wedge_system text, notes text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists caddie_profiles (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_id text, name text, voice text, personality text, humor_level double precision,
  detail_level double precision, coaching_style text, avatar text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists bags (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_id text, name text, is_active integer,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists clubs (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bag_id text, type text, label text, manufacturer text, model text, loft_deg double precision,
  shaft_flex text, shaft_model text, shaft_material text, bounce_deg double precision, in_bag integer,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists club_feedback (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  club_id text, confidence text, note text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists sessions (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_id text, date bigint, environment text, intent text, validation_required integer, notes text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists shots (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id text, club_id text, club_label text, loft_deg double precision,
  session_id text, session_date bigint, shot_number integer, environment text, swing_mode text,
  carry_yards double precision, total_yards double precision, offline_yards double precision, side text,
  club_speed_mph double precision, ball_speed_mph double precision, smash_factor double precision,
  launch_angle_deg double precision, spin_rate_rpm double precision, spin_axis_deg double precision,
  peak_height_yards double precision, landing_angle_deg double precision, attack_angle_deg double precision,
  club_path_deg double precision, face_angle_deg double precision, face_to_path_deg double precision,
  dynamic_loft_deg double precision, impact_height double precision, impact_offset double precision,
  quality_label text, quality_reason text, source text, source_image text, notes text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);
create index if not exists idx_shots_owner_updated on shots (owner_id, updated_at);

create table if not exists calibration_profiles (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id text, scope text, club_id text, status text, delta_min_yards double precision,
  delta_max_yards double precision, confidence text, apply_automatically integer, note text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists recommendations (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  player_id text, input text, output text, created_at_ms bigint,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists rounds (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_id text, course_id text, course_name text, tees text, date bigint, status text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists hole_scores (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  round_id text, hole integer, par integer, strokes integer, putts integer, penalties integer,
  fairway text, gir integer, bunker integer, notes text, clubs_used text,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists course_shots (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  round_id text, hole integer, shot_number integer, club_id text, start_lat double precision,
  start_lon double precision, end_lat double precision, end_lon double precision,
  measured_distance_yards double precision, lie_start text, lie_end text, strategic_target text,
  result text, penalty integer, "timestamp" bigint,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

create table if not exists integration_connections (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_id text, service text, state text, last_sync_at bigint,
  created_at bigint, updated_at bigint not null default 0, deleted_at bigint
);

-- ---- Row-level security, policies, grants (idempotent) ----------------------

do $$
declare
  t text;
  tables text[] := array[
    'golfer_profiles','caddie_profiles','bags','clubs','club_feedback','sessions','shots',
    'calibration_profiles','recommendations','rounds','hole_scores','course_shots','integration_connections'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists %I on %I;', t || '_owner', t);
    execute format(
      'create policy %I on %I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());',
      t || '_owner', t
    );
    execute format('grant select, insert, update, delete on %I to authenticated;', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;

-- ---- Pull endpoint ----------------------------------------------------------
-- Returns every row the caller owns that changed after a watermark, with owner_id
-- stripped so `data` matches the local column set exactly. The app calls this via
-- rpc('changes_since', { since_ms }).

create or replace function changes_since(since_ms bigint)
returns table (tbl text, id text, updated_at bigint, deleted_at bigint, data jsonb)
language sql stable security invoker as $$
  select 'golfer_profiles', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from golfer_profiles x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'caddie_profiles', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from caddie_profiles x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'bags', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from bags x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'clubs', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from clubs x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'club_feedback', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from club_feedback x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'sessions', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from sessions x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'shots', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from shots x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'calibration_profiles', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from calibration_profiles x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'recommendations', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from recommendations x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'rounds', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from rounds x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'hole_scores', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from hole_scores x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'course_shots', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from course_shots x where x.owner_id = auth.uid() and x.updated_at > since_ms
  union all select 'integration_connections', x.id, x.updated_at, x.deleted_at, to_jsonb(x) - 'owner_id' from integration_connections x where x.owner_id = auth.uid() and x.updated_at > since_ms;
$$;

grant execute on function changes_since(bigint) to authenticated;
