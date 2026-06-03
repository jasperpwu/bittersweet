-- Drop unused usage_count column from session_tags
ALTER TABLE public.session_tags DROP COLUMN IF EXISTS usage_count;
