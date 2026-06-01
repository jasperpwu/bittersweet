-- Grove Phase 1: Foundation Schema
-- Run this in Supabase SQL Editor

-- Table: grove_profiles
CREATE TABLE grove_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 20),
  handle TEXT NOT NULL UNIQUE CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
  avatar_url TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#6592E9',
  gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say')),
  job_title TEXT CHECK (char_length(job_title) <= 30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_id UNIQUE (user_id)
);

ALTER TABLE grove_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON grove_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON grove_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON grove_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can read friend profiles" ON grove_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grove_friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = grove_profiles.user_id)
        OR (addressee_id = auth.uid() AND requester_id = grove_profiles.user_id)
      )
    )
  );

-- Table: grove_privacy_settings
CREATE TABLE grove_privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_tag_ids TEXT[] NOT NULL DEFAULT '{}',
  share_notes BOOLEAN NOT NULL DEFAULT FALSE,
  show_live_status BOOLEAN NOT NULL DEFAULT FALSE,
  visible_stats TEXT NOT NULL DEFAULT 'total_only' CHECK (visible_stats IN ('total_only', 'full', 'nothing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_privacy_user_id UNIQUE (user_id)
);

ALTER TABLE grove_privacy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own privacy" ON grove_privacy_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Friends can read privacy settings" ON grove_privacy_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grove_friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = grove_privacy_settings.user_id)
        OR (addressee_id = auth.uid() AND requester_id = grove_privacy_settings.user_id)
      )
    )
  );

-- RPC: check_handle_available
CREATE OR REPLACE FUNCTION check_handle_available(target_handle TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT NOT EXISTS (SELECT 1 FROM grove_profiles WHERE handle = target_handle);
$$;

-- ============================================================
-- Grove Phase 2: Social Layer
-- ============================================================

-- Table: grove_friendships
CREATE TABLE grove_friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_friendship UNIQUE (requester_id, addressee_id),
  CONSTRAINT no_self_friendship CHECK (requester_id <> addressee_id)
);

CREATE INDEX idx_friendships_requester ON grove_friendships(requester_id, status);
CREATE INDEX idx_friendships_addressee ON grove_friendships(addressee_id, status);

ALTER TABLE grove_friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own friendships" ON grove_friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can send friend requests" ON grove_friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');
CREATE POLICY "Users can update own friendships" ON grove_friendships FOR UPDATE
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id);
CREATE POLICY "Users can delete own friendships" ON grove_friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Table: grove_shared_sessions
CREATE TABLE grove_shared_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  tag_icon TEXT NOT NULL,
  duration INTEGER NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  notes TEXT,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_shared_session UNIQUE (user_id, session_id)
);

CREATE INDEX idx_shared_sessions_user ON grove_shared_sessions(user_id, shared_at DESC);
CREATE INDEX idx_shared_sessions_time ON grove_shared_sessions(shared_at DESC);

ALTER TABLE grove_shared_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can share own sessions" ON grove_shared_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unshare own sessions" ON grove_shared_sessions FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can view friends shared sessions" ON grove_shared_sessions FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      EXISTS (
        SELECT 1 FROM grove_friendships
        WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND addressee_id = grove_shared_sessions.user_id)
          OR (addressee_id = auth.uid() AND requester_id = grove_shared_sessions.user_id)
        )
      )
      AND EXISTS (
        SELECT 1 FROM grove_privacy_settings
        WHERE user_id = grove_shared_sessions.user_id
        AND grove_shared_sessions.tag_id = ANY(shared_tag_ids)
      )
    )
  );

-- Table: grove_reactions
CREATE TABLE grove_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_session_id UUID NOT NULL REFERENCES grove_shared_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_reaction UNIQUE (shared_session_id, user_id)
);

CREATE INDEX idx_reactions_session ON grove_reactions(shared_session_id);

ALTER TABLE grove_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on visible sessions" ON grove_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM grove_shared_sessions ss
      WHERE ss.id = grove_reactions.shared_session_id
      AND (
        ss.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM grove_friendships
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = ss.user_id)
            OR (addressee_id = auth.uid() AND requester_id = ss.user_id)
          )
        )
      )
    )
  );
