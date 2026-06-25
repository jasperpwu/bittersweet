-- ============================================================
-- TODOs: lightweight task planning surfaced in the Journal tab.
-- List pattern — same as session_tags / focus_goals / badges.
-- id / tag_id are text to match the app's generateId() ids and the
-- existing convention (focus_sessions.tag_id is plain text, no hard FK,
-- so sync ordering can never fail an FK check).
-- ============================================================

create table if not exists public.todos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  tag_id text not null,
  start_at timestamptz,
  duration_minutes integer,
  notes text,
  completed boolean not null default false,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_todos_user on public.todos(user_id);

alter table public.todos enable row level security;

create policy "Users can read own todos"
  on public.todos for select
  using (auth.uid() = user_id);

create policy "Users can insert own todos"
  on public.todos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own todos"
  on public.todos for update
  using (auth.uid() = user_id);

create policy "Users can delete own todos"
  on public.todos for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create trigger set_todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();
