import React, { useCallback } from 'react';
import { View, SafeAreaView, Image, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { FriendCarousel } from '../../src/components/grove/FriendCarousel';
import { FriendRequestBanner } from '../../src/components/grove/FriendRequestBanner';
import { ChallengeBanner } from '../../src/components/grove/ChallengeBanner';
import { ChallengeCard } from '../../src/components/grove/ChallengeCard';
import { EmptyChallengesState } from '../../src/components/grove/EmptyChallengesState';
import { Leaderboard } from '../../src/components/grove/Leaderboard';
import { EmptyGroveState } from '../../src/components/grove/EmptyGroveState';
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
  const rankings = useAppStore((s) => s.grove.rankings);
  const rankingsLoading = useAppStore((s) => s.grove.rankingsLoading);
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

  // Fetch data on tab focus
  useFocusEffect(
    useCallback(() => {
      if (profile) {
        fetchFriends();
        fetchFeed();
        fetchFriendRequests();
        fetchRankings();
        fetchChallenges();
      }

      // Update last visit when leaving the tab
      return () => {
        updateLastGroveVisit();
      };
    }, [profile?.user_id])
  );

  const handleReactionToggle = useCallback(
    (sharedSessionId: string) => {
      const item = feed.find((f) => f.sharedSession.id === sharedSessionId);
      if (item?.hasReacted) {
        removeReaction(sharedSessionId);
      } else {
        addReaction(sharedSessionId);
      }
    },
    [feed, addReaction, removeReaction]
  );

  const handleAddFriend = useCallback(() => {
    router.push('/(modals)/add-friends');
  }, []);

  const handleFriendRequests = useCallback(() => {
    router.push('/(modals)/friend-requests');
  }, []);

  const handleChallenges = useCallback(() => {
    router.push('/(modals)/challenges');
  }, []);

  const handleCreateChallenge = useCallback(() => {
    router.push('/(modals)/create-challenge');
  }, []);

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
  const isLoading = feedLoading || friendsLoading;
  const activeChallenges = challenges.filter((c) => c.status === 'active');

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Typography variant="headline-24" color="primary">
          Grove
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
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

        {/* Friend Request Banner */}
        <FriendRequestBanner count={pendingRequestCount} onPress={handleFriendRequests} />

        {/* Challenge Banner (pending incoming) */}
        <ChallengeBanner count={pendingChallengeCount} onPress={handleChallenges} />

        {/* Content */}
        {isLoading && !hasFeed && !hasFriends ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#6592E9" />
          </View>
        ) : hasFriends || hasFeed ? (
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
                rankings={rankings}
                loading={rankingsLoading}
                period={rankingsPeriod}
                onPeriodChange={setRankingsPeriod}
              />
            </View>
          </>
        ) : (
          <EmptyGroveState onAddFriend={handleAddFriend} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
