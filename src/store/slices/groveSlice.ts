import {
  GroveService,
  GroveProfile,
  GrovePrivacySettings,
  CreateProfileInput,
  UpdateProfileInput,
  UpdatePrivacyInput,
  GroveFriendService,
  GroveFeedService,
  GroveRankingService,
  GroveChallengeService,
  GroveHeartbeatService,
  GroveModerationService,
  GiftRewardService,
} from '../../services/grove';
import type { BlockedUser, ReportInput } from '../../services/grove/GroveModerationService';
import type { GiftItem, CreateGiftInput } from '../../services/grove/GiftRewardService';
import { giftProductId } from '../../config/giftRewards';
import type { FriendItem, FriendRequest } from '../../services/grove/GroveFriendService';
import type { FeedItem } from '../../services/grove/GroveFeedService';
import type { RankingItem } from '../../services/grove/GroveRankingService';
import type { ChallengeItem, CreateChallengeInput, ChallengePeriodDetailsResult } from '../../services/grove/GroveChallengeService';
import { computeTotalPeriods } from '../../services/grove/GroveChallengeService';
import { computeChallengeReward } from '../../utils/challengeReward';
import type { HeartbeatSettings, InnerCircleMember, HeartbeatAlert } from '../../services/grove/GroveHeartbeatService';
import { WidgetService } from '../../services/WidgetService';
import { AnalyticsTracker } from '../../services/analytics';

export interface PendingInvite {
  code: string;
  profile: GroveProfile;
  status: 'available' | 'already_friends';
}

export interface GroveSlice {
  // Phase 1
  profile: GroveProfile | null;
  privacySettings: GrovePrivacySettings | null;
  isActive: boolean;
  isLoading: boolean;
  // True once fetchProfile has completed at least once, so the UI can tell
  // "no profile yet, still loading" apart from "confirmed no profile". Gating
  // the setup CTA on this prevents it flashing after sign-in (which resets
  // profile to null) before the cloud fetch resolves.
  profileLoaded: boolean;
  error: string | null;

  // Phase 2
  friends: FriendItem[];
  friendsLoading: boolean;
  feed: FeedItem[];
  feedLoading: boolean;
  lastGroveVisit: string | null;
  incomingRequests: FriendRequest[];
  pendingRequestCount: number;
  inviteLink: string | null;
  pendingInvite: PendingInvite | null;

  // Friend feed
  friendFeed: FeedItem[];
  friendFeedLoading: boolean;

  // Moderation (App Store Guideline 1.2). `blockedUserIds` mirrors what RLS
  // already enforces server-side — it exists so cached feeds and the rankings
  // RPC (SECURITY DEFINER, so RLS does not apply to it) can be filtered
  // without waiting for a refetch.
  blockedUserIds: string[];
  blockedUsers: BlockedUser[];
  blockedLoading: boolean;

  // Phase 3
  rankingsWeek: RankingItem[];
  rankingsMonth: RankingItem[];
  rankingsLoading: boolean;
  rankingsPeriod: 'week' | 'month';
  challenges: ChallengeItem[];
  challengesLoading: boolean;
  pendingChallengeCount: number;

  // Gift rewards (cross-user, server-authoritative — see GiftRewardService)
  gifts: GiftItem[];
  giftsLoading: boolean;

