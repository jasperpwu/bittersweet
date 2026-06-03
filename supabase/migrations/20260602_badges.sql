-- ============================================================
-- Badges: sync concluded goal badges to cloud
-- List pattern — same as focus_goals/session_tags
-- ============================================================

create table public.badges (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id text,
  tag_icon text not null default '',
  tag_name text not null default '',
  tag_color text not null default '',
  goal_name text not null default '',
  total_minutes integer not null default 0,
  total_sessions integer not null default 0,
  daily_stats jsonb,
  weekly_stats jsonb,
  monthly_stats jsonb,
  duration_distribution jsonb not null default '{}',
  notes_count integer not null default 0,
  recent_notes jsonb not null default '[]',
  start_date text not null default '',
  end_date text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_badges_user on public.badges(user_id);

alter table public.badges enable row level security;

create policy "Users can read own badges"
  on public.badges for select
  using (auth.uid() = user_id);

create policy "Users can insert own badges"
  on public.badges for insert
  with check (auth.uid() = user_id);

create policy "Users can update own badges"
  on public.badges for update
  using (auth.uid() = user_id);

create policy "Users can delete own badges"
  on public.badges for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger set_badges_updated_at
  before update on public.badges
  for each row execute function public.set_updated_at();