CREATE POLICY "Users can react" ON grove_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unreact" ON grove_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Table: grove_invite_links
CREATE TABLE grove_invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE grove_invite_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own invite links" ON grove_invite_links FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "Anyone can look up active invite codes" ON grove_invite_links FOR SELECT
  USING (is_active = true);

-- RPC: resolve_invite_code
-- Resolves an invite code: looks up inviter, creates auto-accepted friendship
CREATE OR REPLACE FUNCTION resolve_invite_code(invite_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  invite_record grove_invite_links%ROWTYPE;
  inviter_profile grove_profiles%ROWTYPE;
  existing_friendship grove_friendships%ROWTYPE;
BEGIN
  SELECT * INTO invite_record FROM grove_invite_links
  WHERE code = invite_code AND is_active = true;

  IF invite_record IS NULL THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  IF invite_record.user_id = auth.uid() THEN
    RETURN json_build_object('error', 'SELF_INVITE');
  END IF;

  SELECT * INTO existing_friendship FROM grove_friendships
  WHERE (requester_id = auth.uid() AND addressee_id = invite_record.user_id)
     OR (requester_id = invite_record.user_id AND addressee_id = auth.uid());

  IF existing_friendship IS NOT NULL THEN
    IF existing_friendship.status = 'accepted' THEN
      RETURN json_build_object('error', 'ALREADY_FRIENDS');
    ELSE
      UPDATE grove_friendships SET status = 'accepted', updated_at = now()
      WHERE id = existing_friendship.id;

      SELECT * INTO inviter_profile FROM grove_profiles WHERE user_id = invite_record.user_id;
      RETURN json_build_object('status', 'accepted', 'friend', row_to_json(inviter_profile));
    END IF;
  END IF;

  INSERT INTO grove_friendships (requester_id, addressee_id, status)
  VALUES (auth.uid(), invite_record.user_id, 'accepted');

  SELECT * INTO inviter_profile FROM grove_profiles WHERE user_id = invite_record.user_id;
  RETURN json_build_object('status', 'accepted', 'friend', row_to_json(inviter_profile));
END;
$$;

-- RPC: lookup_invite_code
-- Looks up an invite code and returns the inviter's profile WITHOUT creating a friendship.
CREATE OR REPLACE FUNCTION lookup_invite_code(invite_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  invite_record grove_invite_links%ROWTYPE;
  inviter_profile grove_profiles%ROWTYPE;
  existing_friendship grove_friendships%ROWTYPE;
BEGIN
  SELECT * INTO invite_record FROM grove_invite_links
  WHERE code = invite_code AND is_active = true;

  IF invite_record IS NULL THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  IF invite_record.user_id = auth.uid() THEN
    RETURN json_build_object('error', 'SELF_INVITE');
  END IF;

  SELECT * INTO existing_friendship FROM grove_friendships
  WHERE (requester_id = auth.uid() AND addressee_id = invite_record.user_id)
     OR (requester_id = invite_record.user_id AND addressee_id = auth.uid());

  SELECT * INTO inviter_profile FROM grove_profiles WHERE user_id = invite_record.user_id;

  IF existing_friendship IS NOT NULL AND existing_friendship.status = 'accepted' THEN
    RETURN json_build_object('status', 'already_friends', 'profile', row_to_json(inviter_profile));
  END IF;

  RETURN json_build_object('status', 'available', 'profile', row_to_json(inviter_profile));
END;
$$;

-- ============================================================
-- Grove Phase 3: Leaderboard + Streak Challenges
-- ============================================================

-- RPC: get_grove_rankings
-- Server-side aggregation of shared sessions for friends + self within a date range.
CREATE OR REPLACE FUNCTION get_grove_rankings(
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY total_minutes DESC)
  INTO result
  FROM (
    SELECT
      ss.user_id,
      SUM(ss.duration) AS total_minutes,
      json_build_object(
        'user_id', gp.user_id,
        'display_name', gp.display_name,
        'handle', gp.handle,
        'avatar_url', gp.avatar_url,
        'avatar_color', gp.avatar_color
      ) AS profile
    FROM grove_shared_sessions ss
    JOIN grove_profiles gp ON gp.user_id = ss.user_id
    WHERE ss.shared_at >= period_start
      AND ss.shared_at < period_end
      AND (
        ss.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM grove_friendships
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = ss.user_id)
            OR (addressee_id = auth.uid() AND requester_id = ss.user_id)
          )
        )
      )
    GROUP BY ss.user_id, gp.user_id, gp.display_name, gp.handle, gp.avatar_url, gp.avatar_color
  ) AS row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Table: grove_challenges
