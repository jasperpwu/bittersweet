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
  // false → the author is a public stranger surfaced by the discovery feed
  // (show an "invite" affordance). undefined/true → friend or own session.
  isFriend?: boolean;
}

// Below this friend count the main feed also surfaces recent sessions from
// public strangers (discovery), Instagram-stories style.
const DISCOVERY_FRIEND_THRESHOLD = 5;
const DISCOVERY_MAX_ITEMS = 30;

type SessionRow = FeedSession & { user_id: string };

// --- Internal helpers ---

/** Accepted-friend user IDs for the given user (both request directions). */
async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('grove_friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return (data || []).map((f) =>
    f.requester_id === userId ? f.addressee_id : f.requester_id
  );
}

/** Hydrate raw session rows into FeedItems (profiles + reaction counts). */
async function assembleFeedItems(
  currentUserId: string,
  sessions: SessionRow[],
  isFriend: boolean
): Promise<FeedItem[]> {
  if (sessions.length === 0) return [];

  const userIds = [...new Set(sessions.map((s) => s.user_id))];
  const sessionIds = sessions.map((s) => s.id);

  const [profilesResult, reactionsResult, userReactionsResult] = await Promise.all([
    supabase.from('grove_profiles').select('*').in('user_id', userIds),
    supabase.from('grove_reactions').select('session_id').in('session_id', sessionIds),
    supabase
      .from('grove_reactions')
      .select('session_id')
      .eq('user_id', currentUserId)
      .in('session_id', sessionIds),
  ]);

  if (profilesResult.error) throw profilesResult.error;

  const profileByUserId = new Map<string, GroveProfile>();
  for (const profile of profilesResult.data || []) {
    profileByUserId.set(profile.user_id, profile);
  }

  const reactionCounts = new Map<string, number>();
  for (const r of reactionsResult.data || []) {
    reactionCounts.set(r.session_id, (reactionCounts.get(r.session_id) || 0) + 1);
  }

  const userReactedSessions = new Set<string>();
  for (const r of userReactionsResult.data || []) {
    userReactedSessions.add(r.session_id);
  }

  return sessions
    .map((session): FeedItem | null => {
      const profile = profileByUserId.get(session.user_id);
      if (!profile) return null;
      return {
        session: session as FeedSession,
        profile,
        reactionCount: reactionCounts.get(session.id) || 0,
        hasReacted: userReactedSessions.has(session.id),
        isFriend,
      };
    })
    .filter((item): item is FeedItem => item !== null);
}

const SESSION_SELECT =
  'id, user_id, tag_id, duration, start_time, end_time, notes, photo_url, created_at, session_tags(name, icon)';

// --- Service ---

export const GroveFeedService = {
  /**
   * Fetch the social feed: recent focus sessions from friends (last 2 days).
   * When the user has fewer than DISCOVERY_FRIEND_THRESHOLD friends, also mixes
   * in recent sessions from public strangers (discovery, last 7 days) so the
   * feed isn't empty — those items carry isFriend=false for the invite affordance.
   */
  async fetchFeed(): Promise<FeedItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const friendIds = await getAcceptedFriendIds(user.id);

    // Friends' recent sessions (last 2 days). Scoped explicitly to friend IDs —
    // RLS now also exposes public strangers, so we can't rely on it to limit here.
    const friendCutoff = new Date();
    friendCutoff.setDate(friendCutoff.getDate() - 1);
    friendCutoff.setHours(0, 0, 0, 0);

    let friendItems: FeedItem[] = [];
    if (friendIds.length > 0) {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select(SESSION_SELECT)
        .in('user_id', friendIds)
        .gte('start_time', friendCutoff.toISOString())
        .is('deleted_at', null)
        .order('start_time', { ascending: false });
      if (error) throw error;
      friendItems = await assembleFeedItems(user.id, (data ?? []) as unknown as SessionRow[], true);
    }

    // Discovery: recent public strangers' sessions (last 7 days), only for users
    // still building their friend list. RLS restricts these to public+active authors.
    let discoveryItems: FeedItem[] = [];
    if (friendIds.length < DISCOVERY_FRIEND_THRESHOLD) {
      const discoveryCutoff = new Date();
      discoveryCutoff.setDate(discoveryCutoff.getDate() - 7);

      let query = supabase
        .from('focus_sessions')
        .select(SESSION_SELECT)
        .neq('user_id', user.id)
        .gte('start_time', discoveryCutoff.toISOString())
        .is('deleted_at', null)
        .order('start_time', { ascending: false })
        .limit(DISCOVERY_MAX_ITEMS);
      if (friendIds.length > 0) {
        query = query.not('user_id', 'in', `(${friendIds.join(',')})`);
      }
      const { data, error } = await query;
      if (error) throw error;
      discoveryItems = await assembleFeedItems(user.id, (data ?? []) as unknown as SessionRow[], false);
    }

    // Merge into a single recency-ordered feed (stories-style).
    return [...friendItems, ...discoveryItems].sort(
      (a, b) =>
        new Date(b.session.start_time).getTime() - new Date(a.session.start_time).getTime()
    );
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

    // Fetch profile and reactions in parallel
    const [profileResult, reactionsResult, userReactionsResult] = await Promise.all([
      supabase
        .from('grove_profiles')
        .select('*')
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
      .map((session) => ({
        session: {
          ...(session as FeedSession),
          notes: session.notes,
          photo_url: (session as any).photo_url,
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
