-- Realtime for the desktop client.
--
-- Supabase Realtime only broadcasts changes for tables in the `supabase_realtime`
-- publication. Without this, `postgres_changes` channels on these tables
-- subscribe successfully and then never fire — which looks like a client bug.
--
-- Row-level security still applies: Realtime checks the subscriber's JWT against
-- the table's RLS policies before delivering a row, so a user only ever receives
-- their own. The `user_id=eq.<uid>` filter on the client is a bandwidth
-- optimisation, not the security boundary.
--
-- Idempotent: `add table` errors if the table is already a publication member,
-- so each is guarded on pg_publication_tables.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'focus_sessions'
  ) then
    alter publication supabase_realtime add table public.focus_sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'session_tags'
  ) then
    alter publication supabase_realtime add table public.session_tags;
  end if;
end
$$;

-- Sessions are soft-deleted (deleted_at set via UPDATE), so the default
-- REPLICA IDENTITY is enough: the client sees the tombstone as an UPDATE and
-- drops the row. A true DELETE would arrive carrying only the primary key —
-- handled client-side, and the row disappears on next reload either way. Not
-- switching to REPLICA IDENTITY FULL, which doubles WAL volume for every
-- session write to serve a case that barely happens.
