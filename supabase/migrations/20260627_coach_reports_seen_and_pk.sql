-- Coach reports: two fixes.
--
-- 1) Per-report read cursor for the Goals-tab red dot. Previously "last seen"
--    lived only in local AsyncStorage ('bittersweet-coach-last-seen'), so a fresh
--    install reset it to null and re-flagged already-read reports as unread. The
--    coach_reports rows already sync, so we persist the read state on the row.
alter table public.coach_reports
  add column if not exists seen_at timestamptz null;

-- 2) Make the primary key user-scoped. Report ids are deterministic per week and
--    NOT user-specific (e.g. 'coach-2026-06-15'), but the PK was on (id) alone —
--    global across all users. The first user to sync a given week claimed that id,
--    and every other user's upsert for the same week hit the existing row, failed
--    RLS (WITH CHECK auth.uid() = user_id), and was silently dropped — so their
--    report never reached the cloud. Scope the PK to (user_id, id) so each user
--    owns their own copy of every week id.
alter table public.coach_reports
  drop constraint if exists coach_reports_pkey;
alter table public.coach_reports
  add constraint coach_reports_pkey primary key (user_id, id);
