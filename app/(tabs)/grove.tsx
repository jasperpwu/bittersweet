import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, SafeAreaView, ScrollView, Pressable, useColorScheme, RefreshControl, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { colors } from '../../src/config/theme';
import { ProfileAvatar } from '../../src/components/grove/ProfileAvatar';
import { FriendCarousel } from '../../src/components/grove/FriendCarousel';
import { ChallengeCard } from '../../src/components/grove/ChallengeCard';
import { ChallengeDetailSheet } from '../../src/components/grove/ChallengeDetailSheet';
import { EmptyChallengesState } from '../../src/components/grove/EmptyChallengesState';
import { Leaderboard } from '../../src/components/grove/Leaderboard';
import { EmptyGroveState } from '../../src/components/grove/EmptyGroveState';
import { useAppStore } from '../../src/store';
import { SwipeableTabWrapper } from '../../src/components/ui/SwipeableTabWrapper';
import { buildGroveNotifications, countUnreadGroveNotifications } from '../../src/utils/groveNotifications';
import { showToast } from '../../src/components/ui/Toast';
import { useTranslation } from 'react-i18next';

export default function GroveScreen() {
  const { t } = useTranslation();
  const profile = useAppStore((s) => s.grove.profile);
  const friends = useAppStore((s) => s.grove.friends);
  const feed = useAppStore((s) => s.grove.feed);
  const lastGroveVisit = useAppStore((s) => s.grove.lastGroveVisit);
  const rankingsWeek = useAppStore((s) => s.grove.rankingsWeek);
  const rankingsMonth = useAppStore((s) => s.grove.rankingsMonth);
  const rankingsPeriod = useAppStore((s) => s.grove.rankingsPeriod);
  const challenges = useAppStore((s) => s.grove.challenges);
  const currentUserId = useAppStore((s) => s.auth.user?.id ?? '');
  const fetchFriends = useAppStore((s) => s.grove.fetchFriends);
  const fetchFeed = useAppStore((s) => s.grove.fetchFeed);
  const fetchFriendRequests = useAppStore((s) => s.grove.fetchFriendRequests);
  const fetchRankings = useAppStore((s) => s.grove.fetchRankings);
  const fetchChallenges = useAppStore((s) => s.grove.fetchChallenges);
  const fetchGifts = useAppStore((s) => s.grove.fetchGifts);
  const setRankingsPeriod = useAppStore((s) => s.grove.setRankingsPeriod);
  const updateLastGroveVisit = useAppStore((s) => s.grove.updateLastGroveVisit);
  const addReaction = useAppStore((s) => s.grove.addReaction);
  const removeReaction = useAppStore((s) => s.grove.removeReaction);
  const sendFriendRequest = useAppStore((s) => s.grove.sendFriendRequest);
  const incomingRequests = useAppStore((s) => s.grove.incomingRequests);
  const incomingCircleInvites = useAppStore((s) => s.grove.incomingCircleInvites);
  const heartbeatAlerts = useAppStore((s) => s.grove.heartbeatAlerts);
  const notificationsLastSeenAt = useAppStore((s) => s.grove.notificationsLastSeenAt);
  const fetchHeartbeatSettings = useAppStore((s) => s.grove.fetchHeartbeatSettings);
  const fetchHeartbeatAlerts = useAppStore((s) => s.grove.fetchHeartbeatAlerts);
  const fetchIncomingCircleInvites = useAppStore((s) => s.grove.fetchIncomingCircleInvites);
  const recordHeartbeatActivity = useAppStore((s) => s.grove.recordHeartbeatActivity);

  const deleteChallengeAction = useAppStore((s) => s.grove.deleteChallenge);
  const dismissChallengeAction = useAppStore((s) => s.grove.dismissChallenge);

  const colorScheme = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<string>>(new Set());
  const [selectedChallenge, setSelectedChallenge] = useState<typeof challenges[number] | null>(null);
  const isFirstFocus = useRef(true);

  // Fetch all grove data, optionally showing the refresh spinner
  const fetchAllData = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setRefreshing(true);
    try {
      await Promise.all([
        fetchFriends(),
        fetchFeed(),
        fetchFriendRequests(),
        fetchRankings(),
        fetchChallenges(),
        fetchGifts(),
        fetchHeartbeatSettings(),
        fetchHeartbeatAlerts(),
        fetchIncomingCircleInvites(),
      ]);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [fetchFriends, fetchFeed, fetchFriendRequests, fetchRankings, fetchChallenges, fetchGifts, fetchHeartbeatSettings, fetchHeartbeatAlerts, fetchIncomingCircleInvites]);

  // Fetch data on tab focus
  useFocusEffect(
    useCallback(() => {
      if (profile) {
        const showSpinner = isFirstFocus.current;
        isFirstFocus.current = false;
        fetchAllData(showSpinner);
        recordHeartbeatActivity();
      }

      // Update last visit when leaving the tab
      return () => {
        updateLastGroveVisit();
      };
    }, [profile?.user_id])
  );

  const onRefresh = useCallback(() => fetchAllData(true), [fetchAllData]);

  const handleReactionToggle = useCallback(
    (sessionId: string) => {
      const item = feed.find((f) => f.session.id === sessionId);
      if (item?.hasReacted) {
        removeReaction(sessionId);
      } else {
        addReaction(sessionId);
      }
    },
    [feed, addReaction, removeReaction]
  );

  const handleAddFriend = useCallback(() => {
    router.push('/(modals)/add-friends');
  }, []);

  // Quick invite from a discovery (stranger) card in the feed
  const handleInvite = useCallback(
    async (userId: string) => {
      setInvitedUserIds((prev) => new Set(prev).add(userId));
      try {
        await sendFriendRequest(userId);
        showToast(t('gm.afSentToast'), 'success');
      } catch {
        setInvitedUserIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        showToast(t('gm.errSendRequest'), 'error');
      }
    },
    [sendFriendRequest, t]
  );

  const handleChallenges = useCallback(() => {
    router.push('/(modals)/challenges');
  }, []);

  const handleCreateChallenge = useCallback(() => {
    router.push('/(modals)/create-challenge');
  }, []);

  const handleFriendPress = useCallback((userId: string) => {
    router.push(`/(modals)/friend-feed?userId=${userId}`);
  }, []);

  const handleNotifications = useCallback(() => {
    router.push('/(modals)/grove-notifications');
  }, []);

  const handleDeleteChallenge = useCallback((challengeId: string) => {
    const challenge = challenges.find(c => c.id === challengeId);
    const isCreator = challenge?.creatorId === currentUserId;
    // Finished (completed/failed) challenges are removed per-user via dismiss for
    // anyone; a cancelled one dismisses for the invitee (they can't delete the
    // shared row) while the creator keeps the shared hard-delete. Status is the
    // current user's own outcome.
    const isFinished = challenge?.status === 'completed' || challenge?.status === 'failed';
    const isActive = challenge?.status === 'active';
    const useDismiss = isFinished || (challenge?.status === 'cancelled' && !isCreator);
    const message = useDismiss
      ? t('grove.dismissChallengeConfirm')
      : isActive
        ? t('grove.deleteChallengeActive')
        : t('grove.deleteChallengeConfirm');

    Alert.alert(t('grove.deleteChallengeTitle'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            if (useDismiss) {
              await dismissChallengeAction(challengeId);
            } else {
              await deleteChallengeAction(challengeId);
            }
            setSelectedChallenge(null);
          } catch (e) {
            console.error('Challenge delete/dismiss failed:', { useDismiss, status: challenge?.status, error: e });
            Alert.alert(t('common.error'), t('grove.failedDeleteChallenge'));
          }
        },
      },
    ]);
  }, [deleteChallengeAction, dismissChallengeAction, challenges, currentUserId]);

  const unreadNotificationCount = useMemo(() => {
    const notifications = buildGroveNotifications({
      incomingRequests,
      incomingCircleInvites,
      heartbeatAlerts,
      challenges,
    });
    return countUnreadGroveNotifications(notifications, notificationsLastSeenAt);
  }, [incomingRequests, incomingCircleInvites, heartbeatAlerts, challenges, notificationsLastSeenAt]);

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg items-center justify-center">
        <Typography variant="body-14" color="secondary">
          {t('grove.profileNotFound')}
        </Typography>
      </SafeAreaView>
    );
  }

  const hasFriends = friends.length > 0;
  const hasFeed = feed.length > 0;
  const activeChallenges = challenges.filter((c) => c.status === 'active');
  // Friends and feed are persisted, so if they're empty locally we can
  // show the empty state right away instead of flashing the full view
  // while waiting for the server to confirm.
  const showEmptyState = !hasFriends && !hasFeed;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
    <SwipeableTabWrapper currentTab="grove">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center justify-between">
        <Typography variant="headline-24" color="primary">
          Grove
        </Typography>
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleAddFriend} className="active:opacity-60" hitSlop={8}>
            <Ionicons name="person-add-outline" size={22} color={colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary} />
          </Pressable>
          <Pressable onPress={handleNotifications} className="active:opacity-60" hitSlop={8}>
            <View>
              <Ionicons name="notifications-outline" size={22} color={colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary} />
              {unreadNotificationCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.danger,
                  }}
                />
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary}
          />
        }
      >
        {/* Profile Card */}
        <View className="px-5">
          <Pressable
            onPress={() => router.push(`/(modals)/friend-feed?userId=${currentUserId}`)}
            className="active:opacity-80"
          >
            <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl p-4 mt-1">
              <View className="flex-row items-center">
                <View className="mr-3">
                  <ProfileAvatar
                    avatarUrl={profile.avatar_url}
                    displayName={profile.display_name}
                    avatarColor={profile.avatar_color}
                    size={48}
                  />
                </View>
                <View className="flex-1">
                  <Typography variant="headline-18" color="primary">
                    {profile.display_name}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    @{profile.handle}
                    {hasFriends && ` · ${t('grove.friendCount', { count: friends.length })}`}
                  </Typography>
                </View>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Content */}
        {showEmptyState ? (
          <EmptyGroveState onAddFriend={handleAddFriend} />
        ) : (
          <>
            {/* Recent Activity section */}
            <View className="mt-3">
              <View className="px-5 mb-3">
                <Typography variant="subtitle-16" color="primary">
                  {t('grove.recentActivity')}
                </Typography>
              </View>

              {hasFeed ? (
                <FriendCarousel
                  feed={feed}
                  lastGroveVisit={lastGroveVisit}
                  onReactionToggle={handleReactionToggle}
                  onAddFriend={handleAddFriend}
                  showAddFriend={!hasFriends}
                  onInvite={handleInvite}
                  invitedUserIds={invitedUserIds}
                  onCardPress={handleFriendPress}
                />
              ) : (
                <View className="px-5 py-8 items-center">
                  <Typography variant="body-14" color="secondary" className="text-center">
                    {t('grove.noRecentSessions')}
                  </Typography>
                </View>
              )}
            </View>

            {/* Active Challenges section */}
            <View className="mt-6">
              <View className="px-5 mb-3 flex-row items-center justify-between">
                <Typography variant="subtitle-16" color="primary">
                  {t('grove.challenges')}
                </Typography>
                <Pressable onPress={handleChallenges} className="active:opacity-60" hitSlop={8}>
                  <Typography variant="body-12" style={{ color: '#E9A065' }}>
                    {t('grove.seeAll')}
                  </Typography>
                </Pressable>
              </View>

              {activeChallenges.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                >
                  {activeChallenges.map((challenge) => (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      currentUserId={currentUserId}
                      onPress={() => setSelectedChallenge(challenge)}
                    />
                  ))}
                  {/* Create new challenge button */}
                  <Pressable
                    onPress={handleCreateChallenge}
                    className="w-[260px] bg-light-border/30 dark:bg-dark-card rounded-2xl items-center justify-center"
                  >
                    <View className="w-12 h-12 rounded-full bg-[#E9A065]/10 items-center justify-center mb-2">
                      <Ionicons name="add" size={24} color="#E9A065" />
                    </View>
                    <Typography variant="body-12" color="secondary">
                      {t('grove.newChallenge')}
                    </Typography>
                  </Pressable>
                </ScrollView>
              ) : (
                <EmptyChallengesState onCreateChallenge={handleCreateChallenge} />
              )}
            </View>

            {/* Leaderboard section */}
            <View className="mt-6 mb-8">
              <Leaderboard
                rankings={rankingsPeriod === 'week' ? rankingsWeek : rankingsMonth}
                period={rankingsPeriod}
                onPeriodChange={setRankingsPeriod}
                onFriendPress={handleFriendPress}
              />
            </View>
          </>
        )}
      </ScrollView>

      <ChallengeDetailSheet
        challenge={selectedChallenge}
        isVisible={selectedChallenge !== null}
        onClose={() => setSelectedChallenge(null)}
        onDelete={handleDeleteChallenge}
      />
    </SwipeableTabWrapper>
    </SafeAreaView>
  );
}
