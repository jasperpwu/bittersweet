import React, { useEffect, useCallback } from 'react';
import { View, SafeAreaView, Pressable, SectionList, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { ChallengeCard } from '../../src/components/grove/ChallengeCard';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import type { ChallengeItem } from '../../src/services/grove/GroveChallengeService';

export default function ChallengesModal() {
  const challenges = useAppStore((s) => s.grove.challenges);
  const currentUserId = useAppStore((s) => s.auth.user?.id ?? '');
  const fetchChallenges = useAppStore((s) => s.grove.fetchChallenges);
  const acceptChallenge = useAppStore((s) => s.grove.acceptChallenge);
  const declineChallenge = useAppStore((s) => s.grove.declineChallenge);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const handleAccept = useCallback(async (challengeId: string) => {
    try {
      await acceptChallenge(challengeId);
    } catch {
      Alert.alert('Error', 'Failed to accept challenge. Please try again.');
    }
  }, [acceptChallenge]);

  const handleDecline = useCallback(async (challengeId: string) => {
    try {
      await declineChallenge(challengeId);
    } catch {
      Alert.alert('Error', 'Failed to decline challenge. Please try again.');
    }
  }, [declineChallenge]);

  // Group into sections
  const pendingIncoming = challenges.filter(c => c.status === 'pending' && c.isIncoming);
  const pendingOutgoing = challenges.filter(c => c.status === 'pending' && !c.isIncoming);
  const active = challenges.filter(c => c.status === 'active');
  const completed = challenges.filter(c => c.status === 'completed' || c.status === 'failed');

  const sections = [
    ...(pendingIncoming.length > 0 ? [{ title: 'Incoming Challenges', data: pendingIncoming }] : []),
    ...(pendingOutgoing.length > 0 ? [{ title: 'Sent Challenges', data: pendingOutgoing }] : []),
    ...(active.length > 0 ? [{ title: 'Active', data: active }] : []),
    ...(completed.length > 0 ? [{ title: 'Completed', data: completed }] : []),
  ];

  const renderPendingIncoming = (challenge: ChallengeItem) => (
    <View className="flex-row items-center py-3 px-5">
      <View className="mr-3">
        <DefaultAvatar
          displayName={challenge.challengerProfile.display_name}
          color={challenge.challengerProfile.avatar_color}
          size={40}
        />
      </View>
      <View className="flex-1">
        <Typography variant="subtitle-14-medium" color="primary">
          {challenge.challengerProfile.display_name}
        </Typography>
        <Typography variant="body-12" color="secondary">
          {challenge.tagIcon} {challenge.tagName} · {challenge.streakDays} days
        </Typography>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => handleDecline(challenge.id)}
          className="w-9 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
        >
          <Ionicons name="close" size={18} color="#8A8A8A" />
        </Pressable>
        <Pressable
          onPress={() => handleAccept(challenge.id)}
          className="w-9 h-9 rounded-full bg-[#E9A065] items-center justify-center active:opacity-80"
        >
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  const renderItem = ({ item, section }: { item: ChallengeItem; section: { title: string } }) => {
    if (section.title === 'Incoming Challenges') {
      return renderPendingIncoming(item);
    }

    if (section.title === 'Sent Challenges') {
      return (
        <View className="flex-row items-center py-3 px-5">
          <View className="mr-3">
            <DefaultAvatar
              displayName={item.challengeeProfile.display_name}
              color={item.challengeeProfile.avatar_color}
              size={40}
            />
          </View>
          <View className="flex-1">
            <Typography variant="subtitle-14-medium" color="primary">
              {item.challengeeProfile.display_name}
            </Typography>
            <Typography variant="body-12" color="secondary">
              {item.tagIcon} {item.tagName} · {item.streakDays} days · Pending
            </Typography>
          </View>
        </View>
      );
    }

    // Active or completed: show as ChallengeCard
    return (
      <View className="px-5 py-2">
        <ChallengeCard challenge={item} currentUserId={currentUserId} />
      </View>
    );
  };

  const isEmpty = sections.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color="#6592E9" />
          </Pressable>
          <Typography variant="headline-18" color="primary" className="ml-2">
            Challenges
          </Typography>
        </View>
        <Pressable
          onPress={() => router.push('/(modals)/create-challenge')}
          className="w-10 h-10 items-center justify-center active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="add" size={28} color="#E9A065" />
        </Pressable>
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="flame-outline" size={48} color="#8A8A8A" />
          <Typography variant="body-14" color="secondary" className="mt-4 text-center px-8">
            No challenges yet. Start one with a friend!
          </Typography>
          <Pressable
            onPress={() => router.push('/(modals)/create-challenge')}
            className="mt-4 bg-[#E9A065] rounded-xl px-5 py-2.5 active:opacity-80"
          >
            <Typography variant="subtitle-14-medium" style={{ color: '#FFFFFF' }}>
              Start a Challenge
            </Typography>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View className="px-5 pt-4 pb-2 bg-light-bg dark:bg-dark-bg">
              <Typography variant="subtitle-14-medium" color="secondary">
                {title}
              </Typography>
            </View>
          )}
          ItemSeparatorComponent={() => (
            <View className="h-px bg-light-border dark:bg-dark-border mx-5" />
          )}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}
