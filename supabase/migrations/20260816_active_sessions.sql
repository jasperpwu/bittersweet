-- Live (not-yet-finished) focus sessions, so a session started on one device can
-- be followed on another.
--
-- `focus_sessions.end_time` is NOT NULL, so that table can only ever hold a
-- finished session. Rather than relax that constraint — every consumer of
-- focus_sessions (duration math, fruits, goals, streaks, insights) assumes a
-- completed row — a running session gets its own record here and is moved into
-- focus_sessions on stop.
--
-- PRIMARY KEY on user_id, not a surrogate id: a user has at most one live
-- session, and making that a key constraint means the "both devices started at
-- once" case is rejected by the database instead of reconciled by client merge
-- logic.
--
-- `session_id` is chosen by whichever client starts the session and is the id the
-- finished focus_sessions row will use. This is what stops a two-device finish
-- from producing duplicates: iOS's createCompletedSession already accepts a
-- caller-supplied id for exactly this reason (see src/store/index.ts) so the
-- local row and the remote write converge on one id.

create table if not exists public.active_sessions (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  -- id the finished focus_sessions row will be written under
  session_id     text not null,
  tag_id         text not null,
  started_at     timestamptz not null,
  -- null while running; set on stop. See the note on ended_at below.
  ended_at       timestamptz,
  -- null = infinite / count-up session
  target_minutes integer,
  origin         text not null check (origin in ('ios', 'desktop')),
  stopped_by     text check (stopped_by in ('ios', 'desktop')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Stopping sets ended_at rather than deleting the row, deliberately.
--
-- A DELETE only reaches Realtime subscribers carrying the primary key (unless the
-- table is REPLICA IDENTITY FULL), and a subscriber that misses the stop event is
-- left running a timer forever — the one failure mode that actually hurts. An
-- UPDATE always delivers the full new record, so followers see the stop reliably.
-- The row is then reused by the next start rather than accumulating.

alter table public.active_sessions enable row level security;

drop policy if exists "Users can read own active session" on public.active_sessions;
create policy "Users can read own active session"
  on public.active_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own active session" on public.active_sessions;
create policy "Users can insert own active session"
  on public.active_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own active session" on public.active_sessions;
create policy "Users can update own active session"
  on public.active_sessions for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own active session" on public.active_sessions;
create policy "Users can delete own active session"
  on public.active_sessions for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Start / stop RPCs
-- ============================================================
--
-- These exist because the invariant "one live session per user, second start
-- loses" cannot be expressed through PostgREST: an upsert there cannot carry a
-- WHERE on the DO UPDATE branch, so a plain client-side upsert would happily
-- overwrite a session already running on the other device, and a read-then-write
-- check would be racy.
--
-- Both are SECURITY INVOKER: RLS still applies, so these grant no reach beyond
-- what the caller already has. auth.uid() supplies user_id — a client cannot
-- start a session on someone else's behalf by passing a different id.

-- Returns the new live row, or NULL when a session is already running (the
-- caller should surface "already running on your other device" rather than retry).
create or replace function public.start_active_session(
  p_session_id     text,
  p_tag_id         text,
  p_started_at     timestamptz,
  p_target_minutes integer,
  p_origin         text
) returns public.active_sessions
language plpgsql
security invoker
as $$
declare
  v_row public.active_sessions;
begin
  insert into public.active_sessions as a (
    user_id, session_id, tag_id, started_at, ended_at,
    target_minutes, origin, stopped_by, updated_at
  ) values (
    auth.uid(), p_session_id, p_tag_id, p_started_at, null,
    p_target_minutes, p_origin, null, now()
  )
  -- Only reuse the row when the previous session has finished. A still-running
  -- session makes this a no-op, and v_row stays NULL.
  on conflict (user_id) do update
     set session_id     = excluded.session_id,
         tag_id         = excluded.tag_id,
         started_at     = excluded.started_at,
         ended_at       = null,
         target_minutes = excluded.target_minutes,
         origin         = excluded.origin,
         stopped_by     = null,
         updated_at     = now()
   where a.ended_at is not null
  returning * into v_row;

  return v_row;
end;
$$;

-- Returns the stopped row, or NULL when nothing was running (already stopped, or
-- stopped concurrently by the other device — both are no-ops, not errors).
create or replace function public.stop_active_session(
  p_stopped_by text
) returns public.active_sessions
language plpgsql
security invoker
as $$
declare
  v_row public.active_sessions;
begin
  update public.active_sessions
     set ended_at   = now(),
         stopped_by = p_stopped_by,
         updated_at = now()
   where user_id = auth.uid()
     and ended_at is null
  returning * into v_row;

  return v_row;
end;
$$;

-- Realtime: the whole point of the table is that the other device hears about it.
-- Guarded the same way as 20260816_realtime_focus_sessions.sql — `add table`
-- errors if the table is already a publication member.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'active_sessions'
  ) then
    alter publication supabase_realtime add table public.active_sessions;
  end if;
end
$$;
