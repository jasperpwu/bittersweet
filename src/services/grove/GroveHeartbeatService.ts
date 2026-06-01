import { supabase } from '../../config/supabase';
import type { GroveProfile } from './GroveService';

// --- Types ---

export interface HeartbeatSettings {
  isEnabled: boolean;
  quietThresholdDays: 3 | 5 | 7 | 14;
  isPaused: boolean;
  pauseDuration: '1_week' | '2_weeks' | '1_month' | null;
  pauseStartedAt: string | null;
  pauseExpiresAt: string | null;
  lastActiveAt: string;
}

export interface InnerCircleMember {
  id: string;
  userId: string;
  circleMemberId: string;
  status: 'pending' | 'accepted' | 'declined' | 'removed';
  profile: GroveProfile;
  invitedAt: string;
  acceptedAt: string | null;
}

export interface HeartbeatAlert {
  id: string;
  aboutUserId: string;
  aboutProfile: GroveProfile;
  triggerType: 'quiet_threshold' | 'blocklist_edit' | 'heartbeat_paused';
  notificationText: string;
  sentAt: string;
  readAt: string | null;
}

type PauseDuration = '1_week' | '2_weeks' | '1_month';

const PAUSE_DURATION_DAYS: Record<PauseDuration, number> = {
  '1_week': 7,
  '2_weeks': 14,
  '1_month': 30,
};

// --- Service ---

