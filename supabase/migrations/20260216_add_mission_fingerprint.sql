-- 1. Mission Refresh Log Table
create table public.mission_refresh_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_date date not null,
  category text not null,
  refresh_count int default 0,
  last_refresh_at timestamptz default now(),
  created_at timestamptz default now(),

  constraint uq_refresh_log unique (user_id, mission_date, category)
);

-- 2. Mission Fingerprint Table
create table public.mission_fingerprint (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_date date not null,
  category text not null check (
    category in (
      'body_wellness',
      'growth_career',
      'mind_connection',
      'funplay'
    )
  ),
  pattern_id text,
  primary_action text not null,        -- 핵심 동사
  tool text,                           -- phone, paper, none, etc
  place text,                          -- home, office, outdoor, commute
  social_context text,                  -- alone, with_people, either
  mechanic text,                       -- funplay mechanic
  created_at timestamptz default now(),

  constraint uq_user_date_category unique (user_id, mission_date, category)
);

-- Indexes
create index idx_mission_fp_user_date on public.mission_fingerprint(user_id, mission_date desc);
create index idx_mission_fp_pattern on public.mission_fingerprint(user_id, pattern_id);
create index idx_mission_fp_action on public.mission_fingerprint(user_id, primary_action);

-- 3. Enable RLS
alter table public.mission_refresh_log enable row level security;
alter table public.mission_fingerprint enable row level security;

-- 4. RLS Policies for mission_refresh_log
create policy "Users can read own refresh logs"
on public.mission_refresh_log for select
using (auth.uid() = user_id);

create policy "Users can insert own refresh logs"
on public.mission_refresh_log for insert
with check (auth.uid() = user_id);

create policy "Users can update own refresh logs"
on public.mission_refresh_log for update
using (auth.uid() = user_id);

-- 5. RLS Policies for mission_fingerprint
create policy "Users can read own fingerprints"
on public.mission_fingerprint for select
using (auth.uid() = user_id);

create policy "Users can insert own fingerprints"
on public.mission_fingerprint for insert
with check (auth.uid() = user_id);

-- Grant permissions (if needed for anon/authenticated roles, usually defaults are okay but being explicit helps)
grant select, insert, update on public.mission_refresh_log to authenticated;
grant select, insert on public.mission_fingerprint to authenticated;
grant select, insert, update on public.mission_refresh_log to service_role;
grant select, insert, delete on public.mission_fingerprint to service_role;
