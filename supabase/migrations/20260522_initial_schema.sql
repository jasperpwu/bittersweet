-- ============================================================
-- Bittersweet: Initial Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. PROFILES
-- Auto-created on signup via trigger (below)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'premium')),
  subscription_expires_at timestamptz,
  original_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. SESSION TAGS
create table if not exists public.session_tags (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '',
  color text not null default '#6592E9',
  usage_count integer not null default 0,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_session_tags_user on public.session_tags(user_id);

alter table public.session_tags enable row level security;

create policy "Users can read own tags"
  on public.session_tags for select
  using (auth.uid() = user_id);

create policy "Users can insert own tags"
  on public.session_tags for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tags"
  on public.session_tags for update
  using (auth.uid() = user_id);

create policy "Users can delete own tags"
  on public.session_tags for delete
  using (auth.uid() = user_id);

-- 3. FOCUS SESSIONS
create table if not exists public.focus_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration integer not null,
  initial_set_duration integer,
  actual_duration integer,
  adjusted_duration integer,
  tag_id text not null,
  notes text,
  is_paused boolean not null default false,
  total_pause_time integer not null default 0,
  is_manual_entry boolean not null default false,
  accelerate_multiplier integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_focus_sessions_user on public.focus_sessions(user_id);
create index idx_focus_sessions_user_start on public.focus_sessions(user_id, start_time);

alter table public.focus_sessions enable row level security;

create policy "Users can read own sessions"
  on public.focus_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.focus_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.focus_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.focus_sessions for delete
  using (auth.uid() = user_id);

-- 4. FOCUS GOALS
create table if not exists public.focus_goals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_minutes integer not null,
  period text not null default 'daily' check (period in ('daily', 'weekly', 'monthly')),
  tag_ids text[] not null default '{}',
  is_active boolean not null default true,
  is_repeating boolean not null default true,
  show_total_hours boolean not null default false,
  current_progress integer not null default 0,
  last_reset_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_focus_goals_user on public.focus_goals(user_id);

alter table public.focus_goals enable row level security;

create policy "Users can read own goals"
  on public.focus_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.focus_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.focus_goals for update
  using (auth.uid() = user_id);

create policy "Users can delete own goals"
  on public.focus_goals for delete
  using (auth.uid() = user_id);

-- 5. REWARDS
create table if not exists public.rewards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  total_earned integer not null default 0,
  total_spent integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.rewards enable row level security;

create policy "Users can read own rewards"
  on public.rewards for select
  using (auth.uid() = user_id);

create policy "Users can insert own rewards"
  on public.rewards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own rewards"
  on public.rewards for update
  using (auth.uid() = user_id);

-- 6. SUBSCRIPTION RECEIPTS
create table if not exists public.subscription_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  original_transaction_id text,
  expires_date timestamptz,
  raw_receipt jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.subscription_receipts enable row level security;

create policy "Users can read own receipts"
  on public.subscription_receipts for select
  using (auth.uid() = user_id);

-- Service role inserts/updates receipts via edge function (no user policy needed)

-- ============================================================
-- 8. TRIGGER: Auto-create profile + rewards on new user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.rewards (user_id)
  values (new.id);

  return new;
end;
$$;

-- Drop if exists to make re-running safe
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 9. Auto-update updated_at timestamps
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_session_tags_updated_at
  before update on public.session_tags
  for each row execute function public.set_updated_at();

create trigger set_focus_sessions_updated_at
  before update on public.focus_sessions
  for each row execute function public.set_updated_at();

create trigger set_focus_goals_updated_at
  before update on public.focus_goals
  for each row execute function public.set_updated_at();

create trigger set_rewards_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

create trigger set_subscription_receipts_updated_at
  before update on public.subscription_receipts
  for each row execute function public.set_updated_at();
