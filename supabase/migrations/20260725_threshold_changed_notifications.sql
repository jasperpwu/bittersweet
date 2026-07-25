-- ============================================================
-- Quiet-threshold-change notifications
-- When a circle owner RAISES their quiet threshold (e.g. 3 -> 14 days), their
-- inner circle waits longer before being alerted to inactivity — a weakening of
-- accountability, so members are notified ("<owner> raised their quiet
-- threshold."). Reuses the existing heartbeat_notifications pipeline:
--   * target_user_id -> each accepted inner-circle member
--   * about_user_id  -> the owner who changed the setting (still exists, NOT NULL)
--   * trigger_type 'threshold_changed' -> extend the CHECK constraint.
-- Lowering the threshold (more accountability) does NOT notify.
-- Re-adds the constraint with the full value set so it is order-independent
-- relative to the earlier trigger-type migrations.
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
    'circle_removed',
    'threshold_changed'
  ));