CREATE TABLE grove_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challengee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  tag_icon TEXT NOT NULL,
  streak_days INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'failed', 'declined')),
  start_date DATE,
  end_date DATE,
  challenger_streak INTEGER NOT NULL DEFAULT 0,
  challengee_streak INTEGER NOT NULL DEFAULT 0,
  challenger_last_date DATE,
  challengee_last_date DATE,
  fruit_reward INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_challenge CHECK (challenger_id <> challengee_id)
);

CREATE INDEX idx_challenges_challenger ON grove_challenges(challenger_id, status);
CREATE INDEX idx_challenges_challengee ON grove_challenges(challengee_id, status);

ALTER TABLE grove_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own challenges" ON grove_challenges FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = challengee_id);
CREATE POLICY "Users can create challenges" ON grove_challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id AND status = 'pending');
CREATE POLICY "Users can update own challenges" ON grove_challenges FOR UPDATE
  USING (auth.uid() = challenger_id OR auth.uid() = challengee_id);

-- RPC: record_challenge_progress
-- Called after a session completes under a challenge tag. Updates streak count.
CREATE OR REPLACE FUNCTION record_challenge_progress(challenge_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenge grove_challenges%ROWTYPE;
  today DATE := CURRENT_DATE;
  is_challenger BOOLEAN;
  current_streak INTEGER;
  last_date DATE;
  other_streak INTEGER;
BEGIN
  SELECT * INTO challenge FROM grove_challenges WHERE id = challenge_id AND status = 'active';
  IF challenge IS NULL THEN
    RETURN json_build_object('error', 'CHALLENGE_NOT_FOUND');
  END IF;

  IF today > challenge.end_date THEN
    UPDATE grove_challenges SET status = 'failed', updated_at = now() WHERE id = challenge_id;
    RETURN json_build_object('error', 'CHALLENGE_EXPIRED');
  END IF;

  is_challenger := (auth.uid() = challenge.challenger_id);

  IF is_challenger THEN
    current_streak := challenge.challenger_streak;
    last_date := challenge.challenger_last_date;
    other_streak := challenge.challengee_streak;
  ELSE
    current_streak := challenge.challengee_streak;
    last_date := challenge.challengee_last_date;
    other_streak := challenge.challenger_streak;
  END IF;

  -- Already logged today
  IF last_date = today THEN
    RETURN json_build_object('status', 'already_logged', 'streak', current_streak);
  END IF;

  -- Check continuity: must be consecutive day or first day
  IF last_date IS NOT NULL AND today - last_date > 1 THEN
    UPDATE grove_challenges SET status = 'failed', updated_at = now() WHERE id = challenge_id;
    RETURN json_build_object('error', 'STREAK_BROKEN');
  END IF;

  current_streak := current_streak + 1;

  IF is_challenger THEN
    UPDATE grove_challenges
    SET challenger_streak = current_streak, challenger_last_date = today, updated_at = now()
    WHERE id = challenge_id;
  ELSE
    UPDATE grove_challenges
    SET challengee_streak = current_streak, challengee_last_date = today, updated_at = now()
    WHERE id = challenge_id;
  END IF;

  -- Check if both completed
  IF current_streak >= challenge.streak_days AND other_streak >= challenge.streak_days THEN
    UPDATE grove_challenges SET status = 'completed', updated_at = now() WHERE id = challenge_id;
    RETURN json_build_object('status', 'completed', 'streak', current_streak, 'reward', challenge.fruit_reward);
  END IF;

  RETURN json_build_object('status', 'progress', 'streak', current_streak);
END;
$$;

-- ============================================================
-- Grove Phase 4: Heartbeat / Inner Circle
-- ============================================================

-- Table: heartbeat_settings
-- One row per user. Stores heartbeat config + pause state + last activity timestamp.
CREATE TABLE heartbeat_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_threshold_days INTEGER NOT NULL DEFAULT 3
    CHECK (quiet_threshold_days IN (3, 5, 7, 14)),
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  pause_duration TEXT CHECK (pause_duration IN ('1_week', '2_weeks', '1_month')),
  pause_started_at TIMESTAMPTZ,
  pause_expires_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE heartbeat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own heartbeat settings" ON heartbeat_settings FOR ALL
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER set_heartbeat_settings_updated_at
  BEFORE UPDATE ON heartbeat_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Table: heartbeat_inner_circle
-- Each row is an invite from user_id to circle_member_id.
-- A user can have at most 3 active (pending + accepted) members.
CREATE TABLE heartbeat_inner_circle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  circle_member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'removed')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT unique_circle_membership UNIQUE (user_id, circle_member_id),
  CONSTRAINT no_self_circle CHECK (user_id <> circle_member_id)
);

