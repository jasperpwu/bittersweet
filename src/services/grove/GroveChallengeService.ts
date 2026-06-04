import { supabase } from '../../config/supabase';

// --- Types ---

export interface ChallengeProfile {
  display_name: string;
  handle: string;
  avatar_url: string | null;
  avatar_color: string;
}

export interface ChallengeItem {
  id: string;
  challengerId: string;
  challengeeId: string;
  challengerProfile: ChallengeProfile;
  challengeeProfile: ChallengeProfile;
  tagId: string;
  tagName: string;
  tagIcon: string;
  period: 'daily' | 'weekly';
  targetMinutes: number;
  totalPeriods: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'declined';
  startDate: string | null;
  endDate: string | null;
  challengerHits: number;
  challengeeHits: number;
  fruitReward: number;
  isIncoming: boolean;
  createdAt: string;
}

export interface CreateChallengeInput {
  challengeeId: string;
  tagId: string;
  tagName: string;
  tagIcon: string;
  period: 'daily' | 'weekly';
  targetMinutes: number;
  startDate: string;
  endDate: string;
}

export interface ChallengePeriodDetail {
  date: string;
  challenger_minutes: number;
  challengee_minutes: number;
}

export interface ChallengePeriodDetailsResult {
  periods: ChallengePeriodDetail[];
  challenger_total: number;
  challengee_total: number;
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
   * Create a new challenge (sends to another user).
   */
  async createChallenge(input: CreateChallengeInput): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_challenges')
      .insert({
        challenger_id: user.id,
        challengee_id: input.challengeeId,
        tag_id: input.tagId,
        tag_name: input.tagName,
        tag_icon: input.tagIcon,
        period: input.period,
        target_minutes: input.targetMinutes,
        start_date: input.startDate,
        end_date: input.endDate,
        status: 'pending',
      });

    if (error) throw error;
  },

  /**
   * Accept a pending challenge. Sets status to 'active'.
   * start_date and end_date are already set at creation time.
   */
  async acceptChallenge(challengeId: string): Promise<void> {
    const { error } = await supabase
      .from('grove_challenges')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', challengeId);

    if (error) throw error;
  },

  /**
   * Decline a pending challenge.
   */
  async declineChallenge(challengeId: string): Promise<void> {
    const { error } = await supabase
      .from('grove_challenges')
      .update({
        status: 'declined',
        updated_at: new Date().toISOString(),
      })
      .eq('id', challengeId);

    if (error) throw error;
  },

  /**
   * Fetch all challenges for the current user, with profile data.
   */
  async fetchChallenges(): Promise<ChallengeItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: challenges, error } = await supabase
      .from('grove_challenges')
      .select('*')
      .or(`challenger_id.eq.${user.id},challengee_id.eq.${user.id}`)
      .in('status', ['pending', 'active', 'completed', 'failed'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!challenges || challenges.length === 0) return [];

    // Gather unique user IDs for profiles
    const userIds = [...new Set(
      challenges.flatMap(c => [c.challenger_id, c.challengee_id])
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

    return challenges.map(c => {
      const period: 'daily' | 'weekly' = c.period || 'daily';
      const totalPeriods = (c.start_date && c.end_date)
        ? computeTotalPeriods(c.start_date, c.end_date, period)
        : 0;

      return {
        id: c.id,
        challengerId: c.challenger_id,
        challengeeId: c.challengee_id,
        challengerProfile: profileMap.get(c.challenger_id) || defaultProfile,
        challengeeProfile: profileMap.get(c.challengee_id) || defaultProfile,
        tagId: c.tag_id,
        tagName: c.tag_name,
        tagIcon: c.tag_icon,
        period,
        targetMinutes: c.target_minutes || 60,
        totalPeriods,
        status: c.status,
        startDate: c.start_date,
        endDate: c.end_date,
        challengerHits: c.challenger_hits,
        challengeeHits: c.challengee_hits,
        fruitReward: c.fruit_reward,
        isIncoming: c.challengee_id === user.id,
        createdAt: c.created_at,
      };
    });
  },

  /**
   * Update the current user's hit count for a challenge.
   * Writes to challenger_hits or challengee_hits depending on isChallenger.
   */
  async updateMyHits(challengeId: string, isChallenger: boolean, hits: number): Promise<void> {
    const column = isChallenger ? 'challenger_hits' : 'challengee_hits';
    const { error } = await supabase
      .from('grove_challenges')
      .update({ [column]: hits, updated_at: new Date().toISOString() })
      .eq('id', challengeId);

    if (error) throw error;
  },

  /**
   * Fetch per-period breakdown for a challenge (both users' minutes per day/week).
   */
  async fetchPeriodDetails(challengeId: string, userTz: string = 'UTC'): Promise<ChallengePeriodDetailsResult> {
    const { data, error } = await supabase.rpc('get_challenge_period_details', {
      p_challenge_id: challengeId,
      p_user_tz: userTz,
    });

    if (error) throw error;
    return data as ChallengePeriodDetailsResult;
  },
};
