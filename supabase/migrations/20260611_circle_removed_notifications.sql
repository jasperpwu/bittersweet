-- ============================================================
-- Inner-circle removal notifications
-- When a circle owner removes an accepted member, we notify the removed member
-- ("<owner> removed you from their inner circle."). This reuses the existing
-- heartbeat_notifications pipeline:
--   * target_user_id -> the removed member (circle_member_id)
--   * about_user_id  -> the owner who removed them (still exists, so NOT NULL)
--   * trigger_type 'circle_removed' -> extend the CHECK constraint.
-- Re-adds the constraint with the full value set so it is order-independent
-- relative to 20260611_account_deletion_notifications.sql.
-- ============================================================

ALTER TABLE heartbeat_notifications
  DROP CONSTRAINT IF EXISTS heartbeat_notifications_trigger_type_check;

ALTER TABLE heartbeat_notifications
  ADD CONSTRAINT heartbeat_notifications_trigger_type_check
  CHECK (trigger_type IN (
    'quiet_threshold',
    'blocklist_edit',
    'heartbeat_paused',
    'account_deleted',
    'circle_removed'
  ));
