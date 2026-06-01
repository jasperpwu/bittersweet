import { supabase } from '../../config/supabase';
import type { GroveProfile } from './GroveService';

// --- Types ---

export interface FriendItem {
  friendshipId: string;
  profile: GroveProfile;
}

export interface FriendRequest {
  friendshipId: string;
  profile: GroveProfile;
  direction: 'incoming' | 'outgoing';
  createdAt: string;
}

export interface InviteLink {
  id: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface ResolveInviteResult {
  status: 'accepted';
  friend: GroveProfile;
}

export interface LookupInviteResult {
  status: 'available' | 'already_friends';
  profile: GroveProfile;
}

// --- Service ---

export const GroveFriendService = {
  /**
   * Fetch all accepted friends for the current user.
   * Joins with grove_profiles to get friend profile data.
   */
  async fetchFriends(): Promise<FriendItem[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_friendships')
      .select('id, requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Get the friend user IDs (the other side of each friendship)
    const friendUserIds = data.map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    // Fetch their profiles
    const { data: profiles, error: profileError } = await supabase
      .from('grove_profiles')
      .select('*')
      .in('user_id', friendUserIds);

    if (profileError) throw profileError;

    // Map friendship ID to profile
    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of profiles || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    return data
      .map((f) => {
        const friendUserId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        const profile = profileByUserId.get(friendUserId);
        if (!profile) return null;
        return { friendshipId: f.id, profile };
      })
      .filter((item): item is FriendItem => item !== null);
  },

  /**
   * Remove a friend (delete the friendship row).
   */
  async removeFriend(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from('grove_friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) throw error;
  },

  /**
   * Fetch pending friend requests (both incoming and outgoing).
   */
  async fetchFriendRequests(): Promise<FriendRequest[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('grove_friendships')
      .select('id, requester_id, addressee_id, created_at')
      .eq('status', 'pending')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Get all related user IDs
    const otherUserIds = data.map((f) =>
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    );

    const { data: profiles, error: profileError } = await supabase
      .from('grove_profiles')
      .select('*')
      .in('user_id', otherUserIds);

    if (profileError) throw profileError;

    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of profiles || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    return data
      .map((f) => {
        const isIncoming = f.addressee_id === user.id;
        const otherUserId = isIncoming ? f.requester_id : f.addressee_id;
        const profile = profileByUserId.get(otherUserId);
        if (!profile) return null;
        return {
          friendshipId: f.id,
          profile,
          direction: isIncoming ? 'incoming' : 'outgoing',
          createdAt: f.created_at,
        } as FriendRequest;
      })
      .filter((item): item is FriendRequest => item !== null);
  },

  /**
   * Accept a pending friend request.
   */
  async acceptFriendRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from('grove_friendships')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    if (error) throw error;
  },

  /**
   * Reject a pending friend request.
   */
  async rejectFriendRequest(friendshipId: string): Promise<void> {
    const { error } = await supabase
      .from('grove_friendships')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', friendshipId);

    if (error) throw error;
  },

  /**
   * Generate a new invite link for the current user.
   * If an active link already exists, returns it instead.
   */
  async generateInviteLink(): Promise<InviteLink> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check for existing active link
    const { data: existing, error: fetchError } = await supabase
      .from('grove_invite_links')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (existing) {
      return {
        id: existing.id,
        code: existing.code,
        isActive: existing.is_active,
        createdAt: existing.created_at,
      };
    }

    // Generate a new code: 8-char alphanumeric
    const code = Array.from({ length: 8 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
        Math.floor(Math.random() * 62)
      ]
    ).join('');

    const { data, error } = await supabase
      .from('grove_invite_links')
      .insert({ user_id: user.id, code })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      code: data.code,
      isActive: data.is_active,
      createdAt: data.created_at,
    };
  },

  /**
   * Look up an invite code without creating a friendship.
   * Returns the inviter's profile and relationship status.
   */
  async lookupInviteCode(code: string): Promise<LookupInviteResult> {
    const { data, error } = await supabase.rpc('lookup_invite_code', {
      invite_code: code,
    });

    if (error) throw error;

    const result = data as any;
    if (result.error) {
      throw new Error(result.error);
    }

    return {
      status: result.status,
      profile: result.profile,
    };
  },

  /**
   * Resolve an invite code via the RPC function.
   * Auto-creates an accepted friendship.
   */
  async resolveInviteCode(code: string): Promise<ResolveInviteResult> {
    const { data, error } = await supabase.rpc('resolve_invite_code', {
      invite_code: code,
    });

    if (error) throw error;

    const result = data as any;
    if (result.error) {
      throw new Error(result.error);
    }

    return {
      status: result.status,
      friend: result.friend,
    };
  },
};
