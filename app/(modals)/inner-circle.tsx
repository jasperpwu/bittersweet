import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { HeartbeatPauseSheet } from '../../src/components/grove/HeartbeatPauseSheet';
import { useAppStore } from '../../src/store';
import i18n from '../../src/i18n';
import type { InnerCircleMember } from '../../src/services/grove/GroveHeartbeatService';
import type { FriendItem } from '../../src/services/grove/GroveFriendService';

const MAX_INNER_CIRCLE = 3;
const THRESHOLD_OPTIONS = [3, 5, 7, 14] as const;

export default function InnerCircleModal() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const heartbeatSettings = useAppStore((s) => s.grove.heartbeatSettings);
  const heartbeatLoading = useAppStore((s) => s.grove.heartbeatLoading);
  const innerCircle = useAppStore((s) => s.grove.innerCircle);
  const innerCircleLoading = useAppStore((s) => s.grove.innerCircleLoading);
  const incomingCircleInvites = useAppStore((s) => s.grove.incomingCircleInvites);
  const friends = useAppStore((s) => s.grove.friends);

  const fetchHeartbeatSettings = useAppStore((s) => s.grove.fetchHeartbeatSettings);
  const updateHeartbeatSettings = useAppStore((s) => s.grove.updateHeartbeatSettings);
  const fetchInnerCircle = useAppStore((s) => s.grove.fetchInnerCircle);
  const inviteToInnerCircle = useAppStore((s) => s.grove.inviteToInnerCircle);
  const removeFromInnerCircle = useAppStore((s) => s.grove.removeFromInnerCircle);
  const fetchIncomingCircleInvites = useAppStore((s) => s.grove.fetchIncomingCircleInvites);
  const acceptCircleInvite = useAppStore((s) => s.grove.acceptCircleInvite);
  const declineCircleInvite = useAppStore((s) => s.grove.declineCircleInvite);
  const pauseHeartbeat = useAppStore((s) => s.grove.pauseHeartbeat);
  const resumeHeartbeat = useAppStore((s) => s.grove.resumeHeartbeat);

  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [showPauseSheet, setShowPauseSheet] = useState(false);

  useEffect(() => {
    fetchHeartbeatSettings();
    fetchInnerCircle();
    fetchIncomingCircleInvites();
  }, []);

  const acceptedMembers = innerCircle.filter((m) => m.status === 'accepted');
  const pendingMembers = innerCircle.filter((m) => m.status === 'pending');
  const slotsUsed = acceptedMembers.length + pendingMembers.length;

  // Friends eligible to be added (accepted friends not already in circle)
  const circleUserIds = new Set(innerCircle.map((m) => m.circleMemberId));
  const eligibleFriends = friends.filter(
    (f) => !circleUserIds.has(f.profile.user_id)
  );

  const handleInvite = async (friend: FriendItem) => {
    try {
      await inviteToInnerCircle(friend.profile.user_id);
      setShowFriendPicker(false);
    } catch {
      Alert.alert(t('common.error'), t('gm.errSendInvite'));
    }
  };

  const handleRemove = (member: InnerCircleMember) => {
    Alert.alert(
      t('gm.icRemoveTitle'),
      t('gm.icRemoveMsg', { name: member.profile.display_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromInnerCircle(member.id);
            } catch {
              Alert.alert(t('common.error'), t('gm.errRemove'));
            }
          },
        },
      ]
    );
  };

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await acceptCircleInvite(inviteId);
    } catch {
      Alert.alert(t('common.error'), t('gm.errAcceptInvite'));
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await declineCircleInvite(inviteId);
    } catch {
      Alert.alert(t('common.error'), t('gm.errDeclineInvite'));
    }
  };

  const handleThresholdChange = async (days: 3 | 5 | 7 | 14) => {
    try {
      await updateHeartbeatSettings({ quietThresholdDays: days });
    } catch {
      Alert.alert(t('common.error'), t('gm.errUpdateSettings'));
    }
  };

  const renderMemberRow = useCallback((member: InnerCircleMember) => {
    const profile = member.profile;
    return (
      <View key={member.id} className="flex-row items-center py-3">
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
          />
        ) : (
          <View className="mr-3">
            <DefaultAvatar
              displayName={profile.display_name}
              color={profile.avatar_color}
              size={40}
            />
          </View>
        )}
        <View className="flex-1">
          <Typography variant="subtitle-14-medium" color="primary">
            {profile.display_name}
          </Typography>
          <Typography variant="body-12" color="secondary">
            {member.status === 'pending' ? t('gm.icInvitePending') : `@${profile.handle}`}
          </Typography>
        </View>
        <Pressable
          onPress={() => handleRemove(member)}
          className="w-8 h-8 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color="#8A8A8A" />
        </Pressable>
      </View>
    );
  }, [t]);

  if (heartbeatLoading || innerCircleLoading) {
    return (
      <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg items-center justify-center">
        <ActivityIndicator size="large" color="#FF6B6B" />
      </SafeAreaView>
    );
  }

  // Friend picker sub-view
  if (showFriendPicker) {
    return (
      <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
        <View className="h-[56px] px-5 flex-row items-center">
          <Pressable
            onPress={() => setShowFriendPicker(false)}
            className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color="#FF6B6B" />
          </Pressable>
          <Typography variant="headline-18" color="primary" className="ml-2">
            {t('gm.icChooseFriend')}
          </Typography>
        </View>

        {eligibleFriends.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="people-outline" size={48} color="#8A8A8A" />
            <Typography variant="body-14" color="secondary" className="mt-4 text-center">
              {t('gm.icNoEligible')}
            </Typography>
          </View>
        ) : (
          <ScrollView className="flex-1">
            {eligibleFriends.map((friend) => (
              <Pressable
                key={friend.friendshipId}
                onPress={() => handleInvite(friend)}
                className="flex-row items-center py-3 px-5 active:opacity-70"
              >
                {friend.profile.avatar_url ? (
                  <Image
                    source={{ uri: friend.profile.avatar_url }}
                    style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
                  />
                ) : (
                  <View className="mr-3">
                    <DefaultAvatar
                      displayName={friend.profile.display_name}
                      color={friend.profile.avatar_color}
                      size={44}
                    />
                  </View>
                )}
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {friend.profile.display_name}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    @{friend.profile.handle}
                  </Typography>
                </View>
                <Ionicons name="add-circle-outline" size={24} color="#FF6B6B" />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#FF6B6B" />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          {t('gm.icTitle')}
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Explanation card */}
        <View className="mx-5 bg-[#FF6B6B]/10 rounded-2xl p-4 mb-4">
          <View className="flex-row items-center mb-2">
            <Ionicons name="heart" size={18} color="#FF6B6B" />
            <Typography variant="subtitle-14-medium" color="primary" className="ml-2">
              {t('gm.icSafetyNet')}
            </Typography>
          </View>
          <Typography variant="body-12" color="secondary">
            {t('gm.icSafetyDesc', { count: MAX_INNER_CIRCLE })}
          </Typography>
        </View>

        {/* Current members */}
        <View className="mx-5 mb-4">
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            {t('gm.icMembers', { used: slotsUsed, max: MAX_INNER_CIRCLE })}
          </Typography>

          <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
            {[...acceptedMembers, ...pendingMembers].map((member, index, arr) => (
              <View key={member.id}>
                {renderMemberRow(member)}
                {index < arr.length - 1 && (
                  <View className="h-px bg-light-border dark:bg-dark-border" />
                )}
              </View>
            ))}

            {slotsUsed === 0 && (
              <View className="py-6 items-center">
                <Ionicons name="heart-outline" size={32} color="#8A8A8A" />
                <Typography variant="body-12" color="secondary" className="mt-2">
                  {t('gm.icNoMembers')}
                </Typography>
              </View>
            )}
          </View>

          {slotsUsed < MAX_INNER_CIRCLE && (
            <Pressable
              onPress={() => setShowFriendPicker(true)}
              className="mt-3 flex-row items-center justify-center bg-[#FF6B6B]/10 rounded-xl py-3 active:opacity-70"
            >
              <Ionicons name="add" size={18} color="#FF6B6B" />
              <Typography variant="subtitle-14-medium" style={{ color: '#FF6B6B' }} className="ml-1.5">
                {t('gm.addFriend')}
              </Typography>
            </Pressable>
          )}
        </View>

        {/* Incoming invites */}
        {incomingCircleInvites.length > 0 && (
          <View className="mx-5 mb-4">
            <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
              {t('gm.icIncomingInvites')}
            </Typography>

            <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
              {incomingCircleInvites.map((invite, index) => (
                <View key={invite.id}>
                  <View className="flex-row items-center py-3">
                    {invite.profile.avatar_url ? (
                      <Image
                        source={{ uri: invite.profile.avatar_url }}
                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                      />
                    ) : (
                      <View className="mr-3">
                        <DefaultAvatar
                          displayName={invite.profile.display_name}
                          color={invite.profile.avatar_color}
                          size={40}
                        />
                      </View>
                    )}
                    <View className="flex-1">
                      <Typography variant="subtitle-14-medium" color="primary">
                        {invite.profile.display_name}
                      </Typography>
                      <Typography variant="body-12" color="secondary">
                        {t('gm.icWantsYou')}
                      </Typography>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => handleDeclineInvite(invite.id)}
                        className="w-8 h-8 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
                      >
                        <Ionicons name="close" size={16} color="#8A8A8A" />
                      </Pressable>
                      <Pressable
                        onPress={() => handleAcceptInvite(invite.id)}
                        className="w-8 h-8 rounded-full bg-[#FF6B6B] items-center justify-center active:opacity-80"
                      >
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                  {index < incomingCircleInvites.length - 1 && (
                    <View className="h-px bg-light-border dark:bg-dark-border" />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Quiet threshold settings */}
        <View className="mx-5 mb-4">
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            {t('gm.icQuietThreshold')}
          </Typography>
          <Typography variant="body-12" color="secondary" className="mb-3">
            {t('gm.icQuietDesc')}
          </Typography>

          <View className="flex-row bg-light-border/30 dark:bg-[#242540] rounded-xl overflow-hidden">
            {THRESHOLD_OPTIONS.map((days) => {
              const isSelected = (heartbeatSettings?.quietThresholdDays ?? 3) === days;
              return (
                <Pressable
                  key={days}
                  onPress={() => handleThresholdChange(days)}
                  className={`flex-1 py-3 items-center ${
                    isSelected ? 'bg-[#FF6B6B]' : ''
                  }`}
                >
                  <Typography
                    variant="subtitle-14-medium"
                    style={{ color: isSelected ? '#FFFFFF' : isDark ? '#CACACA' : '#8B7355' }}
                  >
                    {days}d
                  </Typography>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Pause section */}
        <View className="mx-5 mb-8">
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            {t('gm.icPause')}
          </Typography>

          <Pressable
            onPress={() => setShowPauseSheet(true)}
            className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4 py-3.5 flex-row items-center active:opacity-70"
          >
            <View className="w-8 items-center mr-3">
              <Ionicons
                name={heartbeatSettings?.isPaused ? 'pause-circle' : 'pause-circle-outline'}
                size={22}
                color={heartbeatSettings?.isPaused ? '#FF6B6B' : isDark ? '#CACACA' : '#8B7355'}
              />
            </View>
            <View className="flex-1">
              <Typography variant="subtitle-14-medium" color="primary">
                {heartbeatSettings?.isPaused ? t('gm.icPaused') : t('gm.icPauseHeartbeat')}
              </Typography>
              {heartbeatSettings?.isPaused && heartbeatSettings.pauseExpiresAt && (
                <Typography variant="body-12" color="secondary">
                  {t('gm.icResumes', {
                    date: new Date(heartbeatSettings.pauseExpiresAt).toLocaleDateString(i18n.language, {
                      month: 'short',
                      day: 'numeric',
                    }),
                  })}
                </Typography>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
          </Pressable>
        </View>
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