  // Phase 1 actions
  fetchProfile: () => Promise<void>;
  createProfile: (input: CreateProfileInput, privacy: UpdatePrivacyInput) => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  updatePrivacySettings: (input: UpdatePrivacyInput) => Promise<void>;
  uploadAvatar: (imageUri: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  toggleGroveActive: (active: boolean) => Promise<void>;
  clearGroveError: () => void;
  clearGroveCache: () => void;
  resetGrove: () => void;

  // Phase 2 actions
  fetchFriends: () => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  rejectFriendRequest: (friendshipId: string) => Promise<void>;
  sendFriendRequest: (addresseeId: string) => Promise<void>;
  fetchFriendRequests: () => Promise<void>;
  fetchFeed: () => Promise<void>;
  addReaction: (sessionId: string) => Promise<void>;
  removeReaction: (sessionId: string) => Promise<void>;
  updateLastGroveVisit: () => void;
  generateInviteLink: () => Promise<string>;
  resolveInviteCode: (code: string) => Promise<{ status: string; friend: GroveProfile }>;
  lookupInviteCode: (code: string) => Promise<void>;
  clearPendingInvite: () => void;
  acceptPendingInvite: () => Promise<void>;

  // Friend feed actions
  fetchFriendFeed: (friendUserId: string) => Promise<void>;

  // Moderation
  fetchBlockedUserIds: () => Promise<void>;
  fetchBlockedUsers: () => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  reportUser: (input: ReportInput) => Promise<void>;

  // Phase 3 actions
  fetchRankings: () => Promise<void>;
  setRankingsPeriod: (period: 'week' | 'month') => void;
  fetchChallenges: () => Promise<void>;
  createChallenge: (input: CreateChallengeInput) => Promise<void>;
  acceptChallenge: (challengeId: string, tagId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  updateMyHitsLocally: (challenge: ChallengeItem) => Promise<{ myHits: number; totalPeriods: number }>;
  recomputeChallengeHitsForTag: (
    tagId: string | undefined
  ) => Promise<{ challenge: ChallengeItem; myHits: number; totalPeriods: number }[]>;
  fetchChallengePeriodDetails: (challengeId: string) => Promise<ChallengePeriodDetailsResult>;
  deleteChallenge: (challengeId: string) => Promise<void>;
  dismissChallenge: (challengeId: string) => Promise<void>;
  claimChallengeReward: (challengeId: string) => Promise<{ claimed: boolean; fruitReward: number }>;

  // Gift reward actions
  fetchGifts: () => Promise<void>;
  createGift: (input: CreateGiftInput) => Promise<void>;
  cancelGift: (giftId: string) => Promise<void>;
  purchaseGift: (giftId: string) => Promise<void>;
  setGiftPhoto: (giftId: string, imageUri: string) => Promise<void>;

  // Phase 4 — Heartbeat / Inner Circle
  heartbeatSettings: HeartbeatSettings | null;
  heartbeatLoading: boolean;
  innerCircle: InnerCircleMember[];
  innerCircleLoading: boolean;
  incomingCircleInvites: InnerCircleMember[];
  heartbeatAlerts: HeartbeatAlert[];
  pendingCircleInviteCount: number;
  // ISO timestamp of when the user last opened the notifications screen. Drives
  // the unread badge on the Grove tab's notification bell.
  notificationsLastSeenAt: string | null;

  // Phase 4 actions
  fetchHeartbeatSettings: () => Promise<void>;
  updateHeartbeatSettings: (updates: { isEnabled?: boolean; quietThresholdDays?: 3 | 5 | 7 | 14 }, options?: { notifyInnerCircle?: boolean }) => Promise<void>;
  pauseHeartbeat: (duration: '1_week' | '2_weeks' | '1_month') => Promise<void>;
  resumeHeartbeat: () => Promise<void>;
  fetchInnerCircle: () => Promise<void>;
  inviteToInnerCircle: (friendUserId: string) => Promise<void>;
  removeFromInnerCircle: (memberId: string) => Promise<void>;
  fetchIncomingCircleInvites: () => Promise<void>;
  acceptCircleInvite: (inviteId: string) => Promise<void>;
  declineCircleInvite: (inviteId: string) => Promise<void>;
  fetchHeartbeatAlerts: () => Promise<void>;
  markHeartbeatAlertRead: (alertId: string) => Promise<void>;
  recordHeartbeatActivity: () => Promise<void>;
  notifyBlocklistEdit: (
    triggerType?: 'blocklist_edit' | 'blocklist_cleared'
  ) => Promise<void>;
  markNotificationsSeen: () => void;

  // Focusing status
  setFocusing: (isFocusing: boolean) => void;
}

const initialState = {
  // Phase 1
  profile: null,
  privacySettings: null,
  isActive: false,
  isLoading: false,
  profileLoaded: false,
  error: null,
  // Phase 2
  friends: [],
  friendsLoading: false,
  feed: [],
  feedLoading: false,
  lastGroveVisit: null,
  incomingRequests: [],
  pendingRequestCount: 0,
  inviteLink: null,
  pendingInvite: null,
  // Friend feed
  friendFeed: [],
  friendFeedLoading: false,
  // Moderation
  blockedUserIds: [] as string[],
  blockedUsers: [] as BlockedUser[],
  blockedLoading: false,
  // Phase 3
  rankingsWeek: [],
  rankingsMonth: [],
  rankingsLoading: false,
  rankingsPeriod: 'week' as const,
  challenges: [],
  challengesLoading: false,
  pendingChallengeCount: 0,
  // Gift rewards
  gifts: [] as GiftItem[],
  giftsLoading: false,
  // Phase 4
  heartbeatSettings: null,
  heartbeatLoading: false,
  innerCircle: [],
  innerCircleLoading: false,
  incomingCircleInvites: [],
  heartbeatAlerts: [],
  pendingCircleInviteCount: 0,
  notificationsLastSeenAt: null,
};

export const createGroveSlice = (set: any, get: any): GroveSlice => ({
  ...initialState,

  // ========== Phase 1 Actions ==========

  fetchProfile: async () => {
    try {
      const profile = await GroveService.fetchProfile();
      if (profile) {
        const privacy = await GroveService.fetchPrivacySettings();
        set((state: any) => {
          // Last-write-wins on the notifications read cursor: keep whichever is
          // newer between the local value and the cloud value. On reinstall the
          // local value is null, so the cloud value is adopted (fixes the stale
          // red-dot); if the user marked notifications seen offline more recently,
          // the local value is kept and pushed up on the next markNotificationsSeen.
          const localSeen = state.grove.notificationsLastSeenAt;
          const cloudSeen = profile.notifications_last_seen_at;
          const notificationsLastSeenAt =
            !localSeen || (cloudSeen && new Date(cloudSeen).getTime() > new Date(localSeen).getTime())
              ? cloudSeen ?? localSeen
              : localSeen;
          return {
            grove: {
              ...state.grove,
              profile,
              privacySettings: privacy,
              isActive: profile.is_active,
              notificationsLastSeenAt,
              profileLoaded: true,
            },
          };
        });

        // Sync privacy settings to UserDefaults for native intent REST calls
        if (privacy) {
          WidgetService.syncGrovePrivacy({
            showLiveStatus: privacy.show_live_status,
          });
        }

        // Analytics: same gap as preferences — createProfile/updatePrivacySettings
        // only fire when the user CHANGES something, so an existing Grove user who
        // never edits their profile would never get these cohort properties. Stamp
        // them from the authoritative fetched profile on every load.
        AnalyticsTracker.setPersonProperties(
          {
            profile_type: (profile as any).profile_type,
            live_status_enabled: privacy?.show_live_status ?? false,
          },
          { has_grove_profile: true }
        );
      } else {
        set((state: any) => ({
          grove: {
            ...state.grove,
            profile: null,
            privacySettings: null,
            isActive: false,
            profileLoaded: true,
          },
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch grove profile:', error);
      // Mark loaded even on failure so the setup CTA isn't suppressed forever
      // for a genuine no-profile user when the network request errors out.
      set((state: any) => ({
        grove: { ...state.grove, profileLoaded: true },
      }));
    }
  },

  createProfile: async (input: CreateProfileInput, privacy: UpdatePrivacyInput) => {
    set((state: any) => ({
      grove: { ...state.grove, isLoading: true, error: null },
    }));

    try {
      const profile = await GroveService.createProfile(input);
      const privacySettings = await GroveService.createPrivacySettings(privacy);

      set((state: any) => ({
        grove: {
          ...state.grove,
          profile,
          privacySettings,
          isActive: true,
          isLoading: false,
          profileLoaded: true,
        },
      }));

      // Analytics: social onboarding completed. profile_type / live_status_enabled
      // are person properties (not event props) so "how many users are public" is a
      // one-click breakdown rather than a count of historical events.
      AnalyticsTracker.track(
        'grove_setup_completed',
        { profile_type: (profile as any)?.profile_type },
        {
          set: {
            profile_type: (profile as any)?.profile_type,
            live_status_enabled: (privacySettings as any)?.show_live_status ?? false,
          },
          setOnce: { has_grove_profile: true },
        }
      );
    } catch (error: any) {
      const message =
        error.message === 'HANDLE_TAKEN'
          ? 'This handle is no longer available. Please choose another.'
          : error.message || 'Failed to create profile';

      set((state: any) => ({
        grove: { ...state.grove, isLoading: false, error: message },
      }));
      throw error;
    }
  },

  updateProfile: async (input: UpdateProfileInput) => {
    set((state: any) => ({
      grove: { ...state.grove, isLoading: true, error: null },
    }));

    try {
      const profile = await GroveService.updateProfile(input);
      set((state: any) => ({
        grove: {
          ...state.grove,
          profile,
          isActive: profile.is_active,
          isLoading: false,
        },
      }));

      // Analytics: public↔private is switched here after setup, so re-stamp the
      // cohort property (createProfile only captures the initial choice).
      if ((profile as any)?.profile_type) {
        AnalyticsTracker.setPersonProperties({ profile_type: (profile as any).profile_type });
      }
    } catch (error: any) {
      const message =
        error.message === 'HANDLE_TAKEN'
          ? 'This handle is no longer available. Please choose another.'
          : error.message || 'Failed to update profile';

      set((state: any) => ({
        grove: { ...state.grove, isLoading: false, error: message },
      }));
      throw error;
    }
  },

  updatePrivacySettings: async (input: UpdatePrivacyInput) => {
    set((state: any) => ({
      grove: { ...state.grove, isLoading: true, error: null },
    }));

    try {
      const privacySettings = await GroveService.updatePrivacySettings(input);
      set((state: any) => ({
        grove: { ...state.grove, privacySettings, isLoading: false },
      }));

      // Sync updated privacy to UserDefaults for native intent REST calls
      WidgetService.syncGrovePrivacy({
        showLiveStatus: privacySettings.show_live_status,
      });

      // Analytics: keep the live-status cohort current when it's toggled after setup.
      AnalyticsTracker.setPersonProperties({
        live_status_enabled: privacySettings.show_live_status ?? false,
      });
    } catch (error: any) {
      set((state: any) => ({
        grove: {
          ...state.grove,
          isLoading: false,
          error: error.message || 'Failed to update privacy settings',
        },
      }));
      throw error;
    }
  },

  uploadAvatar: async (imageUri: string) => {
    set((state: any) => ({
      grove: { ...state.grove, isLoading: true, error: null },
    }));

    try {
      const avatarUrl = await GroveService.uploadAvatar(imageUri);
      set((state: any) => ({
        grove: {
          ...state.grove,
          profile: state.grove.profile
            ? { ...state.grove.profile, avatar_url: avatarUrl }
            : null,
          isLoading: false,
        },
      }));
    } catch (error: any) {
      set((state: any) => ({
        grove: {
          ...state.grove,
          isLoading: false,
          error: error.message || 'Failed to upload avatar',
        },
      }));
      throw error;
    }
  },

  removeAvatar: async () => {
    set((state: any) => ({
      grove: { ...state.grove, isLoading: true, error: null },
    }));

    try {
      await GroveService.removeAvatar();
      set((state: any) => ({
        grove: {
          ...state.grove,
          profile: state.grove.profile
            ? { ...state.grove.profile, avatar_url: null }
            : null,
          isLoading: false,
        },
      }));
    } catch (error: any) {
      set((state: any) => ({
        grove: {
          ...state.grove,
          isLoading: false,
          error: error.message || 'Failed to remove avatar',
        },
      }));
      throw error;
    }
  },

  toggleGroveActive: async (active: boolean) => {
    set((state: any) => ({
      grove: { ...state.grove, isLoading: true, error: null },
    }));

    try {
      const profile = await GroveService.updateProfile({ is_active: active });
      set((state: any) => ({
        grove: {
          ...state.grove,
          profile,
          isActive: active,
          isLoading: false,
        },
      }));
    } catch (error: any) {
      set((state: any) => ({
        grove: {
          ...state.grove,
          isLoading: false,
          error: error.message || 'Failed to update profile status',
        },
      }));
      throw error;
    }
  },

  clearGroveError: () => {
    set((state: any) => ({
      grove: { ...state.grove, error: null },
    }));
  },

  clearGroveCache: () => {
    set((state: any) => ({
      grove: {
        ...state.grove,
        friends: [],
        feed: [],
        rankingsWeek: [],
        rankingsMonth: [],
      },
    }));
  },

  resetGrove: () => {
    set((state: any) => ({
      grove: { ...state.grove, ...initialState },
    }));
  },

  // ========== Phase 2 Actions ==========

  fetchFriends: async () => {
    set((state: any) => ({
      grove: { ...state.grove, friendsLoading: true },
    }));

    try {
      const friends = await GroveFriendService.fetchFriends();
      set((state: any) => ({
        grove: { ...state.grove, friends, friendsLoading: false },
      }));

      // Analytics: friend_added only fires for the side that ACCEPTS, so the
      // initiator gains a friend without ever updating their own friend_count —
      // leaving roughly half of all friendships invisible to the social cohort.
      // Re-stamping from the authoritative fetched list fixes both sides, and also
      // catches removals (which have no event at all).
      AnalyticsTracker.setPersonProperties(
        { friend_count: friends.length },
        friends.length > 0 ? { has_friends: true } : undefined
      );
    } catch (error: any) {
      console.error('Failed to fetch friends:', error);
      set((state: any) => ({
        grove: { ...state.grove, friendsLoading: false },
      }));
    }
  },

  removeFriend: async (friendshipId: string) => {
    try {
      await GroveFriendService.removeFriend(friendshipId);
      set((state: any) => ({
        grove: {
          ...state.grove,
          friends: state.grove.friends.filter(
            (f: FriendItem) => f.friendshipId !== friendshipId
          ),
        },
      }));
    } catch (error: any) {
      console.error('Failed to remove friend:', error);
      throw error;
    }
  },

  fetchFriendRequests: async () => {
    try {
      const requests = await GroveFriendService.fetchFriendRequests();
      const incoming = requests.filter((r) => r.direction === 'incoming');
      set((state: any) => ({
        grove: {
          ...state.grove,
          incomingRequests: incoming,
          pendingRequestCount: incoming.length,
        },
      }));
    } catch (error: any) {
      console.error('Failed to fetch friend requests:', error);
    }
  },

  acceptFriendRequest: async (friendshipId: string) => {
    try {
      await GroveFriendService.acceptFriendRequest(friendshipId);
      // Remove from incoming requests and refresh friends
      set((state: any) => {
        const updatedRequests = state.grove.incomingRequests.filter(
          (r: FriendRequest) => r.friendshipId !== friendshipId
        );
        return {
          grove: {
            ...state.grove,
            incomingRequests: updatedRequests,
            pendingRequestCount: updatedRequests.length,
          },
        };
      });
      // Refresh friends list to include the newly accepted friend
      await get().grove.fetchFriends();

      // Analytics: a friendship only becomes real on accept, so this (and the
      // invite-link path below) are the two places the graph actually grows.
      // friend_count is a person property — it drives the social-vs-solo cohort.
      AnalyticsTracker.track(
        'friend_added',
        { source: 'request' },
        {
          set: { friend_count: get().grove.friends?.length ?? 0 },
          setOnce: { has_friends: true },
        }
      );
    } catch (error: any) {
      console.error('Failed to accept friend request:', error);
      throw error;
    }
  },

  rejectFriendRequest: async (friendshipId: string) => {
    try {
      await GroveFriendService.rejectFriendRequest(friendshipId);
      set((state: any) => {
        const updatedRequests = state.grove.incomingRequests.filter(
          (r: FriendRequest) => r.friendshipId !== friendshipId
        );
        return {
          grove: {
            ...state.grove,
            incomingRequests: updatedRequests,
            pendingRequestCount: updatedRequests.length,
          },
        };
      });
    } catch (error: any) {
      console.error('Failed to reject friend request:', error);
      throw error;
    }
  },

  sendFriendRequest: async (addresseeId: string) => {
    try {
      await GroveFriendService.sendFriendRequest(addresseeId);
    } catch (error: any) {
      console.error('Failed to send friend request:', error);
      throw error;
    }
  },

  fetchFeed: async () => {
    set((state: any) => ({
      grove: { ...state.grove, feedLoading: true },
    }));

    try {
      const feed = await GroveFeedService.fetchFeed();
      set((state: any) => ({
        grove: { ...state.grove, feed, feedLoading: false },
      }));
    } catch (error: any) {
      console.error('Failed to fetch feed:', error);
      set((state: any) => ({
        grove: { ...state.grove, feedLoading: false },
      }));
    }
  },

  addReaction: async (sessionId: string) => {
    const applyReaction = (items: FeedItem[]) =>
      items.map((item: FeedItem) =>
        item.session.id === sessionId
          ? { ...item, hasReacted: true, reactionCount: item.reactionCount + 1 }
          : item
      );
    const revertReaction = (items: FeedItem[]) =>
      items.map((item: FeedItem) =>
        item.session.id === sessionId
          ? { ...item, hasReacted: false, reactionCount: Math.max(0, item.reactionCount - 1) }
          : item
      );

    // Optimistic update
    set((state: any) => ({
      grove: {
        ...state.grove,
        feed: applyReaction(state.grove.feed),
        friendFeed: applyReaction(state.grove.friendFeed),
      },
    }));

    try {
      await GroveFeedService.addReaction(sessionId);
    } catch (error: any) {
      // Revert optimistic update
      set((state: any) => ({
        grove: {
          ...state.grove,
          feed: revertReaction(state.grove.feed),
          friendFeed: revertReaction(state.grove.friendFeed),
        },
      }));
      console.error('Failed to add reaction:', error);
    }
  },

  removeReaction: async (sessionId: string) => {
    const applyRemove = (items: FeedItem[]) =>
      items.map((item: FeedItem) =>
        item.session.id === sessionId
          ? { ...item, hasReacted: false, reactionCount: Math.max(0, item.reactionCount - 1) }
          : item
      );
    const revertRemove = (items: FeedItem[]) =>
      items.map((item: FeedItem) =>
        item.session.id === sessionId
          ? { ...item, hasReacted: true, reactionCount: item.reactionCount + 1 }
          : item
      );

    // Optimistic update
    set((state: any) => ({
      grove: {
        ...state.grove,
        feed: applyRemove(state.grove.feed),
        friendFeed: applyRemove(state.grove.friendFeed),
      },
    }));

    try {
      await GroveFeedService.removeReaction(sessionId);
    } catch (error: any) {
      // Revert optimistic update
      set((state: any) => ({
        grove: {
          ...state.grove,
          feed: revertRemove(state.grove.feed),
          friendFeed: revertRemove(state.grove.friendFeed),
        },
      }));
      console.error('Failed to remove reaction:', error);
    }
  },

  updateLastGroveVisit: () => {
    set((state: any) => ({
      grove: { ...state.grove, lastGroveVisit: new Date().toISOString() },
    }));
  },

  generateInviteLink: async () => {
    try {
      const invite = await GroveFriendService.generateInviteLink();
      const link = `bittersweet-mobile://invite/${invite.code}`;
      set((state: any) => ({
        grove: { ...state.grove, inviteLink: link },
      }));
      return link;
    } catch (error: any) {
      console.error('Failed to generate invite link:', error);
      throw error;
    }
  },

  resolveInviteCode: async (code: string) => {
    try {
      const result = await GroveFriendService.resolveInviteCode(code);
      // Refresh friends list after accepting invite
      await get().grove.fetchFriends();
      return result;
    } catch (error: any) {
      console.error('Failed to resolve invite code:', error);
      throw error;
    }
  },

  lookupInviteCode: async (code: string) => {
    try {
      const result = await GroveFriendService.lookupInviteCode(code);
      set((state: any) => ({
        grove: {
          ...state.grove,
          pendingInvite: { code, profile: result.profile, status: result.status },
        },
      }));
    } catch (error: any) {
      console.error('Failed to lookup invite code:', error);
      throw error;
    }
  },

  clearPendingInvite: () => {
    set((state: any) => ({
      grove: { ...state.grove, pendingInvite: null },
    }));
  },

  acceptPendingInvite: async () => {
    const pendingInvite = get().grove.pendingInvite;
    if (!pendingInvite) return;

    try {
      await GroveFriendService.resolveInviteCode(pendingInvite.code);
      set((state: any) => ({
        grove: { ...state.grove, pendingInvite: null },
      }));
      await get().grove.fetchFriends();

      AnalyticsTracker.track(
        'friend_added',
        { source: 'invite_link' },
        {
          set: { friend_count: get().grove.friends?.length ?? 0 },
          setOnce: { has_friends: true },
        }
      );
    } catch (error: any) {
      console.error('Failed to accept pending invite:', error);
      throw error;
    }
  },

  // ========== Friend Feed Actions ==========

  fetchFriendFeed: async (friendUserId: string) => {
    set((state: any) => ({
      grove: { ...state.grove, friendFeed: [], friendFeedLoading: true },
    }));

    try {
      const friendFeed = await GroveFeedService.fetchFriendFeed(friendUserId);
      set((state: any) => ({
        grove: { ...state.grove, friendFeed, friendFeedLoading: false },
      }));
    } catch (error: any) {
      console.error('Failed to fetch friend feed:', error);
      set((state: any) => ({
        grove: { ...state.grove, friendFeedLoading: false },
      }));
    }
  },

  // ========== Moderation Actions ==========

  fetchBlockedUserIds: async () => {
    try {
      const blockedUserIds = await GroveModerationService.fetchBlockedUserIds();
      set((state: any) => ({
        grove: { ...state.grove, blockedUserIds },
      }));
    } catch (error: any) {
      console.error('Failed to fetch blocked user IDs:', error);
    }
  },

  fetchBlockedUsers: async () => {
    set((state: any) => ({
      grove: { ...state.grove, blockedLoading: true },
    }));

    try {
      const blockedUsers = await GroveModerationService.fetchBlockedUsers();
      set((state: any) => ({
        grove: {
          ...state.grove,
          blockedUsers,
          blockedUserIds: blockedUsers.map((b: BlockedUser) => b.userId),
          blockedLoading: false,
        },
      }));
    } catch (error: any) {
      console.error('Failed to fetch blocked users:', error);
      set((state: any) => ({
        grove: { ...state.grove, blockedLoading: false },
      }));
    }
  },

  blockUser: async (userId: string) => {
    await GroveModerationService.blockUser(userId);

    // Purge the blocked user from everything already in memory. RLS keeps them
    // out of future fetches, but the current feed/friend list would otherwise
    // keep showing them until the next refresh.
    set((state: any) => ({
      grove: {
        ...state.grove,
        blockedUserIds: state.grove.blockedUserIds.includes(userId)
          ? state.grove.blockedUserIds
          : [...state.grove.blockedUserIds, userId],
        friends: state.grove.friends.filter(
          (f: FriendItem) => f.profile.user_id !== userId
        ),
        incomingRequests: state.grove.incomingRequests.filter(
          (r: FriendRequest) => r.profile.user_id !== userId
        ),
        feed: state.grove.feed.filter((item: FeedItem) => item.session.user_id !== userId),
        friendFeed: state.grove.friendFeed.filter(
          (item: FeedItem) => item.session.user_id !== userId
        ),
        rankingsWeek: state.grove.rankingsWeek.filter((r: RankingItem) => r.userId !== userId),
        rankingsMonth: state.grove.rankingsMonth.filter((r: RankingItem) => r.userId !== userId),
      },
    }));

    AnalyticsTracker.track('grove_user_blocked');
  },

  unblockUser: async (userId: string) => {
    await GroveModerationService.unblockUser(userId);
    set((state: any) => ({
      grove: {
        ...state.grove,
        blockedUserIds: state.grove.blockedUserIds.filter((id: string) => id !== userId),
        blockedUsers: state.grove.blockedUsers.filter((b: BlockedUser) => b.userId !== userId),
      },
    }));
  },

  reportUser: async (input: ReportInput) => {
    await GroveModerationService.reportUser(input);
    AnalyticsTracker.track('grove_content_reported', { reason: input.reason });
  },

  // ========== Phase 3 Actions ==========

  fetchRankings: async () => {
    set((state: any) => ({
      grove: { ...state.grove, rankingsLoading: true },
    }));

    try {
      const [weekRankings, monthRankings] = await Promise.all([
        GroveRankingService.fetchRankings('week'),
        GroveRankingService.fetchRankings('month'),
      ]);
      // get_grove_rankings is SECURITY DEFINER, so the blocked-pair RLS guard
      // does not apply to it — blocked users must be filtered here or they
      // reappear on the leaderboard.
      const blocked: string[] = get().grove.blockedUserIds ?? [];
      // Ranks are assigned by position in the service, so they have to be
      // renumbered after a removal or the board reads 1, 2, 4.
      const withoutBlocked = (rows: RankingItem[]) =>
        blocked.length === 0
          ? rows
          : rows
              .filter((r) => !blocked.includes(r.userId))
              .map((r, i) => ({ ...r, rank: i + 1 }));
      set((state: any) => ({
        grove: {
          ...state.grove,
          rankingsWeek: withoutBlocked(weekRankings),
          rankingsMonth: withoutBlocked(monthRankings),
          rankingsLoading: false,
        },
      }));
    } catch (error: any) {
      console.error('Failed to fetch rankings:', error);
      set((state: any) => ({
        grove: { ...state.grove, rankingsLoading: false },
      }));
    }
  },

  setRankingsPeriod: (period: 'week' | 'month') => {
    set((state: any) => ({
      grove: { ...state.grove, rankingsPeriod: period },
    }));
  },

  fetchChallenges: async () => {
    set((state: any) => ({
      grove: { ...state.grove, challengesLoading: true },
    }));

    try {
      const challenges = await GroveChallengeService.fetchChallenges();
      const pendingChallengeCount = challenges.filter(
        (c: ChallengeItem) => c.status === 'pending' && c.isIncoming
      ).length;
      set((state: any) => ({
        grove: { ...state.grove, challenges, challengesLoading: false, pendingChallengeCount },
      }));

      // Sync active challenges to UserDefaults for native intent REST calls
      const activeChallenges = challenges
        .filter((c: ChallengeItem) => c.status === 'active' && c.hasStarted)
        .map((c: ChallengeItem) => ({ id: c.id, tagId: c.tagId }));
      WidgetService.syncActiveChallenges(activeChallenges);
    } catch (error: any) {
      console.error('Failed to fetch challenges:', error);
      set((state: any) => ({
        grove: { ...state.grove, challengesLoading: false },
      }));
    }
  },

  createChallenge: async (input: CreateChallengeInput) => {
    try {
      await GroveChallengeService.createChallenge(input);
      // Refresh challenges list
      await get().grove.fetchChallenges();

      // Analytics: closes the challenge_create_attempted → _completed funnel. The
      // create flow is a 3-step wizard (friends → tag → config), so the drop-off
      // between the two is the number worth watching.
      AnalyticsTracker.track(
        'challenge_create_completed',
        {
          invitee_count: input.inviteeIds?.length ?? 0,
          period: input.period,
          target_minutes: input.targetMinutes,
        },
        { setOnce: { ever_created_challenge: true } }
      );
    } catch (error: any) {
      console.error('Failed to create challenge:', error);
      throw error;
    }
  },

  acceptChallenge: async (challengeId: string, tagId: string) => {
    try {
      await GroveChallengeService.acceptChallenge(challengeId, tagId);
      await get().grove.fetchChallenges();

      AnalyticsTracker.track('challenge_joined', undefined, {
        setOnce: { ever_joined_challenge: true },
      });
    } catch (error: any) {
      console.error('Failed to accept challenge:', error);
      throw error;
    }
  },

  declineChallenge: async (challengeId: string) => {
    try {
      await GroveChallengeService.declineChallenge(challengeId);
      // Remove from local state immediately
      set((state: any) => {
        const updated = state.grove.challenges.filter((c: ChallengeItem) => c.id !== challengeId);
        return {
          grove: {
            ...state.grove,
            challenges: updated,
            pendingChallengeCount: updated.filter(
              (c: ChallengeItem) => c.status === 'pending' && c.isIncoming
            ).length,
          },
        };
      });

      // Re-sync active challenges to UserDefaults
      const activeChallenges = get().grove.challenges
        .filter((c: ChallengeItem) => c.status === 'active' && c.hasStarted)
        .map((c: ChallengeItem) => ({ id: c.id, tagId: c.tagId }));
      WidgetService.syncActiveChallenges(activeChallenges);
    } catch (error: any) {
      console.error('Failed to decline challenge:', error);
      throw error;
    }
  },

  updateMyHitsLocally: async (challenge: ChallengeItem) => {
    try {
      if (!challenge.startDate || !challenge.endDate) {
        throw new Error('Challenge missing start/end date');
      }

      const currentUserId = get().auth.user?.id;
      if (!currentUserId) throw new Error('Not authenticated');

      // Get local sessions in the challenge date range
      const startDate = new Date(challenge.startDate + 'T00:00:00');
      const endDate = new Date(challenge.endDate + 'T23:59:59.999');
      const allSessions = get().focus.sessions;
      const sessions = allSessions.allIds
        .map(id => allSessions.byId[id])
        .filter(Boolean)
        .filter(s => {
          const t = new Date(s.startTime).getTime();
          return t >= startDate.getTime()
            && t <= endDate.getTime()
            && (s.tagId === challenge.tagId || s.secondaryTagId === challenge.tagId);
        });

      // Group by period bucket and count hits
      let myHits = 0;
      if (challenge.period === 'daily') {
        const buckets = new Map<string, number>();
        for (const s of sessions) {
          const dateKey = new Date(s.startTime).toLocaleDateString('en-CA'); // YYYY-MM-DD
          buckets.set(dateKey, (buckets.get(dateKey) || 0) + s.duration);
        }
        for (const total of buckets.values()) {
          if (total >= challenge.targetMinutes) myHits++;
        }
      } else {
        const challengeStart = new Date(challenge.startDate + 'T00:00:00').getTime();
        const buckets = new Map<number, number>();
        for (const s of sessions) {
          const sessionTime = new Date(s.startTime).getTime();
          const dayOffset = Math.floor((sessionTime - challengeStart) / (1000 * 60 * 60 * 24));
          const weekIndex = Math.floor(dayOffset / 7);
          buckets.set(weekIndex, (buckets.get(weekIndex) || 0) + s.duration);
        }
        for (const total of buckets.values()) {
          if (total >= challenge.targetMinutes) myHits++;
        }
      }

      const totalPeriods = computeTotalPeriods(challenge.startDate, challenge.endDate, challenge.period);

      // Write the locally-computed result into local state immediately, so the
      // UI/toast reflects fresh hits even offline. The cloud write + re-pull
      // below are reconciliation; if they fail (e.g. offline) this still stands.
      set((state: any) => ({
        grove: {
          ...state.grove,
          challenges: state.grove.challenges.map((c: ChallengeItem) =>
            c.id === challenge.id
              ? {
                  ...c,
                  myParticipant: c.myParticipant
                    ? { ...c.myParticipant, hits: myHits }
                    : c.myParticipant,
                  participants: c.participants.map((p) =>
                    p.userId === currentUserId ? { ...p, hits: myHits } : p
                  ),
                }
              : c
          ),
        },
      }));

      // Write to participant row directly (no isChallenger needed)
      await GroveChallengeService.updateMyHits(challenge.id, myHits);

      // Refresh challenges list
      await get().grove.fetchChallenges();

      return { myHits, totalPeriods };
    } catch (error: any) {
      console.error('Failed to update challenge hits locally:', error);
      throw error;
    }
  },

  // Recompute hits for every active challenge tracked by the given tag. Called
  // whenever the underlying local sessions for that tag change — on finishing,
  // adjusting, or deleting a focus session — so challenge progress stays in sync.
  recomputeChallengeHitsForTag: async (tagId: string | undefined) => {
    const grove = get().grove;
    if (!grove.profile || !grove.isActive || !tagId) return [];

    const activeChallenges = grove.challenges.filter(
      (c: ChallengeItem) => c.status === 'active' && c.tagId === tagId
    );

    const results: { challenge: ChallengeItem; myHits: number; totalPeriods: number }[] = [];
    for (const challenge of activeChallenges) {
      try {
        const { myHits, totalPeriods } = await get().grove.updateMyHitsLocally(challenge);
        results.push({ challenge, myHits, totalPeriods });
      } catch (error) {
        console.error('Failed to recompute challenge hits:', error);
      }
    }
    return results;
  },

  fetchChallengePeriodDetails: async (challengeId: string) => {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return await GroveChallengeService.fetchPeriodDetails(challengeId, userTz);
  },

  deleteChallenge: async (challengeId: string) => {
    try {
      await GroveChallengeService.deleteChallenge(challengeId);
      // Remove from local state
      set((state: any) => {
        const updated = state.grove.challenges.filter((c: ChallengeItem) => c.id !== challengeId);
        return {
          grove: {
            ...state.grove,
            challenges: updated,
          },
        };
      });
    } catch (error: any) {
      console.error('Failed to delete challenge:', error);
      throw error;
    }
  },

  dismissChallenge: async (challengeId: string) => {
    try {
      await GroveChallengeService.dismissChallenge(challengeId);
      // Remove from this user's local list; the shared row stays for others.
      set((state: any) => {
        const updated = state.grove.challenges.filter((c: ChallengeItem) => c.id !== challengeId);
        return {
          grove: {
            ...state.grove,
            challenges: updated,
          },
        };
      });
    } catch (error: any) {
      console.error('Failed to dismiss challenge:', error);
      throw error;
    }
  },

  claimChallengeReward: async (challengeId: string) => {
    // The payout is proportional to the fruits this user earned with the challenge
    // tag during the window, so it has to be totalled here — per-session fruits are
    // local-only and never reach the cloud. The server's reward_claimed_at column is
    // still the idempotency guard: it reports a fresh claim exactly once, so fruits
    // are credited once even across reinstalls.
    const challenge = get().grove.challenges.find((c: ChallengeItem) => c.id === challengeId);
    const currentUserId = get().auth.user?.id ?? '';
    let amount: number | undefined;
    if (challenge) {
      const sessionState = get().focus.sessions;
      const sessions = sessionState.allIds.map((id: string) => sessionState.byId[id]).filter(Boolean);
      amount = computeChallengeReward(challenge, sessions, currentUserId).reward;
    }

    const result = await GroveChallengeService.claimChallengeReward(challengeId, amount);

    if (result.claimed && result.fruitReward > 0) {
      get().rewards.earnFruits(result.fruitReward, 'challenge', { challengeId });
    }

    // Refresh so the claimed state (reward_claimed_at) reflects in the UI.
    await get().grove.fetchChallenges();

    return result;
  },

  // ========== Gift Reward Actions ==========

  fetchGifts: async () => {
    set((state: any) => ({
      grove: { ...state.grove, giftsLoading: true },
    }));

    try {
      const gifts = await GiftRewardService.fetchGifts();
      set((state: any) => ({
        grove: { ...state.grove, gifts, giftsLoading: false },
      }));
    } catch (error: any) {
      console.error('Failed to fetch gifts:', error);
      set((state: any) => ({
        grove: { ...state.grove, giftsLoading: false },
      }));
    }
  },

  createGift: async (input: CreateGiftInput) => {
    const giftId = await GiftRewardService.createGift(input);
    GiftRewardService.notify(giftId, 'created');
    await get().grove.fetchGifts();

    // Analytics: closes the gift_reward_attempted → _completed funnel. This is the
    // *sender* side (a gift offered to a friend); purchaseGift is the receiver
    // redeeming it, tracked separately as reward_purchased-adjacent behaviour.
    AnalyticsTracker.track(
      'gift_reward_completed',
      { cost: input.cost, has_emoji: !!input.emoji },
      { setOnce: { ever_sent_gift: true } }
    );
  },

  cancelGift: async (giftId: string) => {
    await GiftRewardService.cancelGift(giftId);
    set((state: any) => ({
      grove: {
        ...state.grove,
        gifts: state.grove.gifts.filter((g: GiftItem) => g.id !== giftId),
      },
    }));
  },

  purchaseGift: async (giftId: string) => {
    const gift = get().grove.gifts.find((g: GiftItem) => g.id === giftId);
    // Backstop — the store UI only offers gifts it fetched.
    if (!gift) {
      throw new Error(`Gift not found: ${giftId}`);
    }
    const balance = get().rewards.balance;
    if (balance < gift.cost) {
      throw new Error(`Insufficient fruits. Required: ${gift.cost}, Available: ${balance}`);
    }

    // The server's purchased_at column is the exactly-once guard (conditional
    // UPDATE, same trust model as claim_challenge_reward): only the first call
    // reports purchased=true, so fruits are debited exactly once.
    const result = await GiftRewardService.purchaseGift(giftId);
    if (!result.purchased) {
      await get().grove.fetchGifts();
      throw new Error('ALREADY_PURCHASED');
    }

    get().rewards.spendFruits(gift.cost, 'gift_reward', { giftId });
    get().rewards.addPurchase(giftProductId(giftId), gift.cost);

    set((state: any) => ({
      grove: {
        ...state.grove,
        gifts: state.grove.gifts.map((g: GiftItem) =>
          g.id === giftId ? { ...g, purchasedAt: new Date().toISOString() } : g
        ),
      },
    }));

    GiftRewardService.notify(giftId, 'purchased');
  },

  setGiftPhoto: async (giftId: string, imageUri: string) => {
    // First photo wins, guarded twice: the bucket upload is upsert:false (a
    // duplicate-object error means the other party's file already landed) and
    // the RPC only fills photo_url while it is NULL.
    let photoUrl: string;
    try {
      photoUrl = await GiftRewardService.uploadGiftPhoto(imageUri, giftId);
    } catch (error: any) {
      if (GiftRewardService.isDuplicateUploadError(error)) {
        await get().grove.fetchGifts();
        throw new Error('PHOTO_ALREADY_SET');
      }
      throw error;
    }

    const result = await GiftRewardService.setGiftPhotoUrl(giftId, photoUrl);
    const finalUrl = result.set ? photoUrl : result.photo_url;

    set((state: any) => ({
      grove: {
        ...state.grove,
        gifts: state.grove.gifts.map((g: GiftItem) =>
          g.id === giftId ? { ...g, photoUrl: finalUrl } : g
        ),
      },
    }));

    if (!result.set) {
      throw new Error('PHOTO_ALREADY_SET');
    }

    GiftRewardService.notify(giftId, 'photo_set');
  },

  // ========== Phase 4 Actions — Heartbeat / Inner Circle ==========

  fetchHeartbeatSettings: async () => {
    set((state: any) => ({
      grove: { ...state.grove, heartbeatLoading: true },
    }));

    try {
      const settings = await GroveHeartbeatService.fetchSettings();
      set((state: any) => ({
        grove: { ...state.grove, heartbeatSettings: settings, heartbeatLoading: false },
      }));
    } catch (error: any) {
      console.error('Failed to fetch heartbeat settings:', error);
      set((state: any) => ({
        grove: { ...state.grove, heartbeatLoading: false },
      }));
    }
  },

  updateHeartbeatSettings: async (updates: { isEnabled?: boolean; quietThresholdDays?: 3 | 5 | 7 | 14 }, options?: { notifyInnerCircle?: boolean }) => {
    try {
      const settings = await GroveHeartbeatService.updateSettings(updates, options);
      set((state: any) => ({
        grove: { ...state.grove, heartbeatSettings: settings },
      }));
    } catch (error: any) {
      console.error('Failed to update heartbeat settings:', error);
      throw error;
    }
  },

  pauseHeartbeat: async (duration: '1_week' | '2_weeks' | '1_month') => {
    try {
      const settings = await GroveHeartbeatService.pauseHeartbeat(duration);
      set((state: any) => ({
        grove: { ...state.grove, heartbeatSettings: settings },
      }));
    } catch (error: any) {
      console.error('Failed to pause heartbeat:', error);
      throw error;
    }
  },

  resumeHeartbeat: async () => {
    try {
      const settings = await GroveHeartbeatService.resumeHeartbeat();
      set((state: any) => ({
        grove: { ...state.grove, heartbeatSettings: settings },
      }));
    } catch (error: any) {
      console.error('Failed to resume heartbeat:', error);
      throw error;
    }
  },

  fetchInnerCircle: async () => {
    set((state: any) => ({
      grove: { ...state.grove, innerCircleLoading: true },
    }));

    try {
      const innerCircle = await GroveHeartbeatService.fetchInnerCircle();
      set((state: any) => ({
        grove: { ...state.grove, innerCircle, innerCircleLoading: false },
      }));
    } catch (error: any) {
      console.error('Failed to fetch inner circle:', error);
      set((state: any) => ({
        grove: { ...state.grove, innerCircleLoading: false },
      }));
    }
  },

  inviteToInnerCircle: async (friendUserId: string) => {
    try {
      const member = await GroveHeartbeatService.inviteToInnerCircle(friendUserId);
      set((state: any) => ({
        grove: {
          ...state.grove,
          innerCircle: [...state.grove.innerCircle, member],
        },
      }));

      // Analytics: accountability adoption — the inner circle is what makes the
      // heartbeat alerts meaningful, so its size is the cohort that matters.
      AnalyticsTracker.track(
        'grove_inner_circle_added',
        undefined,
        {
          set: { inner_circle_count: get().grove.innerCircle?.length ?? 0 },
          setOnce: { has_inner_circle: true },
        }
      );
    } catch (error: any) {
      console.error('Failed to invite to inner circle:', error);
      throw error;
    }
  },

  removeFromInnerCircle: async (memberId: string) => {
    try {
      await GroveHeartbeatService.removeFromInnerCircle(memberId);
      set((state: any) => ({
        grove: {
          ...state.grove,
          innerCircle: state.grove.innerCircle.filter(
            (m: InnerCircleMember) => m.id !== memberId
          ),
        },
      }));
    } catch (error: any) {
      console.error('Failed to remove from inner circle:', error);
      throw error;
    }
  },

  fetchIncomingCircleInvites: async () => {
    try {
      const invites = await GroveHeartbeatService.fetchIncomingInvites();
      set((state: any) => ({
        grove: {
          ...state.grove,
          incomingCircleInvites: invites,
          pendingCircleInviteCount: invites.length,
        },
      }));
    } catch (error: any) {
      console.error('Failed to fetch incoming circle invites:', error);
    }
  },

  acceptCircleInvite: async (inviteId: string) => {
    try {
      await GroveHeartbeatService.acceptInvite(inviteId);
      set((state: any) => {
        const updated = state.grove.incomingCircleInvites.filter(
          (i: InnerCircleMember) => i.id !== inviteId
        );
        return {
          grove: {
            ...state.grove,
            incomingCircleInvites: updated,
            pendingCircleInviteCount: updated.length,
          },
        };
      });
    } catch (error: any) {
      console.error('Failed to accept circle invite:', error);
      throw error;
    }
  },

  declineCircleInvite: async (inviteId: string) => {
    try {
      await GroveHeartbeatService.declineInvite(inviteId);
      set((state: any) => {
        const updated = state.grove.incomingCircleInvites.filter(
          (i: InnerCircleMember) => i.id !== inviteId
        );
        return {
          grove: {
            ...state.grove,
            incomingCircleInvites: updated,
            pendingCircleInviteCount: updated.length,
          },
        };
      });
    } catch (error: any) {
      console.error('Failed to decline circle invite:', error);
      throw error;
    }
  },

  fetchHeartbeatAlerts: async () => {
    try {
      const alerts = await GroveHeartbeatService.fetchAlerts();
      set((state: any) => ({
        grove: { ...state.grove, heartbeatAlerts: alerts },
      }));
    } catch (error: any) {
      console.error('Failed to fetch heartbeat alerts:', error);
    }
  },

  markHeartbeatAlertRead: async (alertId: string) => {
    // Optimistic update
    set((state: any) => ({
      grove: {
        ...state.grove,
        heartbeatAlerts: state.grove.heartbeatAlerts.map((a: HeartbeatAlert) =>
          a.id === alertId ? { ...a, readAt: new Date().toISOString() } : a
        ),
      },
    }));

    try {
      await GroveHeartbeatService.markAlertRead(alertId);
    } catch (error: any) {
      // Revert optimistic update
      set((state: any) => ({
        grove: {
          ...state.grove,
          heartbeatAlerts: state.grove.heartbeatAlerts.map((a: HeartbeatAlert) =>
            a.id === alertId ? { ...a, readAt: null } : a
          ),
        },
      }));
      console.error('Failed to mark heartbeat alert read:', error);
    }
  },

  recordHeartbeatActivity: async () => {
    // Skip recording activity if heartbeat is paused or not enabled
    const settings = get().grove.heartbeatSettings;
    if (settings?.isPaused || settings?.isEnabled === false) return;

    // Heartbeat is an accountability signal tied to actually blocking apps: it
    // only means something when the user has a blocklist to enforce AND Screen
    // Time authorization to enforce it. Without both there's nothing being
    // blocked, so recording a "still active" heartbeat would be misleading.
    const blocklist = get().blocklist;
    if (!blocklist.currentSelectionId) return; // no blocklist configured
    if (!(await blocklist.checkAuthorizationStatus())) return; // Screen Time not granted

    try {
      await GroveHeartbeatService.recordActivity();
    } catch (error: any) {
      // Fire-and-forget: silent fail
      console.error('Failed to record heartbeat activity:', error);
    }
  },

  notifyBlocklistEdit: async (
    triggerType: 'blocklist_edit' | 'blocklist_cleared' = 'blocklist_edit'
  ) => {
    try {
      await GroveHeartbeatService.notifyBlocklistEdit(triggerType);
    } catch (error: any) {
      // Fire-and-forget: silent fail
      console.error('Failed to notify blocklist edit:', error);
    }
  },

  markNotificationsSeen: () => {
    const seenAt = new Date().toISOString();
    set((state: any) => ({
      grove: { ...state.grove, notificationsLastSeenAt: seenAt },
    }));
    // Persist the read cursor to the cloud so the bell red-dot survives reinstall.
    // Fire-and-forget; only meaningful once a grove profile exists.
    if (get().grove.profile) {
      GroveService.updateProfile({ notifications_last_seen_at: seenAt }).catch((error: any) => {
        console.error('Failed to sync notifications-seen timestamp:', error);
      });
    }
  },

  // ========== Focusing Status ==========

  setFocusing: (isFocusing: boolean) => {
    const { profile, privacySettings } = get().grove;
    if (!profile) {
      console.log('🌳 [setFocusing] skipped — no grove profile');
      return;
    }

    // If setting to true, gate on show_live_status privacy setting
    if (isFocusing && !privacySettings?.show_live_status) {
      console.log('🌳 [setFocusing] skipped — show_live_status is off');
      return;
    }

    // Optimistic local update
    set((state: any) => ({
      grove: {
        ...state.grove,
        profile: state.grove.profile
          ? { ...state.grove.profile, is_focusing: isFocusing }
          : null,
      },
    }));

    // Fire-and-forget Supabase update
    GroveService.setFocusing(isFocusing).catch((error: any) => {
      console.error('Failed to set focusing status:', error);
    });
  },
});
