import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, SafeAreaView, Pressable, Image, ScrollView, RefreshControl, Alert, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import {
  buildGroveNotifications,
  type GroveNotification,
} from '../../src/utils/groveNotifications';
import type { GroveProfile } from '../../src/services/grove/GroveService';

// Avatar shared by the rows that reference a grove profile.
function NotificationAvatar({ profile }: { profile: GroveProfile }) {
  if (profile.avatar_url) {
    return (
      <Image
        source={{ uri: profile.avatar_url }}
        style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
      />
    );
  }
  return (
    <View className="mr-3">
      <DefaultAvatar displayName={profile.display_name} color={profile.avatar_color} size={44} />
    </View>
  );
}

export default function GroveNotificationsModal() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const incomingRequests = useAppStore((s) => s.grove.incomingRequests);
  const incomingCircleInvites = useAppStore((s) => s.grove.incomingCircleInvites);
  const heartbeatAlerts = useAppStore((s) => s.grove.heartbeatAlerts);
  const challenges = useAppStore((s) => s.grove.challenges);

  const fetchFriendRequests = useAppStore((s) => s.grove.fetchFriendRequests);
  const fetchIncomingCircleInvites = useAppStore((s) => s.grove.fetchIncomingCircleInvites);
  const fetchHeartbeatAlerts = useAppStore((s) => s.grove.fetchHeartbeatAlerts);
  const fetchChallenges = useAppStore((s) => s.grove.fetchChallenges);
  const markNotificationsSeen = useAppStore((s) => s.grove.markNotificationsSeen);

  const acceptFriendRequest = useAppStore((s) => s.grove.acceptFriendRequest);
  const rejectFriendRequest = useAppStore((s) => s.grove.rejectFriendRequest);
  const acceptCircleInvite = useAppStore((s) => s.grove.acceptCircleInvite);
  const declineCircleInvite = useAppStore((s) => s.grove.declineCircleInvite);
  const markHeartbeatAlertRead = useAppStore((s) => s.grove.markHeartbeatAlertRead);
  const claimChallengeReward = useAppStore((s) => s.grove.claimChallengeReward);
  const currentUserId = useAppStore((s) => s.auth.user?.id ?? '');

  const [refreshing, setRefreshing] = useState(false);
  // Challenge ids with an in-flight claim, to disable the CTA and avoid double-tap.
  const [claimingIds, setClaimingIds] = useState<string[]>([]);

  const fetchAll = useCallback(async () => {
    await Promise.all([
      fetchFriendRequests(),
      fetchIncomingCircleInvites(),
      fetchHeartbeatAlerts(),
      fetchChallenges(),
    ]);
  }, [fetchFriendRequests, fetchIncomingCircleInvites, fetchHeartbeatAlerts, fetchChallenges]);

  // Refresh on open, then mark everything seen so the bell badge clears.
  useEffect(() => {
    fetchAll();
    markNotificationsSeen();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  const notifications = useMemo(
    () =>
      buildGroveNotifications({
        incomingRequests,
        incomingCircleInvites,
        heartbeatAlerts,
        challenges,
      }),
    [incomingRequests, incomingCircleInvites, heartbeatAlerts, challenges]
  );

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await acceptFriendRequest(friendshipId);
    } catch {
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await rejectFriendRequest(friendshipId);
    } catch {
      Alert.alert('Error', 'Failed to decline request. Please try again.');
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await acceptCircleInvite(inviteId);
    } catch {
      Alert.alert('Error', 'Failed to accept invite. Please try again.');
    }
  };

  const handleClaimReward = async (challengeId: string) => {
    if (claimingIds.includes(challengeId)) return;
    setClaimingIds((ids) => [...ids, challengeId]);
    try {
      const { claimed, fruitReward } = await claimChallengeReward(challengeId);
      if (claimed) {
        Alert.alert(
          'Reward claimed! 🎉',
          `You earned ${fruitReward} ${fruitReward === 1 ? 'fruit' : 'fruits'}.`
        );
      }
      // If it was already claimed elsewhere, the refresh inside the action updates
      // the row to "Claimed" with no pop-up — nothing more to do here.
    } catch {
      Alert.alert('Error', 'Failed to claim reward. Please try again.');
    } finally {
      setClaimingIds((ids) => ids.filter((id) => id !== challengeId));
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await declineCircleInvite(inviteId);
    } catch {
      Alert.alert('Error', 'Failed to decline invite. Please try again.');
    }
  };

  const renderItem = (item: GroveNotification) => {
    switch (item.kind) {
      case 'friend_request':
        return (
          <View key={item.id} className="flex-row items-center py-3.5 px-5">
            <NotificationAvatar profile={item.profile} />
            <View className="flex-1 mr-2">
              <Typography variant="subtitle-14-medium" color="primary">
                {item.profile.display_name}
              </Typography>
              <Typography variant="body-12" color="secondary">
                Sent you a friend request
              </Typography>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => handleRejectRequest(item.friendshipId)}
                className="w-9 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
              >
                <Ionicons name="close" size={18} color="#8A8A8A" />
              </Pressable>
              <Pressable
                onPress={() => handleAcceptRequest(item.friendshipId)}
                className="w-9 h-9 rounded-full bg-primary items-center justify-center active:opacity-80"
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        );

      case 'circle_invite':
        return (
          <View key={item.id} className="flex-row items-center py-3.5 px-5">
            <NotificationAvatar profile={item.profile} />
            <View className="flex-1 mr-2">
              <Typography variant="subtitle-14-medium" color="primary">
                {item.profile.display_name}
              </Typography>
              <Typography variant="body-12" color="secondary">
                Invited you to their inner circle
              </Typography>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => handleDeclineInvite(item.inviteId)}
                className="w-9 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
              >
                <Ionicons name="close" size={18} color="#8A8A8A" />
              </Pressable>
              <Pressable
                onPress={() => handleAcceptInvite(item.inviteId)}
                className="w-9 h-9 rounded-full bg-[#FF6B6B] items-center justify-center active:opacity-80"
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        );

      case 'heartbeat_alert': {
        const { alert } = item;
        const profile = alert.aboutProfile;
        return (
          <View key={item.id} className="flex-row items-center py-3.5 px-5">
            {profile ? (
              <NotificationAvatar profile={profile} />
            ) : (
              <View
                className="mr-3 items-center justify-center rounded-full bg-[#FF6B6B]/20"
                style={{ width: 44, height: 44 }}
              >
                <Ionicons name="heart" size={20} color="#FF6B6B" />
              </View>
            )}
            <View className="flex-1 mr-2">
              {profile && (
                <Typography variant="subtitle-14-medium" color="primary">
                  {profile.display_name}
                </Typography>
              )}
              <Typography variant="body-12" color="secondary">
                {alert.notificationText}
              </Typography>
            </View>
            {!alert.readAt && (
              <Pressable
                onPress={() => markHeartbeatAlertRead(alert.id)}
                className="px-3 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
              >
                <Typography variant="body-12" color="secondary">
                  Dismiss
                </Typography>
              </Pressable>
            )}
          </View>
        );
      }

      case 'challenge_invite': {
        const { challenge } = item;
        const inviter = challenge.participants.find((p) => p.userId === challenge.creatorId);
        return (
          <Pressable
            key={item.id}
            onPress={() => router.push('/(modals)/challenges')}
            className="flex-row items-center py-3.5 px-5 active:opacity-70"
          >
            <View
              className="mr-3 items-center justify-center rounded-full"
              style={{ width: 44, height: 44, backgroundColor: '#E9A06520' }}
            >
              <Ionicons name="flame" size={20} color="#E9A065" />
            </View>
            <View className="flex-1 mr-2">
              <Typography variant="subtitle-14-medium" color="primary">
                {inviter?.profile.display_name ?? 'Someone'} invited you to a challenge
              </Typography>
              <Typography variant="body-12" color="secondary">
                {challenge.tagIcon} {challenge.tagName} · Tap to review
              </Typography>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
          </Pressable>
        );
      }

      case 'challenge_finished': {
        const { challenge } = item;
        // status is derived per-individual, so "completed" already means I won.
        const won = challenge.status === 'completed';
        const myParticipant =
          challenge.myParticipant ?? challenge.participants.find((p) => p.userId === currentUserId) ?? null;
        const claimed = !!myParticipant?.rewardClaimedAt;
        const claiming = claimingIds.includes(challenge.id);
        const fruitLabel = `${challenge.fruitReward} ${challenge.fruitReward === 1 ? 'fruit' : 'fruits'}`;

        return (
          <Pressable
            key={item.id}
            onPress={() => router.push('/(modals)/challenges')}
            className="flex-row items-center py-3.5 px-5 active:opacity-70"
          >
            <View
              className="mr-3 items-center justify-center rounded-full"
              style={{ width: 44, height: 44, backgroundColor: won ? '#51BC6F20' : '#E9A06520' }}
            >
              <Ionicons
                name={won ? 'trophy' : 'flag'}
                size={20}
                color={won ? '#51BC6F' : '#E9A065'}
              />
            </View>
            <View className="flex-1 mr-2">
              <Typography variant="subtitle-14-medium" color="primary">
                {challenge.tagIcon} {challenge.tagName} challenge {won ? 'completed' : 'ended'}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {won
                  ? claimed
                    ? `You earned ${fruitLabel}`
                    : `Claim your ${fruitLabel}`
                  : 'Target not reached this time'}
              </Typography>
            </View>
            {won && !claimed ? (
              <Pressable
                onPress={() => handleClaimReward(challenge.id)}
                disabled={claiming}
                className={`px-3.5 h-9 rounded-full bg-[#51BC6F] items-center justify-center active:opacity-80 ${claiming ? 'opacity-50' : ''}`}
                hitSlop={6}
              >
                <Typography variant="subtitle-14-medium" style={{ color: '#FFFFFF' }}>
                  {claiming ? 'Claiming…' : 'Claim'}
                </Typography>
              </Pressable>
            ) : won && claimed ? (
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color="#51BC6F" />
                <Typography variant="body-12" className="ml-1" style={{ color: '#51BC6F' }}>
                  Claimed
                </Typography>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
            )}
          </Pressable>
        );
      }
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#5D4E37'} />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          Notifications
        </Typography>
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="notifications-off-outline" size={48} color="#8A8A8A" />
          <Typography variant="body-14" color="secondary" className="mt-4 text-center px-8">
            You&apos;re all caught up
          </Typography>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? '#FFFFFF' : '#5D4E37'}
            />
          }
        >
          {notifications.map((item, index) => (
            <View key={item.id}>
              {index > 0 && <View className="h-px bg-light-border dark:bg-dark-border mx-5" />}
              {renderItem(item)}
            </View>
          ))}
          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