CREATE INDEX idx_inner_circle_user ON heartbeat_inner_circle(user_id, status);
CREATE INDEX idx_inner_circle_member ON heartbeat_inner_circle(circle_member_id, status);

ALTER TABLE heartbeat_inner_circle ENABLE ROW LEVEL SECURITY;

-- Owner can see all their outgoing invites
CREATE POLICY "Users can view own inner circle" ON heartbeat_inner_circle FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = circle_member_id);
-- Owner can send invites
CREATE POLICY "Users can invite to inner circle" ON heartbeat_inner_circle FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
-- Both parties can update (accept/decline/remove)
CREATE POLICY "Users can update inner circle" ON heartbeat_inner_circle FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = circle_member_id);

-- Enforce max 3 active members per user via a trigger
CREATE OR REPLACE FUNCTION enforce_inner_circle_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM heartbeat_inner_circle
  WHERE user_id = NEW.user_id
    AND status IN ('pending', 'accepted')
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF active_count >= 3 THEN
    RAISE EXCEPTION 'Inner circle is full (max 3 members)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_inner_circle_limit
  BEFORE INSERT ON heartbeat_inner_circle
  FOR EACH ROW EXECUTE FUNCTION enforce_inner_circle_limit();

-- Table: heartbeat_notifications
-- Alerts sent to inner circle members when triggers fire.
CREATE TABLE heartbeat_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  about_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('quiet_threshold', 'blocklist_edit', 'heartbeat_paused')),
  notification_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_heartbeat_notifications_target ON heartbeat_notifications(target_user_id, sent_at DESC);
CREATE INDEX idx_heartbeat_notifications_unread ON heartbeat_notifications(target_user_id)
  WHERE read_at IS NULL;

ALTER TABLE heartbeat_notifications ENABLE ROW LEVEL SECURITY;

-- Recipients can read and update (mark read) their own notifications
CREATE POLICY "Users can view own heartbeat notifications" ON heartbeat_notifications FOR SELECT
  USING (auth.uid() = target_user_id);
CREATE POLICY "Users can mark own notifications read" ON heartbeat_notifications FOR UPDATE
  USING (auth.uid() = target_user_id);

-- ============================================================
-- Heartbeat RPC: check_heartbeat_quiet
-- Called by a cron job. Finds users past their quiet threshold
-- and inserts notifications for their inner circle members.
-- ============================================================
CREATE OR REPLACE FUNCTION check_heartbeat_quiet()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  quiet_user RECORD;
  circle_member RECORD;
  display TEXT;