export const GroveHeartbeatService = {
  /**
   * Fetch heartbeat settings for the current user.
   */
  async fetchSettings(): Promise<HeartbeatSettings | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('heartbeat_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      isEnabled: data.is_enabled,
      quietThresholdDays: data.quiet_threshold_days,
      isPaused: data.is_paused,
      pauseDuration: data.pause_duration,
      pauseStartedAt: data.pause_started_at,
      pauseExpiresAt: data.pause_expires_at,
      lastActiveAt: data.last_active_at,
    };
  },

  /**
   * Update heartbeat settings (e.g. threshold, enabled).
   */
  async updateSettings(updates: {
    isEnabled?: boolean;
    quietThresholdDays?: 3 | 5 | 7 | 14;
  }): Promise<HeartbeatSettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const dbUpdates: Record<string, any> = {};
    if (updates.isEnabled !== undefined) dbUpdates.is_enabled = updates.isEnabled;
    if (updates.quietThresholdDays !== undefined) dbUpdates.quiet_threshold_days = updates.quietThresholdDays;

    const { data, error } = await supabase
      .from('heartbeat_settings')
      .upsert({ user_id: user.id, ...dbUpdates }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    return {
      isEnabled: data.is_enabled,
      quietThresholdDays: data.quiet_threshold_days,
      isPaused: data.is_paused,
      pauseDuration: data.pause_duration,
      pauseStartedAt: data.pause_started_at,
      pauseExpiresAt: data.pause_expires_at,
      lastActiveAt: data.last_active_at,
    };
  },

  /**
   * Pause heartbeat for a given duration. Inner circle will be notified.
   */
  async pauseHeartbeat(duration: PauseDuration): Promise<HeartbeatSettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAUSE_DURATION_DAYS[duration] * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('heartbeat_settings')
      .upsert(
        {
          user_id: user.id,
          is_paused: true,
          pause_duration: duration,
          pause_started_at: now.toISOString(),
          pause_expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;

    // Notify inner circle members that the user is pausing (via Edge Function for push delivery)
    supabase.functions
      .invoke('heartbeat-blocklist-notify', {
        body: { userId: user.id, triggerType: 'heartbeat_paused' },
      })
      .catch((err: any) => console.error('Failed to notify inner circle about pause:', err));

    return {
      isEnabled: data.is_enabled,
      quietThresholdDays: data.quiet_threshold_days,
      isPaused: data.is_paused,
      pauseDuration: data.pause_duration,
      pauseStartedAt: data.pause_started_at,
      pauseExpiresAt: data.pause_expires_at,
      lastActiveAt: data.last_active_at,
    };
  },

  /**
   * Resume heartbeat (cancel pause).
   */
  async resumeHeartbeat(): Promise<HeartbeatSettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('heartbeat_settings')
      .update({
        is_paused: false,
        pause_duration: null,
        pause_started_at: null,
        pause_expires_at: null,
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return {
      isEnabled: data.is_enabled,
      quietThresholdDays: data.quiet_threshold_days,
      isPaused: data.is_paused,
      pauseDuration: data.pause_duration,
      pauseStartedAt: data.pause_started_at,
      pauseExpiresAt: data.pause_expires_at,
      lastActiveAt: data.last_active_at,
    };
  },

  /**
   * Fetch inner circle members (accepted + pending invites created by user).
   */
  async fetchInnerCircle(): Promise<InnerCircleMember[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('heartbeat_inner_circle')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'accepted']);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const memberUserIds = data.map((m) => m.circle_member_id);
    const { data: profiles, error: profileError } = await supabase
      .from('grove_profiles')
      .select('*')
      .in('user_id', memberUserIds);

    if (profileError) throw profileError;

    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of profiles || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    return data
      .map((m) => {
        const profile = profileByUserId.get(m.circle_member_id);
        if (!profile) return null;
        return {
          id: m.id,
          userId: m.user_id,
          circleMemberId: m.circle_member_id,
          status: m.status,
          profile,
          invitedAt: m.invited_at,
          acceptedAt: m.accepted_at,
        } as InnerCircleMember;
      })
      .filter((item): item is InnerCircleMember => item !== null);
  },

  /**
   * Invite a friend to the user's inner circle.
   */
  async inviteToInnerCircle(friendUserId: string): Promise<InnerCircleMember> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('heartbeat_inner_circle')
      .insert({
        user_id: user.id,
        circle_member_id: friendUserId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch the member's profile
    const { data: profile, error: profileError } = await supabase
      .from('grove_profiles')
      .select('*')
      .eq('user_id', friendUserId)
      .single();

    if (profileError) throw profileError;

    return {
      id: data.id,
      userId: data.user_id,
      circleMemberId: data.circle_member_id,
      status: data.status,
      profile,
      invitedAt: data.invited_at,
      acceptedAt: data.accepted_at,
    };
  },

  /**
   * Remove a member from the inner circle.
   */
  async removeFromInnerCircle(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('heartbeat_inner_circle')
      .update({ status: 'removed' })
      .eq('id', memberId);

    if (error) throw error;
  },

  /**
   * Fetch incoming inner circle invites (where current user is the circle_member).
   */
  async fetchIncomingInvites(): Promise<InnerCircleMember[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('heartbeat_inner_circle')
      .select('*')
      .eq('circle_member_id', user.id)
      .eq('status', 'pending');

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const inviterUserIds = data.map((m) => m.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('grove_profiles')
      .select('*')
      .in('user_id', inviterUserIds);

    if (profileError) throw profileError;

    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of profiles || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    return data
      .map((m) => {
        const profile = profileByUserId.get(m.user_id);
        if (!profile) return null;
        return {
          id: m.id,
          userId: m.user_id,
          circleMemberId: m.circle_member_id,
          status: m.status,
          profile,
          invitedAt: m.invited_at,
          acceptedAt: m.accepted_at,
        } as InnerCircleMember;
      })
      .filter((item): item is InnerCircleMember => item !== null);
  },

  /**
   * Accept an inner circle invite.
   */
  async acceptInvite(inviteId: string): Promise<void> {
    const { error } = await supabase
      .from('heartbeat_inner_circle')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', inviteId);

    if (error) throw error;
  },

  /**
   * Decline an inner circle invite.
   */
  async declineInvite(inviteId: string): Promise<void> {
    const { error } = await supabase
      .from('heartbeat_inner_circle')
      .update({ status: 'declined' })
      .eq('id', inviteId);

    if (error) throw error;
  },

  /**
   * Fetch heartbeat alerts (notifications about friends going quiet).
   */
  async fetchAlerts(): Promise<HeartbeatAlert[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('heartbeat_notifications')
      .select('*')
      .eq('target_user_id', user.id)
      .order('sent_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    const aboutUserIds = data.map((n) => n.about_user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('grove_profiles')
      .select('*')
      .in('user_id', aboutUserIds);

    if (profileError) throw profileError;

    const profileByUserId = new Map<string, GroveProfile>();
    for (const profile of profiles || []) {
      profileByUserId.set(profile.user_id, profile);
    }

    return data
      .map((n) => {
        const profile = profileByUserId.get(n.about_user_id);
        if (!profile) return null;
        return {
          id: n.id,
          aboutUserId: n.about_user_id,
          aboutProfile: profile,
          triggerType: n.trigger_type,
          notificationText: n.notification_text,
          sentAt: n.sent_at,
          readAt: n.read_at,
        } as HeartbeatAlert;
      })
      .filter((item): item is HeartbeatAlert => item !== null);
  },

  /**
   * Mark a heartbeat alert as read.
   */
  async markAlertRead(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('heartbeat_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) throw error;
  },

  /**
   * Record user activity (called on app foreground to update last_active_at).
   */
  async recordActivity(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('heartbeat_settings')
      .upsert(
        { user_id: user.id, last_active_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
  },

  /**
   * Notify inner circle about a blocklist edit via Edge Function.
   */
  async notifyBlocklistEdit(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase.functions.invoke('heartbeat-blocklist-notify', {
      body: { userId: user.id, triggerType: 'blocklist_edit' },
    });

    if (error) throw error;
  },
};
