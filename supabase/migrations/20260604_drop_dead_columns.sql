-- Drop unused columns from focus_sessions
ALTER TABLE public.focus_sessions DROP COLUMN IF EXISTS is_paused;
ALTER TABLE public.focus_sessions DROP COLUMN IF EXISTS total_pause_time;

-- Drop unused columns from session_tags
ALTER TABLE public.session_tags DROP COLUMN IF EXISTS is_default;

-- Drop unused column from focus_goals
ALTER TABLE public.focus_goals DROP COLUMN IF EXISTS current_progress;

-- Drop unused column from grove_privacy_settings
ALTER TABLE public.grove_privacy_settings DROP COLUMN IF EXISTS visible_stats;
