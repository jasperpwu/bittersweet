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
  streakDays: number;
  period: 'daily' | 'weekly';
  targetMinutes: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'declined';
  startDate: string | null;
  endDate: string | null;
  challengerStreak: number;
  challengeeStreak: number;
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
  repeatUntilDate: string | null;
}

export interface ChallengeProgressResult {
  status: string;
  streak?: number;
  reward?: number;
  error?: string;
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
        repeat_until_date: input.repeatUntilDate,
        status: 'pending',
      });

    if (error) throw error;
  },

  /**
   * Accept a pending challenge. Sets status to 'active', computes start/end dates.
   */
  async acceptChallenge(challengeId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch challenge to get period, start_date, and repeat_until_date
    const { data: challenge, error: fetchError } = await supabase
      .from('grove_challenges')
      .select('period, start_date, repeat_until_date, streak_days')
      .eq('id', challengeId)
      .single();

    if (fetchError) throw fetchError;

    // Use the creator-specified start_date; fall back to today if missing (legacy)
    const startDate = challenge.start_date || new Date().toISOString().split('T')[0];

    // Compute end_date from repeat_until_date, or fall back to legacy streak_days logic
    let endDate: string;
    if (challenge.repeat_until_date) {
      endDate = challenge.repeat_until_date;
    } else if (challenge.streak_days) {
      const end = new Date(startDate);
      end.setDate(end.getDate() + challenge.streak_days + 2);
      endDate = end.toISOString().split('T')[0];
    } else {
      // No end date — open-ended challenge
      endDate = '';
    }

    const updatePayload: Record<string, any> = {
      status: 'active',
      start_date: startDate,
      updated_at: new Date().toISOString(),
    };
    if (endDate) {
      updatePayload.end_date = endDate;
    }

    const { error } = await supabase
      .from('grove_challenges')
      .update(updatePayload)
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

    return challenges.map(c => ({
      id: c.id,
      challengerId: c.challenger_id,
      challengeeId: c.challengee_id,
      challengerProfile: profileMap.get(c.challenger_id) || defaultProfile,
      challengeeProfile: profileMap.get(c.challengee_id) || defaultProfile,
      tagId: c.tag_id,
      tagName: c.tag_name,
      tagIcon: c.tag_icon,
      streakDays: c.streak_days,
      period: c.period || 'daily',
      targetMinutes: c.target_minutes || 60,
      status: c.status,
      startDate: c.start_date,
      endDate: c.end_date,
      challengerStreak: c.challenger_streak,
      challengeeStreak: c.challengee_streak,
      fruitReward: c.fruit_reward,
      isIncoming: c.challengee_id === user.id,
      createdAt: c.created_at,
    }));
  },

  /**
   * Record progress for a challenge via the server-side RPC.
   */
  async recordProgress(challengeId: string): Promise<ChallengeProgressResult> {
    const { data, error } = await supabase.rpc('record_challenge_progress', {
      challenge_id: challengeId,
    });

    if (error) throw error;
    return data as ChallengeProgressResult;
  },
};
