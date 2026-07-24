-- Per-User Challenge Dismiss
-- Lets either party (creator or invitee) remove a FINISHED challenge
-- (completed/failed) from their own list without destroying the shared row.
-- The challenge stays visible to the other participant until they dismiss it too.
--
-- No new RLS policy is required: the existing
--   "Users can update own participant row" (USING auth.uid() = user_id)
-- already permits a participant to set dismissed_at on their own row.

ALTER TABLE grove_challenge_participants
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;
