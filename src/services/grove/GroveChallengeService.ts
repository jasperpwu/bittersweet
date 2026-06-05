import { supabase } from '../../config/supabase';

// --- Types ---

export interface ChallengeProfile {
  display_name: string;
  handle: string;
  avatar_url: string | null;
  avatar_color: string;
}

export interface ChallengeParticipant {
  id: string;
  userId: string;
  role: 'creator' | 'invitee';
  status: 'pending' | 'accepted' | 'declined';
  hits: number;
  outcome: 'completed' | 'failed' | null;
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
  fruitReward: number;
  /** True if the current user is an invitee with a pending status */
  isIncoming: boolean;
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
   * Updates the participant row status to 'accepted'.
   */
  async acceptChallenge(challengeId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_challenge_participants')
      .update({
        status: 'accepted',
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

    // Find all challenge IDs the user participates in
    const { data: myParticipations, error: partError } = await supabase
      .from('grove_challenge_participants')
      .select('challenge_id')
      .eq('user_id', user.id);

    if (partError) throw partError;
    if (!myParticipations || myParticipations.length === 0) return [];

    const challengeIds = myParticipations.map(p => p.challenge_id);

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
        profile: profileMap.get(p.user_id) || defaultProfile,
      }));

      const myParticipant = participants.find(p => p.userId === user.id) || null;
      const isIncoming = myParticipant?.role === 'invitee' && myParticipant?.status === 'pending';

      return {
        id: c.id,
        creatorId: c.creator_id,
        participants,
        myParticipant,
        tagId: c.tag_id,
        tagName: c.tag_name,
        tagIcon: c.tag_icon,
        period,
        targetMinutes: c.target_minutes || 60,
        totalPeriods,
        status: c.status,
        startDate: c.start_date,
        endDate: c.end_date,
        fruitReward: c.fruit_reward,
        isIncoming,
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
};
