-- ============================================================
-- Blocklist edit-cost escalation, persisted across reinstall.
--
-- The price of editing the blocklist doubles with each edit and
-- resets weekly (client: getBlocklistEditCost / blocklist.editHistory,
-- 1,2,4,8,16…). That counter lived only in local state, so a reinstall
-- (which wipes AsyncStorage) reset the price back to 1 — letting a user
-- dodge the escalation by reinstalling.
--
-- Park the two counter fields on the user's existing blocklist row so
-- they ride the same RLS + sync as the selection blob. Reconciled with
-- a weekly-normalized max() merge (BlocklistSyncService.mergeEditHistory),
-- so the cloud value survives reinstall and only ever resets on the
-- calendar week boundary — never by reinstalling.
--
--   edit_week_start : ISO week start the count belongs to (client toISOString)
--   edits_this_week : number of paid edits made in that week
-- ============================================================

alter table public.blocklist_selections
  add column if not exists edit_week_start text,
  add column if not exists edits_this_week integer not null default 0;
