import { supabase } from '../../config/supabase';
import type { GroveProfile } from './GroveService';

// --- Types ---

export interface SharedSession {
  id: string;
  user_id: string;
  session_id: string;
  tag_id: string;
  tag_name: string;
  tag_icon: string;
  duration: number;
  start_time: string;
  end_time: string;
  notes: string | null;
  shared_at: string;
}

export interface FeedItem {
  sharedSession: SharedSession;
  profile: GroveProfile;
  reactionCount: number;
  hasReacted: boolean;
}

export interface ShareSessionInput {
  sessionId: string;
  tagId: string;
  tagName: string;
  tagIcon: string;
  duration: number;
  startTime: string;
  endTime: string;
  notes: string | null;
}

// --- Service ---

export const GroveFeedService = {
  /**
   * Share a completed session to Grove.
   * Uses upsert to handle duplicate session_id gracefully.
   */
  async shareSession(input: ShareSessionInput): Promise<SharedSession> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_shared_sessions')
      .upsert(
        {
          user_id: user.id,
          session_id: input.sessionId,
          tag_id: input.tagId,
          tag_name: input.tagName,
          tag_icon: input.tagIcon,
          duration: input.duration,
          start_time: input.startTime,
          end_time: input.endTime,
          notes: input.notes,
        },
        { onConflict: 'user_id,session_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Fetch the social feed: shared sessions from friends (today + yesterday).
   * Joins with grove_profiles for display info, and counts reactions.
   */
  async fetchFeed(): Promise<FeedItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Calculate the cutoff: start of yesterday in UTC
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const cutoff = yesterday.toISOString();

    // Fetch shared sessions from the last 2 days (RLS handles friend visibility)
    const { data: sessions, error: sessionsError } = await supabase
      .from('grove_shared_sessions')
      .select('*')
      .gte('shared_at', cutoff)
      .neq('user_id', user.id)
      .order('shared_at', { ascending: false });

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) return [];

    // Get unique user IDs to fetch profiles
    const userIds = [...new Set(sessions.map((s) => s.user_id))];

    // Fetch profiles and reactions in parallel
    const [profilesResult, reactionsResult, userReactionsResult] = await Promise.all([
      supabase
        .from('grove_profiles')
        .select('*')
        .in('user_id', userIds),
      supabase
        .from('grove_reactions')
        .select('shared_session_id')
        .in('shared_session_id', sessions.map((s) => s.id)),
      supabase
        .from('grove_reactions')
        .select('shared_session_id')
        .eq('user_id', user.id)
        .in('shared_session_id', sessions.map((s) => s.id)),
    ]);

    if (profilesResult.error) throw profilesResult.error;

    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of profilesResult.data || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    // Count reactions per session
    const reactionCounts = new Map<string, number>();
    for (const r of reactionsResult.data || []) {
      reactionCounts.set(r.shared_session_id, (reactionCounts.get(r.shared_session_id) || 0) + 1);
    }

    // Track which sessions the current user has reacted to
    const userReactedSessions = new Set<string>();
    for (const r of userReactionsResult.data || []) {
      userReactedSessions.add(r.shared_session_id);
    }

    return sessions
      .map((session) => {
        const profile = profileByUserId.get(session.user_id);
        if (!profile) return null;
        return {
          sharedSession: session,
          profile,
          reactionCount: reactionCounts.get(session.id) || 0,
          hasReacted: userReactedSessions.has(session.id),
        };
      })
      .filter((item): item is FeedItem => item !== null);
  },

  /**
   * Add a reaction (clap) to a shared session.
   */
  async addReaction(sharedSessionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_reactions')
      .insert({ shared_session_id: sharedSessionId, user_id: user.id });

    // Ignore unique constraint violation (already reacted)
    if (error && error.code !== '23505') throw error;
  },

  /**
   * Remove a reaction from a shared session.
   */
  async removeReaction(sharedSessionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_reactions')
      .delete()
      .eq('shared_session_id', sharedSessionId)
      .eq('user_id', user.id);

    if (error) throw error;
  },
};
