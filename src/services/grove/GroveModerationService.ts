import { supabase } from '../../config/supabase';
import type { GroveProfile } from './GroveService';

// --- Types ---

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'impersonation' | 'other';

export interface BlockedUser {
  userId: string;
  blockedAt: string;
  /** Null when the profile row is no longer readable (deactivated/deleted). */
  profile: GroveProfile | null;
}

export interface ReportInput {
  reportedUserId: string;
  /** Set when reporting one session; omitted for a profile-level report. */
  sessionId?: string;
  reason: ReportReason;
  details?: string;
}

// --- Service ---

export const GroveModerationService = {
  /**
   * User IDs the current user has blocked. RLS already hides blocked users'
   * content server-side; the client keeps this list so already-fetched data
   * (feed cache, rankings from the SECURITY DEFINER ranking RPC) can be
   * filtered without a refetch.
   */
  async fetchBlockedUserIds(): Promise<string[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id);

    if (error) throw error;
    return (data || []).map((row) => row.blocked_id);
  },

  /**
   * Blocked users with their profiles, for the "Blocked accounts" screen.
   */
  async fetchBlockedUsers(): Promise<BlockedUser[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // The blocked-pair RLS guard hides these profiles from normal reads, so go
    // through the same SECURITY DEFINER lookup the unblock screen needs.
    const { data: profiles, error: profileError } = await supabase.rpc('get_blocked_profiles');
    if (profileError) throw profileError;

    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of (profiles as GroveProfile[] | null) || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    return data.map((row) => ({
      userId: row.blocked_id,
      blockedAt: row.created_at,
      profile: profileByUserId.get(row.blocked_id) ?? null,
    }));
  },

  /**
   * Block a user: record the block, then tear down any existing friendship in
   * either direction. Order matters — the block row must land first so the
   * restrictive INSERT policy stops a request racing back in.
   */
  async blockUser(blockedUserId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_blocks')
      .insert({ blocker_id: user.id, blocked_id: blockedUserId });

    // 23505 = already blocked; treat as success so the UI stays idempotent.
    if (error && error.code !== '23505') throw error;

    const { error: friendshipError } = await supabase
      .from('grove_friendships')
      .delete()
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${blockedUserId}),` +
          `and(requester_id.eq.${blockedUserId},addressee_id.eq.${user.id})`
      );

    if (friendshipError) throw friendshipError;
  },

  async unblockUser(blockedUserId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('grove_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedUserId);

    if (error) throw error;
  },

  /**
   * File a report. Triage happens server-side (Supabase dashboard) — the
   * client never reads anyone else's reports.
   */
  async reportUser(input: ReportInput): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.from('grove_reports').insert({
      reporter_id: user.id,
      reported_user_id: input.reportedUserId,
      session_id: input.sessionId ?? null,
      reason: input.reason,
      details: input.details ?? null,
    });

    if (error) throw error;
  },
};
