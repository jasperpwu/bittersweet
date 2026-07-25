-- ============================================================
-- Blocklist-cleared notifications
-- When a circle owner clears their ENTIRE blocklist (removes every app so they
-- are no longer blocking anything), their inner circle gets a firmer alert than
-- a normal blocklist edit ("Heads up — <owner> cleared their entire blocklist
-- and is no longer blocking any apps."). This is the single largest drop in
-- accountability, so it also costs 3x a normal edit on the client.
-- Reuses the existing heartbeat_notifications pipeline:
--   * target_user_id -> each accepted inner-circle member
--   * about_user_id  -> the owner who cleared the list (still exists, NOT NULL)
--   * trigger_type 'blocklist_cleared' -> extend the CHECK constraint.
-- Dated after 20260725_threshold_changed so this superset is the final constraint
-- regardless of apply order. Re-adds the constraint with the full value set.
-- ============================================================

ALTER TABLE heartbeat_notifications
  DROP CONSTRAINT IF EXISTS heartbeat_notifications_trigger_type_check;

ALTER TABLE heartbeat_notifications
  ADD CONSTRAINT heartbeat_notifications_trigger_type_check
  CHECK (trigger_type IN (
    'quiet_threshold',
    'blocklist_edit',
    'blocklist_cleared',
    'heartbeat_paused',
    'account_deleted',
    'circle_removed',
    'threshold_changed'
  ));
