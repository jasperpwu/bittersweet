import { supabase } from '../../config/supabase';
import type { GroveProfile } from './GroveService';

// --- Types ---

export interface FeedSession {
  id: string;
  user_id: string;
  tag_id: string;
  duration: number;
  start_time: string;
  end_time: string;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
  // Joined from session_tags
  session_tags: { name: string; icon: string } | null;
}

export interface FeedItem {
  session: FeedSession;
  profile: GroveProfile;
  reactionCount: number;
  hasReacted: boolean;
}

// --- Service ---

export const GroveFeedService = {
  /**
   * Fetch the social feed: focus sessions from friends (today + yesterday).
   * Joins with session_tags for tag info and grove_profiles for display info.
   * RLS handles friend + privacy filtering automatically.
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

    // Fetch focus sessions from the last 2 days (RLS handles friend + privacy filtering)
    const { data: sessions, error: sessionsError } = await supabase
      .from('focus_sessions')
      .select('id, user_id, tag_id, duration, start_time, end_time, notes, photo_url, created_at, session_tags(name, icon)')
      .gte('start_time', cutoff)
      .neq('user_id', user.id)
      .is('deleted_at', null)
      .order('start_time', { ascending: false });

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) return [];

    // Get unique user IDs to fetch profiles
    const userIds = [...new Set(sessions.map((s) => s.user_id))];

    // Fetch profiles, privacy settings, and reactions in parallel
    const [profilesResult, privacyResult, reactionsResult, userReactionsResult] = await Promise.all([
      supabase
        .from('grove_profiles')
        .select('*')
        .in('user_id', userIds),
      supabase
        .from('grove_privacy_settings')
        .select('user_id, share_notes')
        .in('user_id', userIds),
      supabase
        .from('grove_reactions')
        .select('session_id')
        .in('session_id', sessions.map((s) => s.id)),
      supabase
        .from('grove_reactions')
        .select('session_id')
        .eq('user_id', user.id)
        .in('session_id', sessions.map((s) => s.id)),
    ]);

    if (profilesResult.error) throw profilesResult.error;

    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of profilesResult.data || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    // Track which users allow sharing notes
    const shareNotesByUserId = new Map<string, boolean>();
    for (const p of privacyResult.data || []) {
      shareNotesByUserId.set(p.user_id, p.share_notes);
    }

    // Count reactions per session
    const reactionCounts = new Map<string, number>();
    for (const r of reactionsResult.data || []) {
      reactionCounts.set(r.session_id, (reactionCounts.get(r.session_id) || 0) + 1);
    }

    // Track which sessions the current user has reacted to
    const userReactedSessions = new Set<string>();
    for (const r of userReactionsResult.data || []) {
      userReactedSessions.add(r.session_id);
    }

    return sessions
      .map((session) => {
        const profile = profileByUserId.get(session.user_id);
        if (!profile) return null;

        // Respect share_notes privacy: null out notes and photo_url if the user has it disabled
        const canShareNotes = shareNotesByUserId.get(session.user_id) ?? false;
        const feedSession: FeedSession = {
          ...(session as FeedSession),
          notes: canShareNotes ? session.notes : null,
          photo_url: canShareNotes ? (session as any).photo_url : null,
        };

        return {
          session: feedSession,
          profile,
          reactionCount: reactionCounts.get(session.id) || 0,
          hasReacted: userReactedSessions.has(session.id),
        };
      })
      .filter((item): item is FeedItem => item !== null);
  },

  /**
   * Fetch focus sessions for a specific friend (last 50 sessions, no time cutoff).
   * RLS handles friend + privacy filtering.
   */
  async fetchFriendFeed(friendUserId: string): Promise<FeedItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Fetch the friend's focus sessions (RLS handles visibility)
    const { data: sessions, error: sessionsError } = await supabase
      .from('focus_sessions')
      .select('id, user_id, tag_id, duration, start_time, end_time, notes, photo_url, created_at, session_tags(name, icon)')
      .eq('user_id', friendUserId)
      .is('deleted_at', null)
      .order('start_time', { ascending: false })
      .limit(50);

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) return [];

    // Fetch profile, privacy settings, and reactions in parallel
    const [profileResult, privacyResult, reactionsResult, userReactionsResult] = await Promise.all([
      supabase
        .from('grove_profiles')
        .select('*')
        .eq('user_id', friendUserId)
        .single(),
      supabase
        .from('grove_privacy_settings')
        .select('share_notes')
        .eq('user_id', friendUserId)
        .single(),
      supabase
        .from('grove_reactions')
        .select('session_id')
        .in('session_id', sessions.map((s) => s.id)),
      supabase
        .from('grove_reactions')
        .select('session_id')
        .eq('user_id', user.id)
        .in('session_id', sessions.map((s) => s.id)),
    ]);

    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
    if (!profile) return [];

    const canShareNotes = privacyResult.data?.share_notes ?? false;

    // Count reactions per session
    const reactionCounts = new Map<string, number>();
    for (const r of reactionsResult.data || []) {
      reactionCounts.set(r.session_id, (reactionCounts.get(r.session_id) || 0) + 1);
    }

    // Track which sessions the current user has reacted to
    const userReactedSessions = new Set<string>();
    for (const r of userReactionsResult.data || []) {
      userReactedSessions.add(r.session_id);
    }

    return sessions.map((session) => ({
      session: {
        ...(session as FeedSession),
        notes: canShareNotes ? session.notes : null,
        photo_url: canShareNotes ? (session as any).photo_url : null,
      },
      profile,
      reactionCount: reactionCounts.get(session.id) || 0,
      hasReacted: userReactedSessions.has(session.id),
    }));
  },

  /**
   * Add a reaction (clap) to a focus session.
   */
  async addReaction(sessionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_reactions')
      .insert({ session_id: sessionId, user_id: user.id });

    // Ignore unique constraint violation (already reacted)
    if (error && error.code !== '23505') throw error;
  },

  /**
   * Remove a reaction from a focus session.
   */
  async removeReaction(sessionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_reactions')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    if (error) throw error;
  },
};
