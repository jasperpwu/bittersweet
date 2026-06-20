-- Motion-based focus rating.
--
-- A focus session gets a suggested 1-5 star rating derived on-device from Core
-- Motion (CMSensorRecorder raw accelerometer, falling back to CMMotionActivity).
-- The rating scales the session's fruit reward and is overridable by the user.
--
-- focus_rating    : 1-5, suggested from motion or set by the user (NULL = unrated)
-- rating_source   : 'suggested' | 'user' (who set focus_rating)
-- motion_summary  : on-device motion estimate snapshot, kept so the insights sheet
--                   still works after the ~7-day Core Motion history window expires
--
-- activity_type on a tag is an optional hint that flips how motion maps to the
-- rating: 'stationary' (still = focused), 'active' (moving = focused), 'on_phone'
-- (motion mostly ignored). Unset is treated as 'stationary' client-side.
--
-- All nullable; existing rows read back as unrated. baseFruits/awardedFruits are
-- intentionally NOT synced (local reward accounting; single-device app).
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS focus_rating   INT;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS rating_source  TEXT;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS motion_summary JSONB;

ALTER TABLE public.session_tags   ADD COLUMN IF NOT EXISTS activity_type  TEXT;

