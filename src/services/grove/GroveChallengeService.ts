import { supabase } from '../../config/supabase';

// --- Types ---

export interface ChallengeProfile {
  display_name: string;
  handle: string;
  avatar_url: string | null;
  avatar_color: string;
}

/**
 * How a finished challenge's payout multiplier is derived.
 * - `isolated` — from the claimant's own hits.
 * - `pooled` — participants are bound: the full double is paid only if every
 *   accepted participant hit every period. See `src/utils/challengeReward.ts`.
 */
export type ChallengeRewardMode = 'isolated' | 'pooled';

export interface ChallengeParticipant {
  id: string;
  userId: string;
  role: 'creator' | 'invitee';
  status: 'pending' | 'accepted' | 'declined';
  hits: number;
  outcome: 'completed' | 'failed' | null;
  /** This participant's own local tag id for the challenge, or null until they accept. */
  tagId: string | null;
  /** ISO timestamp of when this participant claimed their fruit reward, or null if unclaimed. */
  rewardClaimedAt: string | null;
  /** Fruits actually banked at claim time, or null if unclaimed. */
  rewardAmount: number | null;
  profile: ChallengeProfile;
}

export interface ChallengeItem {
  id: string;
  creatorId: string;
  participants: ChallengeParticipant[];
  /** The current user's participant record, or null if not found */
  myParticipant: ChallengeParticipant | null;
  tagId: string;
  tagName: string;
  tagIcon: string;
  period: 'daily' | 'weekly';
  targetMinutes: number;
  totalPeriods: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'declined' | 'cancelled';
  startDate: string | null;
  endDate: string | null;
  /**
   * Legacy flat bounty. Rewards are now proportional to the fruits earned with
   * the challenge tag during the window — see `src/utils/challengeReward.ts`.
   * Kept only as the fallback payout for pre-20260730 rows.
   */
  fruitReward: number;
  rewardMode: ChallengeRewardMode;
  /** True if the current user is an invitee with a pending status */
  isIncoming: boolean;
  /** True once start_date has been reached (challenge is running, not upcoming). */
  hasStarted: boolean;
  createdAt: string;
}

export interface CreateChallengeInput {
  inviteeIds: string[];
  tagId: string;
  tagName: string;
  tagIcon: string;
  period: 'daily' | 'weekly';
  targetMinutes: number;
  startDate: string;
  endDate: string;
  rewardMode: ChallengeRewardMode;
}

export interface ParticipantPeriodData {
  user_id: string;
  display_name: string;
  minutes: number[];
  hits: number;
}

export interface ChallengePeriodDetailsResult {
  periods: string[];
  participants: ParticipantPeriodData[];
  total_periods: number;
}

// --- Helpers ---

/**
 * Compute total periods between start and end dates for a given period type.
 */
export function computeTotalPeriods(startDate: string, endDate: string, period: 'daily' | 'weekly'): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (period === 'weekly') return Math.floor(diffDays / 7);
  return diffDays;
}

// --- Service ---

