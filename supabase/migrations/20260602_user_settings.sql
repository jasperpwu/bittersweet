-- ============================================================
-- User Settings: sync user preferences to cloud
-- Object/value pattern — one row per user
-- ============================================================

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system',
  language text not null default 'en',
  notifications_enabled boolean not null default true,
  notifications_sound boolean not null default true,
  notifications_vibration boolean not null default true,
  goal_reminder_enabled boolean not null default true,
  goal_reminder_time text not null default '20:00',
  default_duration integer not null default 25,
  timer_picker_style text not null default 'scroller',
  rest_days integer[] not null default '{0,6}',
  week_start_day integer not null default 1,
  last_duration_by_tag jsonb not null default '{}',
  has_seen_onboarding boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Users can read own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Auto-create settings row on signup (update existing trigger function)
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

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$;
