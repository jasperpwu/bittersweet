-- ============================================================
-- Account-deletion notifications for inner circle members
-- When a user deletes their account, we notify the inner circle members who
-- were watching them. The user (and their id) no longer exist after deletion,
-- so the alert keeps only the user's display name (embedded in the text):
--   * about_user_id is set NULL  -> allow NULL (was NOT NULL).
--   * trigger_type 'account_deleted' -> extend the CHECK constraint.
-- about_user_id keeps its ON DELETE CASCADE; we insert NULL directly so these
-- rows are unaffected by the cascade that fires when the auth user is deleted.
-- ============================================================

ALTER TABLE heartbeat_notifications
  ALTER COLUMN about_user_id DROP NOT NULL;

ALTER TABLE heartbeat_notifications
  DROP CONSTRAINT IF EXISTS heartbeat_notifications_trigger_type_check;

ALTER TABLE heartbeat_notifications
  ADD CONSTRAINT heartbeat_notifications_trigger_type_check
  CHECK (trigger_type IN ('quiet_threshold', 'blocklist_edit', 'heartbeat_paused', 'account_deleted'));
