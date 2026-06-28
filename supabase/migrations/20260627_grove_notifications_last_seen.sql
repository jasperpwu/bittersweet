-- Grove: persist the "notifications last seen" read cursor on the profile so the
-- bell red-dot survives reinstall / new device. Previously this timestamp lived
-- only in local AsyncStorage, so a fresh install reset it to null and re-flagged
-- already-read notifications as unread.
alter table public.grove_profiles
  add column if not exists notifications_last_seen_at timestamptz null;