BEGIN
  -- Find users who are enabled, not paused, and past their threshold
  FOR quiet_user IN
    SELECT hs.user_id, hs.quiet_threshold_days, hs.last_active_at, gp.display_name
    FROM heartbeat_settings hs
    JOIN grove_profiles gp ON gp.user_id = hs.user_id
    WHERE hs.is_enabled = TRUE
      AND hs.is_paused = FALSE
      AND hs.last_active_at < now() - (hs.quiet_threshold_days || ' days')::interval
      -- Only alert once per quiet period: skip if a quiet_threshold notification
      -- was already sent after their last_active_at
      AND NOT EXISTS (
        SELECT 1 FROM heartbeat_notifications hn
        WHERE hn.about_user_id = hs.user_id
          AND hn.trigger_type = 'quiet_threshold'
          AND hn.sent_at > hs.last_active_at
      )
  LOOP
    display := quiet_user.display_name;

    -- Insert a notification for each accepted inner circle member
    FOR circle_member IN
      SELECT circle_member_id FROM heartbeat_inner_circle
      WHERE user_id = quiet_user.user_id AND status = 'accepted'
    LOOP
      INSERT INTO heartbeat_notifications (target_user_id, about_user_id, trigger_type, notification_text)
      VALUES (
        circle_member.circle_member_id,
        quiet_user.user_id,
        'quiet_threshold',
        display || ' has been quiet for ' || quiet_user.quiet_threshold_days || ' days. Maybe check in?'
      );
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================
-- Heartbeat RPC: check_heartbeat_pause_expiry
-- Called by a cron job. Un-pauses users whose pause has expired.
-- ============================================================
CREATE OR REPLACE FUNCTION check_heartbeat_pause_expiry()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE heartbeat_settings
  SET is_paused = FALSE,
      pause_duration = NULL,
      pause_started_at = NULL,
      pause_expires_at = NULL,
      updated_at = now()
  WHERE is_paused = TRUE
    AND pause_expires_at IS NOT NULL
    AND pause_expires_at <= now();
END;
$$;

-- Table: push_tokens
-- Stores Expo push tokens for each user (one token per device).
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_token UNIQUE (user_id, expo_push_token)
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own push tokens" ON push_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE TRIGGER set_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RPC: find_quiet_users
-- Used by the heartbeat-cron Edge Function to find users past their quiet threshold.
-- Returns users who are enabled, not paused, past threshold, and not already alerted.
-- ============================================================
CREATE OR REPLACE FUNCTION find_quiet_users()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  quiet_threshold_days INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT hs.user_id, gp.display_name, hs.quiet_threshold_days
    FROM heartbeat_settings hs
    JOIN grove_profiles gp ON gp.user_id = hs.user_id
    WHERE hs.is_enabled = TRUE
      AND hs.is_paused = FALSE
      AND hs.last_active_at < now() - (hs.quiet_threshold_days || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM heartbeat_notifications hn
        WHERE hn.about_user_id = hs.user_id
          AND hn.trigger_type = 'quiet_threshold'
          AND hn.sent_at > hs.last_active_at
      );
END;
$$;

-- ============================================================
-- Cron setup
-- Requires: pg_cron (schema: pg_catalog), pg_net (schema: extensions), vault.
-- The heartbeat-cron Edge Function handles both pause expiry and quiet checks.
--
-- Step 1: Store credentials in Vault (run once, replace with your actual values):
--
--   SELECT vault.create_secret('https://wpcyvjpntzgfpwbzprkp.supabase.co', 'project_url');
--   SELECT vault.create_secret('sb_publishable_aMzfr3VTL7lOhfYKqOniEA_SyAHaDhY', 'publishable_key');
--
-- Step 2: Schedule the cron (runs every hour):
-- ============================================================

SELECT cron.schedule(
  'heartbeat-cron',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/heartbeat-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================

-- Storage bucket: avatars
-- Create via Supabase Dashboard → Storage → New Bucket
-- Name: avatars
-- Public: true
-- File size limit: 2MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Then add this storage policy:
-- CREATE POLICY "Users can manage own avatar"
-- ON storage.objects FOR ALL
-- USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
-- WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
