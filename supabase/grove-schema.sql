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
  interests TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_focusing BOOLEAN NOT NULL DEFAULT FALSE,
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

-- Table: grove_reactions
-- Reactions reference focus_sessions directly (no intermediate shared_sessions table).
-- RLS on focus_sessions handles friend + privacy visibility.
CREATE TABLE grove_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_reaction UNIQUE (session_id, user_id)
);

CREATE INDEX idx_reactions_session ON grove_reactions(session_id);

ALTER TABLE grove_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on visible sessions" ON grove_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM focus_sessions fs
      WHERE fs.id = grove_reactions.session_id
      AND (
        fs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM grove_friendships
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = fs.user_id)
            OR (addressee_id = auth.uid() AND requester_id = fs.user_id)
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
-- Server-side aggregation of focus sessions for friends + self within a date range.
-- Counts ALL friend focus hours (shared_tag_ids only controls feed visibility, not leaderboard).
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
      fs.user_id,
      SUM(fs.duration) AS total_minutes,
      json_build_object(
        'user_id', gp.user_id,
        'display_name', gp.display_name,
        'handle', gp.handle,
        'avatar_url', gp.avatar_url,
        'avatar_color', gp.avatar_color,
        'is_focusing', gp.is_focusing
      ) AS profile
    FROM focus_sessions fs
    JOIN grove_profiles gp ON gp.user_id = fs.user_id
    WHERE fs.start_time >= period_start
      AND fs.start_time < period_end
      AND fs.deleted_at IS NULL
      AND (
        fs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM grove_friendships
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = fs.user_id)
            OR (addressee_id = auth.uid() AND requester_id = fs.user_id)
          )
        )
      )
    GROUP BY fs.user_id, gp.user_id, gp.display_name, gp.handle, gp.avatar_url, gp.avatar_color, gp.is_focusing
  ) AS row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Table: grove_challenges
CREATE TABLE grove_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Legacy columns kept for backward compatibility during transition
  challenger_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  challengee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  tag_icon TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily', 'weekly')),
  target_minutes INTEGER NOT NULL DEFAULT 60 CHECK (target_minutes > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'failed', 'declined', 'cancelled')),
  start_date DATE,
  end_date DATE,
  -- Legacy hit columns kept for backward compatibility during transition
  challenger_hits INTEGER NOT NULL DEFAULT 0,
  challengee_hits INTEGER NOT NULL DEFAULT 0,
  fruit_reward INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_challenges_creator ON grove_challenges(creator_id, status);

ALTER TABLE grove_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own challenges" ON grove_challenges FOR SELECT
  USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM grove_challenge_participants cp
      WHERE cp.challenge_id = grove_challenges.id
        AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create challenges" ON grove_challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator can update challenges" ON grove_challenges FOR UPDATE
  USING (auth.uid() = creator_id);
CREATE POLICY "Creator can delete challenges" ON grove_challenges FOR DELETE
  USING (auth.uid() = creator_id);

-- Table: grove_challenge_participants
CREATE TABLE grove_challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES grove_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('creator', 'invitee')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  hits INTEGER NOT NULL DEFAULT 0,
  outcome TEXT CHECK (outcome IN ('completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_challenge_participant UNIQUE (challenge_id, user_id)
);

CREATE INDEX idx_challenge_participants_challenge ON grove_challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user ON grove_challenge_participants(user_id, status);

ALTER TABLE grove_challenge_participants ENABLE ROW LEVEL SECURITY;
-- Users can view their own participant rows directly.
-- Co-participant data is fetched via get_challenge_participants() SECURITY DEFINER RPC.
CREATE POLICY "Users can view own participant rows" ON grove_challenge_participants FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own participant row" ON grove_challenge_participants FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Creator can insert participants" ON grove_challenge_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grove_challenges c
      WHERE c.id = grove_challenge_participants.challenge_id
        AND c.creator_id = auth.uid()
    )
  );
CREATE POLICY "Creator can delete participants" ON grove_challenge_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM grove_challenges c
      WHERE c.id = grove_challenge_participants.challenge_id
        AND c.creator_id = auth.uid()
    )
  );

