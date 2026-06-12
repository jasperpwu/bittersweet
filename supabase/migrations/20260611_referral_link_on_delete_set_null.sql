-- ============================================================
-- Harden account deletion
-- `grove_invite_links.referred_user_id` referenced auth.users(id) with no
-- ON DELETE action, so deleting a user who had been referred would be blocked
-- by this foreign key. Switch it to ON DELETE SET NULL so a hard delete of the
-- auth user succeeds while preserving the referrer's invite-link row (and their
-- already-earned referral_tracking count).
-- ============================================================

ALTER TABLE grove_invite_links
  DROP CONSTRAINT IF EXISTS grove_invite_links_referred_user_id_fkey;

ALTER TABLE grove_invite_links
  ADD CONSTRAINT grove_invite_links_referred_user_id_fkey
  FOREIGN KEY (referred_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
