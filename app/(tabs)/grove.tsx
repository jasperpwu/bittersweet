import React, { useCallback, useRef, useState } from 'react';
import { View, SafeAreaView, Image, ScrollView, Pressable, useColorScheme, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { FriendCarousel } from '../../src/components/grove/FriendCarousel';
import { ChallengeBanner } from '../../src/components/grove/ChallengeBanner';
import { ChallengeCard } from '../../src/components/grove/ChallengeCard';
import { EmptyChallengesState } from '../../src/components/grove/EmptyChallengesState';
import { Leaderboard } from '../../src/components/grove/Leaderboard';
import { EmptyGroveState } from '../../src/components/grove/EmptyGroveState';
import { HeartbeatIndicator } from '../../src/components/grove/HeartbeatIndicator';
import { HeartbeatAlertCard } from '../../src/components/grove/HeartbeatAlertCard';
import { InnerCircleInviteBanner } from '../../src/components/grove/InnerCircleInviteBanner';
import { HeartbeatPauseSheet } from '../../src/components/grove/HeartbeatPauseSheet';
import { useAppStore } from '../../src/store';

export default function GroveScreen() {
  const profile = useAppStore((s) => s.grove.profile);
  const friends = useAppStore((s) => s.grove.friends);
  const feed = useAppStore((s) => s.grove.feed);
  const feedLoading = useAppStore((s) => s.grove.feedLoading);
  const friendsLoading = useAppStore((s) => s.grove.friendsLoading);
  const pendingRequestCount = useAppStore((s) => s.grove.pendingRequestCount);
  const pendingChallengeCount = useAppStore((s) => s.grove.pendingChallengeCount);
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
  const setRankingsPeriod = useAppStore((s) => s.grove.setRankingsPeriod);
  const updateLastGroveVisit = useAppStore((s) => s.grove.updateLastGroveVisit);
  const addReaction = useAppStore((s) => s.grove.addReaction);
  const removeReaction = useAppStore((s) => s.grove.removeReaction);
  const heartbeatSettings = useAppStore((s) => s.grove.heartbeatSettings);
  const heartbeatAlerts = useAppStore((s) => s.grove.heartbeatAlerts);
  const pendingCircleInviteCount = useAppStore((s) => s.grove.pendingCircleInviteCount);
  const fetchHeartbeatSettings = useAppStore((s) => s.grove.fetchHeartbeatSettings);
  const fetchHeartbeatAlerts = useAppStore((s) => s.grove.fetchHeartbeatAlerts);
  const fetchIncomingCircleInvites = useAppStore((s) => s.grove.fetchIncomingCircleInvites);
  const markHeartbeatAlertRead = useAppStore((s) => s.grove.markHeartbeatAlertRead);
  const recordHeartbeatActivity = useAppStore((s) => s.grove.recordHeartbeatActivity);
  const pauseHeartbeat = useAppStore((s) => s.grove.pauseHeartbeat);
  const resumeHeartbeat = useAppStore((s) => s.grove.resumeHeartbeat);

  const colorScheme = useColorScheme();
  const [showPauseSheet, setShowPauseSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
        fetchHeartbeatSettings(),
        fetchHeartbeatAlerts(),
        fetchIncomingCircleInvites(),
      ]);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [fetchFriends, fetchFeed, fetchFriendRequests, fetchRankings, fetchChallenges, fetchHeartbeatSettings, fetchHeartbeatAlerts, fetchIncomingCircleInvites]);

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

  const handleChallenges = useCallback(() => {
    router.push('/(modals)/challenges');
  }, []);

  const handleCreateChallenge = useCallback(() => {
    router.push('/(modals)/create-challenge');
  }, []);

  const handleFriendPress = useCallback((userId: string) => {
    router.push(`/(modals)/friend-feed?userId=${userId}`);
  }, []);

  const handleInnerCircle = useCallback(() => {
    router.push('/(modals)/inner-circle');
  }, []);

  const handleHeartbeatPress = useCallback(() => {
    setShowPauseSheet(true);
  }, []);

  const handleCheckIn = useCallback(
    (alert: { id: string }) => {
      markHeartbeatAlertRead(alert.id);
    },
    [markHeartbeatAlertRead]
  );

  const unreadAlerts = heartbeatAlerts.filter((a) => !a.readAt);
  const hasHeartbeat = heartbeatSettings?.isEnabled ?? false;

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg items-center justify-center">
        <Typography variant="body-14" color="secondary">
          Profile not found
        </Typography>
      </SafeAreaView>
    );
  }

  const hasFriends = friends.length > 0;
  const hasFeed = feed.length > 0;
  const activeChallenges = challenges.filter((c) => c.status === 'active');
  // Show empty onboarding state only when we've confirmed from the server
  // that there are truly no friends (not during initial load)
  const showEmptyState = !hasFriends && !hasFeed && !friendsLoading && !feedLoading;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center justify-between">
        <Typography variant="headline-24" color="primary">
          Grove
        </Typography>
        <View className="flex-row items-center gap-3">
          {hasFriends && (
            <Pressable onPress={handleAddFriend} className="active:opacity-60" hitSlop={8}>
              <View>
                <Ionicons name="person-add-outline" size={22} color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'} />
                {pendingRequestCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -4,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#FF3B30',
                    }}
                  />
                )}
              </View>
            </Pressable>
          )}
          {hasHeartbeat && (
            <HeartbeatIndicator
              isPaused={heartbeatSettings?.isPaused ?? false}
              hasUnreadAlerts={unreadAlerts.length > 0}
              onPress={handleHeartbeatPress}
            />
          )}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'}
          />
        }
      >
        {/* Profile Card */}
        <View className="px-5">
          <Pressable
            onPress={() => router.push('/(modals)/my-session-feed')}
            className="active:opacity-80"
          >
            <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4 mt-1">
              <View className="flex-row items-center">
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                  />
                ) : (
                  <View className="mr-3">
                    <DefaultAvatar
                      displayName={profile.display_name}
                      color={profile.avatar_color}
                      size={48}
                    />
                  </View>
                )}
                <View className="flex-1">
                  <Typography variant="headline-18" color="primary">
                    {profile.display_name}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    @{profile.handle}
                    {hasFriends && ` · ${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}`}
                  </Typography>
                </View>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Inner Circle Invite Banner */}
        <InnerCircleInviteBanner count={pendingCircleInviteCount} onPress={handleInnerCircle} />

        {/* Challenge Banner (pending incoming) */}
        <ChallengeBanner count={pendingChallengeCount} onPress={handleChallenges} />

        {/* Heartbeat Alerts */}
        {unreadAlerts.map((alert) => (
          <HeartbeatAlertCard
            key={alert.id}
            alert={alert}
            onCheckIn={handleCheckIn}
            onDismiss={markHeartbeatAlertRead}
          />
        ))}

        {/* Content */}
        {showEmptyState ? (
          <EmptyGroveState onAddFriend={handleAddFriend} />
        ) : (
          <>
            {/* Recent Activity section */}
            <View className="mt-3">
              <View className="px-5 mb-2">
                <Typography variant="subtitle-14-medium" color="secondary">
                  Recent Activity
                </Typography>
              </View>

              {hasFeed ? (
                <FriendCarousel
                  feed={feed}
                  lastGroveVisit={lastGroveVisit}
                  onReactionToggle={handleReactionToggle}
                  onAddFriend={handleAddFriend}
                  showAddFriend={!hasFriends}
                />
              ) : (
                <View className="px-5 py-8 items-center">
                  <Typography variant="body-14" color="secondary" className="text-center">
                    No recent sessions from friends. Check back later!
                  </Typography>
                </View>
              )}
            </View>

            {/* Active Challenges section */}
            <View className="mt-6">
              <View className="px-5 mb-3 flex-row items-center justify-between">
                <Typography variant="subtitle-16" color="primary">
                  Challenges
                </Typography>
                <Pressable onPress={handleChallenges} className="active:opacity-60" hitSlop={8}>
                  <Typography variant="body-12" style={{ color: '#E9A065' }}>
                    See All
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
                    />
                  ))}
                  {/* Create new challenge button */}
                  <Pressable
                    onPress={handleCreateChallenge}
                    className="w-[260px] bg-light-border/30 dark:bg-[#242540] rounded-2xl items-center justify-center"
                  >
                    <View className="w-12 h-12 rounded-full bg-[#E9A065]/10 items-center justify-center mb-2">
                      <Ionicons name="add" size={24} color="#E9A065" />
                    </View>
                    <Typography variant="body-12" color="secondary">
                      New Challenge
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

      <HeartbeatPauseSheet
        isVisible={showPauseSheet}
        onClose={() => setShowPauseSheet(false)}
        settings={heartbeatSettings}
        onPause={pauseHeartbeat}
        onResume={resumeHeartbeat}
      />
    </SafeAreaView>
  );
}