-- RPC: get_challenge_participants
-- Fetches all participants for given challenge IDs, bypassing per-row RLS.
-- Only returns participants for challenges the caller belongs to.
CREATE OR REPLACE FUNCTION get_challenge_participants(p_challenge_ids UUID[])
RETURNS TABLE (
  id UUID,
  challenge_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  hits INTEGER,
  outcome TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT cp.id, cp.challenge_id, cp.user_id, cp.role, cp.status,
           cp.hits, cp.outcome, cp.created_at, cp.updated_at
    FROM grove_challenge_participants cp
    WHERE cp.challenge_id = ANY(p_challenge_ids)
      AND EXISTS (
        SELECT 1 FROM grove_challenge_participants cp2
        WHERE cp2.challenge_id = cp.challenge_id
          AND cp2.user_id = auth.uid()
      );
END;
$$;

-- Helper: count a user's successful periods from focus_sessions
CREATE OR REPLACE FUNCTION _challenge_user_hits(
  p_user_id UUID,
  p_tag_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_period TEXT,
  p_target_minutes INTEGER,
  p_as_of_date DATE,
  p_user_tz TEXT DEFAULT 'UTC'
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  hits INTEGER := 0;
  bucket RECORD;
BEGIN
  IF p_period = 'daily' THEN
    FOR bucket IN
      SELECT
        (fs.start_time AT TIME ZONE p_user_tz)::date AS bucket_date,
        SUM(COALESCE(fs.adjusted_duration, fs.duration)) AS total_minutes
      FROM focus_sessions fs
      WHERE fs.user_id = p_user_id
        AND fs.tag_id = p_tag_id
        AND fs.deleted_at IS NULL
        AND (fs.start_time AT TIME ZONE p_user_tz)::date >= p_start_date
        AND (fs.start_time AT TIME ZONE p_user_tz)::date <= LEAST(p_end_date, p_as_of_date)
      GROUP BY bucket_date
      ORDER BY bucket_date
    LOOP
      IF bucket.total_minutes >= p_target_minutes THEN
        hits := hits + 1;
      END IF;
    END LOOP;
  ELSE
    FOR bucket IN
      SELECT
        date_trunc('week', (fs.start_time AT TIME ZONE p_user_tz)::date)::date AS week_start,
        SUM(COALESCE(fs.adjusted_duration, fs.duration)) AS total_minutes
      FROM focus_sessions fs
      WHERE fs.user_id = p_user_id
        AND fs.tag_id = p_tag_id
        AND fs.deleted_at IS NULL
        AND (fs.start_time AT TIME ZONE p_user_tz)::date >= p_start_date
        AND (fs.start_time AT TIME ZONE p_user_tz)::date <= LEAST(p_end_date, p_as_of_date)
      GROUP BY week_start
      ORDER BY week_start
    LOOP
      IF bucket.total_minutes >= p_target_minutes THEN
        hits := hits + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN hits;
END;
$$;

-- RPC: finalize_expired_challenges
-- Called by daily cron. Auto-cancels pending challenges past start_date with no accepted invitees.
-- Finalizes expired active challenges: reads client-computed hits, sets outcome + challenge status.
-- Does NOT recalculate hits server-side — trusts the timezone-aware hits written by clients.
-- Waits 2 days past end_date so the last day has fully elapsed in all timezones (up to UTC+14).
CREATE OR REPLACE FUNCTION finalize_expired_challenges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenge RECORD;
  participant RECORD;
  v_total_periods INTEGER;
  v_all_completed BOOLEAN;
  v_new_status TEXT;
  v_finalized INTEGER := 0;
  v_cancelled INTEGER := 0;
  v_accepted_count INTEGER;
BEGIN
  -- Phase 1: Auto-cancel pending challenges past start_date with zero accepted invitees
  FOR challenge IN
    SELECT * FROM grove_challenges
    WHERE status = 'pending'
      AND start_date IS NOT NULL
      AND start_date <= CURRENT_DATE
  LOOP
    SELECT COUNT(*) INTO v_accepted_count
    FROM grove_challenge_participants
    WHERE challenge_id = challenge.id
      AND role = 'invitee'
      AND status = 'accepted';

    IF v_accepted_count = 0 THEN
      UPDATE grove_challenges
      SET status = 'cancelled', updated_at = now()
      WHERE id = challenge.id;
      v_cancelled := v_cancelled + 1;
    ELSE
      UPDATE grove_challenges
      SET status = 'active', updated_at = now()
      WHERE id = challenge.id;
    END IF;
  END LOOP;

  -- Phase 2: Finalize expired active challenges
  -- Wait 2 days past end_date so the last day has fully elapsed in all timezones (up to UTC+14)
  FOR challenge IN
    SELECT * FROM grove_challenges
    WHERE status = 'active'
      AND end_date < CURRENT_DATE - 2
  LOOP
    IF challenge.period = 'daily' THEN
      v_total_periods := (challenge.end_date - challenge.start_date) + 1;
    ELSE
      v_total_periods := ((challenge.end_date - challenge.start_date) + 1) / 7;
    END IF;

    v_all_completed := TRUE;

    FOR participant IN
      SELECT * FROM grove_challenge_participants
      WHERE challenge_id = challenge.id
        AND status = 'accepted'
    LOOP
      -- Use client-computed hits (already timezone-aware) instead of recalculating
      UPDATE grove_challenge_participants
      SET outcome = CASE WHEN participant.hits >= v_total_periods THEN 'completed' ELSE 'failed' END,
          updated_at = now()
      WHERE id = participant.id;

      IF participant.hits < v_total_periods THEN
        v_all_completed := FALSE;
      END IF;
    END LOOP;

    v_new_status := CASE WHEN v_all_completed THEN 'completed' ELSE 'failed' END;

    UPDATE grove_challenges
    SET status = v_new_status, updated_at = now()
    WHERE id = challenge.id;

    v_finalized := v_finalized + 1;
  END LOOP;

  RETURN json_build_object('finalized', v_finalized, 'cancelled', v_cancelled);
END;
$$;

-- RPC: get_challenge_period_details
-- Returns per-participant minutes arrays for the challenge period grid.
CREATE OR REPLACE FUNCTION get_challenge_period_details(
  p_challenge_id UUID,
  p_user_tz TEXT DEFAULT 'UTC'
)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_challenge grove_challenges%ROWTYPE;
  v_period_dates DATE[];
  v_period_date DATE;
  v_participant RECORD;
  v_participants JSON[];
  v_minutes INTEGER[];
  v_total_minutes INTEGER;
  v_total_periods INTEGER;
  v_profile grove_profiles%ROWTYPE;
  v_hits INTEGER;
BEGIN
  SELECT * INTO v_challenge FROM grove_challenges WHERE id = p_challenge_id;
  IF v_challenge IS NULL THEN
    RETURN json_build_object('periods', '[]'::json, 'participants', '[]'::json, 'total_periods', 0);
  END IF;

  IF v_challenge.period = 'daily' THEN
    v_period_dates := ARRAY(
      SELECT generate_series(v_challenge.start_date, v_challenge.end_date, '1 day'::interval)::date
    );
  ELSE
    v_period_dates := ARRAY(
      SELECT generate_series(v_challenge.start_date, v_challenge.end_date, '7 days'::interval)::date
    );
  END IF;

  v_total_periods := COALESCE(array_length(v_period_dates, 1), 0);
  v_participants := ARRAY[]::JSON[];

  FOR v_participant IN
    SELECT cp.user_id, cp.role, cp.status, cp.hits, cp.outcome
    FROM grove_challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.status = 'accepted'
    ORDER BY cp.role ASC, cp.created_at ASC
  LOOP
    SELECT * INTO v_profile FROM grove_profiles WHERE user_id = v_participant.user_id;
    v_minutes := ARRAY[]::INTEGER[];
    v_hits := 0;

    FOR i IN 1..COALESCE(v_total_periods, 0) LOOP
      v_period_date := v_period_dates[i];
      IF v_challenge.period = 'daily' THEN
        SELECT COALESCE(SUM(COALESCE(fs.adjusted_duration, fs.duration)), 0)::INTEGER INTO v_total_minutes
        FROM focus_sessions fs
        WHERE fs.user_id = v_participant.user_id
          AND fs.tag_id = v_challenge.tag_id
          AND fs.deleted_at IS NULL
          AND (fs.start_time AT TIME ZONE p_user_tz)::date = v_period_date;
      ELSE
        SELECT COALESCE(SUM(COALESCE(fs.adjusted_duration, fs.duration)), 0)::INTEGER INTO v_total_minutes
        FROM focus_sessions fs
        WHERE fs.user_id = v_participant.user_id
          AND fs.tag_id = v_challenge.tag_id
          AND fs.deleted_at IS NULL
          AND (fs.start_time AT TIME ZONE p_user_tz)::date >= v_period_date
          AND (fs.start_time AT TIME ZONE p_user_tz)::date < v_period_date + 7;
      END IF;

      v_minutes := v_minutes || v_total_minutes;
      IF v_total_minutes >= v_challenge.target_minutes THEN
        v_hits := v_hits + 1;
      END IF;
    END LOOP;

    v_participants := v_participants || json_build_object(
      'user_id', v_participant.user_id,
      'display_name', COALESCE(v_profile.display_name, 'Unknown'),
      'minutes', to_json(v_minutes),
      'hits', v_hits
    );
  END LOOP;

  RETURN json_build_object(
    'periods', to_json(v_period_dates),
    'participants', to_json(v_participants),
    'total_periods', v_total_periods
  );
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
  'challenge-cron',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/challenge-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

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

SELECT cron.schedule(
  'subscription-status-cron',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/subscription-status-cron',
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

-- Storage bucket: session-photos
-- Create via Supabase Dashboard → Storage → New Bucket
-- Name: session-photos
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
--
-- Photos are stored at {user_id}/{session_id}.jpg.
-- The bucket is public (readable by URL), but only owners can upload/delete.
-- Photo URLs are only exposed in the feed when share_notes is true,
-- so friends never receive the URL unless privacy allows it.
--
-- Storage policy:
-- CREATE POLICY "Users can manage own session photos"
-- ON storage.objects FOR ALL
-- USING (bucket_id = 'session-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
-- WITH CHECK (bucket_id = 'session-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- focus_sessions.photo_url — added via migration 20260601_add_photo_url.sql
-- Stores the public URL of the session photo uploaded to session-photos bucket.
