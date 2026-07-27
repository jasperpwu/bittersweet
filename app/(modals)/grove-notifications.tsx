import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, RefreshControl, Alert, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import { colors } from '../../src/config/theme';
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
  const { t } = useTranslation();
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
      Alert.alert(t('common.error'), t('gm.errAcceptRequest'));
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await rejectFriendRequest(friendshipId);
    } catch {
      Alert.alert(t('common.error'), t('gm.errDeclineRequest'));
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await acceptCircleInvite(inviteId);
    } catch {
      Alert.alert(t('common.error'), t('gm.errAcceptInvite'));
    }
  };

  const handleClaimReward = async (challengeId: string) => {
    if (claimingIds.includes(challengeId)) return;
    setClaimingIds((ids) => [...ids, challengeId]);
    try {
      const { claimed, fruitReward } = await claimChallengeReward(challengeId);
      if (claimed) {
        Alert.alert(t('gm.notifRewardTitle'), t('gm.notifRewardBody', { count: fruitReward }));
      }
      // If it was already claimed elsewhere, the refresh inside the action updates
      // the row to "Claimed" with no pop-up — nothing more to do here.
    } catch {
      Alert.alert(t('common.error'), t('gm.errClaimReward'));
    } finally {
      setClaimingIds((ids) => ids.filter((id) => id !== challengeId));
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await declineCircleInvite(inviteId);
    } catch {
      Alert.alert(t('common.error'), t('gm.errDeclineInvite'));
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
                {t('gm.notifFriendRequest')}
              </Typography>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => handleRejectRequest(item.friendshipId)}
                className="w-9 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
              >
                <Ionicons name="close" size={18} color={colors.light.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => handleAcceptRequest(item.friendshipId)}
                className="w-9 h-9 rounded-full bg-primary items-center justify-center active:opacity-80"
              >
                <Ionicons name="checkmark" size={18} color={colors.white} />
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
                {t('gm.notifCircleInvite')}
              </Typography>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => handleDeclineInvite(item.inviteId)}
                className="w-9 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
              >
                <Ionicons name="close" size={18} color={colors.light.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => handleAcceptInvite(item.inviteId)}
                className="w-9 h-9 rounded-full bg-error items-center justify-center active:opacity-80"
              >
                <Ionicons name="checkmark" size={18} color={colors.white} />
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
                className="mr-3 items-center justify-center rounded-full bg-error/20"
                style={{ width: 44, height: 44 }}
              >
                <Ionicons name="heart" size={20} color={colors.error} />
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
                  {t('gm.dismiss')}
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
              style={{ width: 44, height: 44, backgroundColor: `${colors.challenge}20` }}
            >
              <Ionicons name="flame" size={20} color={colors.challenge} />
            </View>
            <View className="flex-1 mr-2">
              <Typography variant="subtitle-14-medium" color="primary">
                {t('gm.notifChallengeInvite', {
                  name: inviter?.profile.display_name ?? t('gm.notifSomeone'),
                })}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {t('gm.notifChallengeReview', { icon: challenge.tagIcon, name: challenge.tagName })}
              </Typography>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.light.textSecondary} />
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

        return (
          <Pressable
            key={item.id}
            onPress={() => router.push('/(modals)/challenges')}
            className="flex-row items-center py-3.5 px-5 active:opacity-70"
          >
            <View
              className="mr-3 items-center justify-center rounded-full"
              style={{ width: 44, height: 44, backgroundColor: won ? colors.success + '33' : `${colors.challenge}20` }}
            >
              <Ionicons
                name={won ? 'trophy' : 'flag'}
                size={20}
                color={won ? colors.success : colors.challenge}
              />
            </View>
            <View className="flex-1 mr-2">
              <Typography variant="subtitle-14-medium" color="primary">
                {won
                  ? t('gm.notifChallengeCompleted', { icon: challenge.tagIcon, name: challenge.tagName })
                  : t('gm.notifChallengeEnded', { icon: challenge.tagIcon, name: challenge.tagName })}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {won
                  ? claimed
                    ? t('gm.notifEarned', { count: challenge.fruitReward })
                    : t('gm.notifClaimYour', { count: challenge.fruitReward })
                  : t('gm.notifTargetMissed')}
              </Typography>
            </View>
            {won && !claimed ? (
              <Pressable
                onPress={() => handleClaimReward(challenge.id)}
                disabled={claiming}
                className={`px-3.5 h-9 rounded-full bg-success items-center justify-center active:opacity-80 ${claiming ? 'opacity-50' : ''}`}
                hitSlop={6}
              >
                <Typography variant="subtitle-14-medium" style={{ color: colors.white }}>
                  {claiming ? t('gm.notifClaiming') : t('gm.notifClaim')}
                </Typography>
              </Pressable>
            ) : won && claimed ? (
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Typography variant="body-12" className="ml-1" style={{ color: colors.success }}>
                  {t('gm.notifClaimed')}
                </Typography>
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={16} color={colors.light.textSecondary} />
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
          <Ionicons name="arrow-back" size={24} color={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary} />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          {t('gm.notifTitle')}
        </Typography>
      </View>

      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="notifications-off-outline" size={48} color={colors.light.textSecondary} />
          <Typography variant="body-14" color="secondary" className="mt-4 text-center px-8">
            {t('gm.notifEmpty')}
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
              tintColor={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary}
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