export const GroveChallengeService = {
  /**
   * Create a new challenge with multiple invitees.
   * Inserts the challenge row, then bulk-inserts participant rows
   * (creator auto-accepted, invitees pending).
   */
  async createChallenge(input: CreateChallengeInput): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Insert challenge row
    const { data: challenge, error } = await supabase
      .from('grove_challenges')
      .insert({
        creator_id: user.id,
        // Legacy columns for backward compat
        challenger_id: user.id,
        challengee_id: input.inviteeIds[0],
        tag_id: input.tagId,
        tag_name: input.tagName,
        tag_icon: input.tagIcon,
        period: input.period,
        target_minutes: input.targetMinutes,
        start_date: input.startDate,
        end_date: input.endDate,
        reward_mode: input.rewardMode,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) throw error;

    // Bulk-insert participant rows
    const participantRows = [
      {
        challenge_id: challenge.id,
        user_id: user.id,
        role: 'creator',
        status: 'accepted',
        // Creator already focuses with this tag, so seed their own tag id.
        tag_id: input.tagId,
      },
      ...input.inviteeIds.map(inviteeId => ({
        challenge_id: challenge.id,
        user_id: inviteeId,
        role: 'invitee',
        status: 'pending',
      })),
    ];

    const { error: participantError } = await supabase
      .from('grove_challenge_participants')
      .insert(participantRows);

    if (participantError) throw participantError;
  },

  /**
   * Accept a pending challenge invitation.
   * Updates the participant row status to 'accepted' and records the
   * participant's own local tag id used to track challenge progress.
   */
  async acceptChallenge(challengeId: string, tagId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_challenge_participants')
      .update({
        status: 'accepted',
        tag_id: tagId,
        updated_at: new Date().toISOString(),
      })
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  /**
   * Decline a pending challenge invitation.
   * Updates the participant row status to 'declined'.
   */
  async declineChallenge(challengeId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_challenge_participants')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  /**
   * Fetch all challenges for the current user, with participant and profile data.
   */
  async fetchChallenges(): Promise<ChallengeItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Find all challenge IDs the user participates in. Skip any the user has
    // dismissed (per-user hide) — the shared row stays for the other party.
    const { data: myParticipations, error: partError } = await supabase
      .from('grove_challenge_participants')
      .select('challenge_id, dismissed_at')
      .eq('user_id', user.id);

    if (partError) throw partError;
    if (!myParticipations || myParticipations.length === 0) return [];

    const challengeIds = myParticipations
      .filter(p => !p.dismissed_at)
      .map(p => p.challenge_id);
    if (challengeIds.length === 0) return [];

    // Fetch challenges
    const { data: challenges, error: challengeError } = await supabase
      .from('grove_challenges')
      .select('*')
      .in('id', challengeIds)
      .in('status', ['pending', 'active', 'completed', 'failed', 'cancelled'])
      .order('created_at', { ascending: false });

    if (challengeError) throw challengeError;
    if (!challenges || challenges.length === 0) return [];

    // Fetch all participants for these challenges via SECURITY DEFINER RPC
    // (direct table query only returns the caller's own rows due to RLS)
    const { data: allParticipants, error: allPartError } = await supabase
      .rpc('get_challenge_participants', {
        p_challenge_ids: challenges.map(c => c.id),
      });

    if (allPartError) throw allPartError;

    // Gather unique user IDs for profiles
    const userIds = [...new Set(
      (allParticipants || []).map(p => p.user_id)
    )];

    const { data: profiles, error: profileError } = await supabase
      .from('grove_profiles')
      .select('user_id, display_name, handle, avatar_url, avatar_color')
      .in('user_id', userIds);

    if (profileError) throw profileError;

    const profileMap = new Map<string, ChallengeProfile>();
    for (const p of profiles || []) {
      profileMap.set(p.user_id, {
        display_name: p.display_name,
        handle: p.handle,
        avatar_url: p.avatar_url,
        avatar_color: p.avatar_color,
      });
    }

    const defaultProfile: ChallengeProfile = {
      display_name: 'Unknown',
      handle: 'unknown',
      avatar_url: null,
      avatar_color: '#6592E9',
    };

    // Group participants by challenge
    const participantsByChallenge = new Map<string, typeof allParticipants>();
    for (const p of allParticipants || []) {
      const list = participantsByChallenge.get(p.challenge_id) || [];
      list.push(p);
      participantsByChallenge.set(p.challenge_id, list);
    }

    // Local calendar day as YYYY-MM-DD, matching the format of c.start_date.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return challenges.map(c => {
      const period: 'daily' | 'weekly' = c.period || 'daily';
      const totalPeriods = (c.start_date && c.end_date)
        ? computeTotalPeriods(c.start_date, c.end_date, period)
        : 0;

      const rawParticipants = participantsByChallenge.get(c.id) || [];
      const participants: ChallengeParticipant[] = rawParticipants.map(p => ({
        id: p.id,
        userId: p.user_id,
        role: p.role,
        status: p.status,
        hits: p.hits,
        outcome: p.outcome,
        tagId: p.tag_id ?? null,
        rewardClaimedAt: p.reward_claimed_at ?? null,
        rewardAmount: p.reward_amount ?? null,
        profile: profileMap.get(p.user_id) || defaultProfile,
      }));

      const myParticipant = participants.find(p => p.userId === user.id) || null;
      const isIncoming = myParticipant?.role === 'invitee' && myParticipant?.status === 'pending';

      // The result is derived per-individual, not shared: each participant's
      // completed/failed depends only on whether THEY hit all periods, so one
      // person winning while another loses is fully supported (and each claims
      // their own reward). "Active" is likewise derived — a challenge is active
      // for me the moment my own participation is accepted (the creator is
      // implicitly accepted at creation); counting begins at start_date via the
      // date-range hit math, no server activation toggle needed.
      const myStatus = myParticipant?.role === 'creator' ? 'accepted' : myParticipant?.status;
      const hasStarted = !!c.start_date && c.start_date <= today;

      // The challenge's last counting day is end_date; once today is past it the
      // challenge is over for me. We finalize the result locally rather than
      // waiting on the server cron (which only runs 2 days later, on its own
      // schedule) — my hits are client-computed and timezone-aware, the same
      // value the server trusts (migration 20260606).
      const isExpired = !!c.end_date && c.end_date < today;

      let effectiveStatus: ChallengeItem['status'];
      if (c.status === 'cancelled') {
        // Challenge-level cancellation (no invitee ever accepted) is shared.
        effectiveStatus = 'cancelled';
      } else if (myStatus !== 'accepted') {
        effectiveStatus = 'pending';
      } else if (myParticipant?.outcome) {
        // Server cron already finalized MY individual outcome — trust it.
        effectiveStatus = myParticipant.outcome;
      } else if (isExpired) {
        // Finalize my own result locally: did I hit every period?
        const iCompleted = totalPeriods > 0 && (myParticipant?.hits ?? 0) >= totalPeriods;
        effectiveStatus = iCompleted ? 'completed' : 'failed';
      } else {
        effectiveStatus = 'active';
      }

      return {
        id: c.id,
        creatorId: c.creator_id,
        participants,
        myParticipant,
        // The current user's own tag drives client/native progress matching;
        // fall back to the challenge's tag id for legacy rows not yet migrated.
        tagId: myParticipant?.tagId ?? c.tag_id,
        tagName: c.tag_name,
        tagIcon: c.tag_icon,
        period,
        targetMinutes: c.target_minutes || 60,
        totalPeriods,
        status: effectiveStatus,
        startDate: c.start_date,
        endDate: c.end_date,
        fruitReward: c.fruit_reward,
        rewardMode: c.reward_mode === 'pooled' ? 'pooled' : 'isolated',
        isIncoming,
        hasStarted,
        createdAt: c.created_at,
      };
    });
  },

  /**
   * Update the current user's hit count for a challenge.
   * Writes to the participant row directly.
   */
  async updateMyHits(challengeId: string, hits: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_challenge_participants')
      .update({ hits, updated_at: new Date().toISOString() })
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  /**
   * Claim the current user's fruit reward for a finished challenge.
   * The server row (reward_claimed_at) is the idempotency guard: it only reports a
   * fresh claim once, so the client credits fruits exactly once even across
   * devices/reinstalls.
   *
   * The amount is computed locally (see `src/utils/challengeReward.ts`) because
   * per-session fruits never reach the cloud; the server records what it is given,
   * mirroring the trust-the-client model already used for hits.
   *
   * @param amount Fruits to bank. Omit to fall back to the legacy flat bounty.
   * @returns `{ claimed, fruitReward }` — `claimed` is true only on the FIRST claim
   *   (credit fruits); false if it was already claimed previously, in which case
   *   `fruitReward` is the amount that was banked then.
   */
  async claimChallengeReward(
    challengeId: string,
    amount?: number
  ): Promise<{ claimed: boolean; fruitReward: number }> {
    const { data, error } = await supabase.rpc('claim_challenge_reward', {
      p_challenge_id: challengeId,
      ...(amount != null ? { p_amount: Math.max(0, Math.round(amount)) } : {}),
    });

    if (error) throw error;
    return {
      claimed: !!data?.claimed,
      fruitReward: data?.fruit_reward ?? 0,
    };
  },

  /**
   * Fetch per-period breakdown for a challenge (all participants' minutes per day/week).
   */
  async fetchPeriodDetails(challengeId: string, userTz: string = 'UTC'): Promise<ChallengePeriodDetailsResult> {
    const { data, error } = await supabase.rpc('get_challenge_period_details', {
      p_challenge_id: challengeId,
      p_user_tz: userTz,
    });

    if (error) throw error;
    return data as ChallengePeriodDetailsResult;
  },

  /**
   * Delete a challenge (only for cancelled challenges, by creator).
   */
  async deleteChallenge(challengeId: string): Promise<void> {
    const { error } = await supabase
      .from('grove_challenges')
      .delete()
      .eq('id', challengeId);

    if (error) throw error;
  },

  /**
   * Dismiss a finished challenge (completed/failed) from the current user's
   * own list without deleting the shared row. Either party may do this; the
   * challenge stays visible to the other participant until they dismiss it too.
   */
  async dismissChallenge(challengeId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_challenge_participants')
      .update({ dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id);

    if (error) throw error;
  },
};
