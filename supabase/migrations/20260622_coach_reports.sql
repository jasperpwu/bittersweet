-- ============================================================
-- Coach reports: weekly AI Focus Coach reports synced to cloud
-- List pattern — same as badges/focus_goals/session_tags
-- sub_scores / stats / cards are JSONB blobs written/read as-is.
-- ============================================================

create table public.coach_reports (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start timestamptz not null,
  week_end timestamptz not null,
  focus_score integer not null default 0,
  sub_scores jsonb not null default '{}',
  stats jsonb not null default '{}',
  cards jsonb not null default '[]',
  narrator text not null default 'template',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_coach_reports_user on public.coach_reports(user_id);
create index idx_coach_reports_user_week on public.coach_reports(user_id, week_start);

alter table public.coach_reports enable row level security;

create policy "Users can read own coach reports"
  on public.coach_reports for select
  using (auth.uid() = user_id);

create policy "Users can insert own coach reports"
  on public.coach_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can update own coach reports"
  on public.coach_reports for update
  using (auth.uid() = user_id);

create policy "Users can delete own coach reports"
  on public.coach_reports for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger set_coach_reports_updated_at
  before update on public.coach_reports
  for each row execute function public.set_updated_at();
