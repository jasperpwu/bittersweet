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
} from '../../services/grove';
import type { FriendItem, FriendRequest } from '../../services/grove/GroveFriendService';
import type { FeedItem, ShareSessionInput } from '../../services/grove/GroveFeedService';
import type { RankingItem } from '../../services/grove/GroveRankingService';
import type { ChallengeItem, CreateChallengeInput, ChallengeProgressResult } from '../../services/grove/GroveChallengeService';
import type { HeartbeatSettings, InnerCircleMember, HeartbeatAlert } from '../../services/grove/GroveHeartbeatService';

export interface GroveSlice {
  // Phase 1
  profile: GroveProfile | null;
  privacySettings: GrovePrivacySettings | null;
  isActive: boolean;
  isLoading: boolean;
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

  // Phase 3
  rankings: RankingItem[];
  rankingsLoading: boolean;
  rankingsPeriod: 'week' | 'month';
  challenges: ChallengeItem[];
  challengesLoading: boolean;
  pendingChallengeCount: number;

  // Phase 1 actions
  fetchProfile: () => Promise<void>;
  createProfile: (input: CreateProfileInput, privacy: UpdatePrivacyInput) => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  updatePrivacySettings: (input: UpdatePrivacyInput) => Promise<void>;
  uploadAvatar: (imageUri: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  toggleGroveActive: (active: boolean) => Promise<void>;
  clearGroveError: () => void;
  resetGrove: () => void;

  // Phase 2 actions
  fetchFriends: () => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  rejectFriendRequest: (friendshipId: string) => Promise<void>;
  fetchFriendRequests: () => Promise<void>;
  fetchFeed: () => Promise<void>;
  shareSession: (input: ShareSessionInput) => Promise<void>;
  addReaction: (sharedSessionId: string) => Promise<void>;
  removeReaction: (sharedSessionId: string) => Promise<void>;
  updateLastGroveVisit: () => void;
  generateInviteLink: () => Promise<string>;
  resolveInviteCode: (code: string) => Promise<{ status: string; friend: GroveProfile }>;

  // Phase 3 actions
  fetchRankings: (period?: 'week' | 'month') => Promise<void>;
  setRankingsPeriod: (period: 'week' | 'month') => void;
  fetchChallenges: () => Promise<void>;
  createChallenge: (input: CreateChallengeInput) => Promise<void>;
  acceptChallenge: (challengeId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  recordChallengeProgress: (challengeId: string) => Promise<ChallengeProgressResult>;

  // Phase 4 — Heartbeat / Inner Circle
  heartbeatSettings: HeartbeatSettings | null;
  heartbeatLoading: boolean;
  innerCircle: InnerCircleMember[];
  innerCircleLoading: boolean;
  incomingCircleInvites: InnerCircleMember[];
  heartbeatAlerts: HeartbeatAlert[];
  pendingCircleInviteCount: number;

  // Phase 4 actions
  fetchHeartbeatSettings: () => Promise<void>;
  updateHeartbeatSettings: (updates: { isEnabled?: boolean; quietThresholdDays?: 3 | 5 | 7 | 14 }) => Promise<void>;
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
  notifyBlocklistEdit: () => Promise<void>;
}

const initialState = {
  // Phase 1
  profile: null,
  privacySettings: null,
  isActive: false,
  isLoading: false,
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
  // Phase 3
  rankings: [],
  rankingsLoading: false,
  rankingsPeriod: 'week' as const,
  challenges: [],
  challengesLoading: false,
  pendingChallengeCount: 0,
  // Phase 4
  heartbeatSettings: null,
  heartbeatLoading: false,
  innerCircle: [],
  innerCircleLoading: false,
  incomingCircleInvites: [],
  heartbeatAlerts: [],
  pendingCircleInviteCount: 0,
};

export const createGroveSlice = (set: any, get: any): GroveSlice => ({
  ...initialState,

  // ========== Phase 1 Actions ==========

  fetchProfile: async () => {
    try {
      const profile = await GroveService.fetchProfile();
      if (profile) {
        const privacy = await GroveService.fetchPrivacySettings();
        set((state: any) => ({
          grove: {
            ...state.grove,
            profile,
            privacySettings: privacy,
            isActive: profile.is_active,
          },
        }));
      } else {
        set((state: any) => ({
          grove: {
            ...state.grove,
            profile: null,
            privacySettings: null,
            isActive: false,
          },
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch grove profile:', error);
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
        },
      }));
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

  shareSession: async (input: ShareSessionInput) => {
    try {
      await GroveFeedService.shareSession(input);
    } catch (error: any) {
      // Fire-and-forget: silent fail
      console.error('Failed to share session:', error);
    }
  },

  addReaction: async (sharedSessionId: string) => {
    // Optimistic update
    set((state: any) => ({
      grove: {
        ...state.grove,
        feed: state.grove.feed.map((item: FeedItem) =>
          item.sharedSession.id === sharedSessionId
            ? { ...item, hasReacted: true, reactionCount: item.reactionCount + 1 }
            : item
        ),
      },
    }));

    try {
      await GroveFeedService.addReaction(sharedSessionId);
    } catch (error: any) {
      // Revert optimistic update
      set((state: any) => ({
        grove: {
          ...state.grove,
          feed: state.grove.feed.map((item: FeedItem) =>
            item.sharedSession.id === sharedSessionId
              ? { ...item, hasReacted: false, reactionCount: Math.max(0, item.reactionCount - 1) }
              : item
          ),
        },
      }));
      console.error('Failed to add reaction:', error);
    }
  },

  removeReaction: async (sharedSessionId: string) => {
    // Optimistic update
    set((state: any) => ({
      grove: {
        ...state.grove,
        feed: state.grove.feed.map((item: FeedItem) =>
          item.sharedSession.id === sharedSessionId
            ? { ...item, hasReacted: false, reactionCount: Math.max(0, item.reactionCount - 1) }
            : item
        ),
      },
    }));

    try {
      await GroveFeedService.removeReaction(sharedSessionId);
    } catch (error: any) {
      // Revert optimistic update
      set((state: any) => ({
        grove: {
          ...state.grove,
          feed: state.grove.feed.map((item: FeedItem) =>
            item.sharedSession.id === sharedSessionId
              ? { ...item, hasReacted: true, reactionCount: item.reactionCount + 1 }
              : item
          ),
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

  // ========== Phase 3 Actions ==========

  fetchRankings: async (period?: 'week' | 'month') => {
    const currentPeriod = period || get().grove.rankingsPeriod;
    set((state: any) => ({
      grove: { ...state.grove, rankingsLoading: true },
    }));

    try {
      const rankings = await GroveRankingService.fetchRankings(currentPeriod);
      set((state: any) => ({
        grove: { ...state.grove, rankings, rankingsLoading: false },
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
    // Fetch rankings for the new period
    get().grove.fetchRankings(period);
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
    } catch (error: any) {
      console.error('Failed to create challenge:', error);
      throw error;
    }
  },

  acceptChallenge: async (challengeId: string) => {
    try {
      await GroveChallengeService.acceptChallenge(challengeId);
      await get().grove.fetchChallenges();
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
    } catch (error: any) {
      console.error('Failed to decline challenge:', error);
      throw error;
    }
  },

  recordChallengeProgress: async (challengeId: string) => {
    try {
      const result = await GroveChallengeService.recordProgress(challengeId);
      // Refresh challenges to get updated streaks
      await get().grove.fetchChallenges();
      return result;
    } catch (error: any) {
      console.error('Failed to record challenge progress:', error);
      throw error;
    }
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

  updateHeartbeatSettings: async (updates: { isEnabled?: boolean; quietThresholdDays?: 3 | 5 | 7 | 14 }) => {
    try {
      const settings = await GroveHeartbeatService.updateSettings(updates);
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

    try {
      await GroveHeartbeatService.recordActivity();
    } catch (error: any) {
      // Fire-and-forget: silent fail
      console.error('Failed to record heartbeat activity:', error);
    }
  },

  notifyBlocklistEdit: async () => {
    try {
      await GroveHeartbeatService.notifyBlocklistEdit();
    } catch (error: any) {
      // Fire-and-forget: silent fail
      console.error('Failed to notify blocklist edit:', error);
    }
  },
});
