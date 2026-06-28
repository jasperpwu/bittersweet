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
import type { FeedItem } from '../../services/grove/GroveFeedService';
import type { RankingItem } from '../../services/grove/GroveRankingService';
import type { ChallengeItem, CreateChallengeInput, ChallengePeriodDetailsResult } from '../../services/grove/GroveChallengeService';
import { computeTotalPeriods } from '../../services/grove/GroveChallengeService';
import type { HeartbeatSettings, InnerCircleMember, HeartbeatAlert } from '../../services/grove/GroveHeartbeatService';
import { WidgetService } from '../../services/WidgetService';

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

  // Phase 3
  rankingsWeek: RankingItem[];
  rankingsMonth: RankingItem[];
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
  claimChallengeReward: (challengeId: string) => Promise<{ claimed: boolean; fruitReward: number }>;

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
  // Phase 3
  rankingsWeek: [],
  rankingsMonth: [],
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
            sharedTagIds: privacy.shared_tag_ids,
            shareNotes: privacy.share_notes,
            showLiveStatus: privacy.show_live_status,
          });
        }
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

      // Sync updated privacy to UserDefaults for native intent REST calls
      WidgetService.syncGrovePrivacy({
        sharedTagIds: privacySettings.shared_tag_ids,
        shareNotes: privacySettings.share_notes,
        showLiveStatus: privacySettings.show_live_status,
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
      set((state: any) => ({
        grove: { ...state.grove, rankingsWeek: weekRankings, rankingsMonth: monthRankings, rankingsLoading: false },
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
    } catch (error: any) {
      console.error('Failed to create challenge:', error);
      throw error;
    }
  },

  acceptChallenge: async (challengeId: string, tagId: string) => {
    try {
      await GroveChallengeService.acceptChallenge(challengeId, tagId);
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

  claimChallengeReward: async (challengeId: string) => {
    // The server's reward_claimed_at column is the idempotency guard: it reports a
    // fresh claim exactly once, so fruits are credited once even across reinstalls.
    const result = await GroveChallengeService.claimChallengeReward(challengeId);

    if (result.claimed && result.fruitReward > 0) {
      get().rewards.earnFruits(result.fruitReward, 'challenge', { challengeId });
    }

    // Refresh so the claimed state (reward_claimed_at) reflects in the UI.
    await get().grove.fetchChallenges();

    return result;
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
