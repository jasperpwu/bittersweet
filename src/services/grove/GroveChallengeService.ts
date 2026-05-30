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
  streakDays: number;
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
        streak_days: input.streakDays,
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

    // Fetch to get streak_days for end_date calculation
    const { data: challenge, error: fetchError } = await supabase
      .from('grove_challenges')
      .select('streak_days')
      .eq('id', challengeId)
      .single();

    if (fetchError) throw fetchError;

    const startDate = new Date();
    const endDate = new Date(startDate);
    // Allow streak_days + some buffer for both users to complete
    endDate.setDate(endDate.getDate() + challenge.streak_days + 2);

    const { error } = await supabase
      .from('grove_challenges')
      .update({
        status: 'active',
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
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
