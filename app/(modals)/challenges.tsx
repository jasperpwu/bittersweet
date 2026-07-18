import React, { useEffect, useCallback, useState } from 'react';
import { View, SafeAreaView, Pressable, SectionList, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/config/theme';
import { ChallengeCard, formatTarget } from '../../src/components/grove/ChallengeCard';
import { ChallengeDetailSheet } from '../../src/components/grove/ChallengeDetailSheet';
import { ChallengeAcceptSheet } from '../../src/components/grove/ChallengeAcceptSheet';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import type { ChallengeItem } from '../../src/services/grove/GroveChallengeService';
import { useTranslation } from 'react-i18next';

const ACCENT = '#E9A065';

export default function ChallengesModal() {
  const { t } = useTranslation();
  const challenges = useAppStore((s) => s.grove.challenges);
  const currentUserId = useAppStore((s) => s.auth.user?.id ?? '');
  const fetchChallenges = useAppStore((s) => s.grove.fetchChallenges);
  const declineChallenge = useAppStore((s) => s.grove.declineChallenge);
  const deleteChallengeAction = useAppStore((s) => s.grove.deleteChallenge);

  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeItem | null>(null);
  const [acceptingChallenge, setAcceptingChallenge] = useState<ChallengeItem | null>(null);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const handleDecline = useCallback(async (challengeId: string) => {
    try {
      await declineChallenge(challengeId);
    } catch {
      Alert.alert(t('common.error'), t('challengesList.failedDecline'));
    }
  }, [declineChallenge]);

  const handleDelete = useCallback(async (challengeId: string) => {
    const challenge = challenges.find(c => c.id === challengeId);
    const isActive = challenge?.status === 'active';
    const message = isActive
      ? t('grove.deleteChallengeActive')
      : t('grove.deleteChallengeConfirm');

    Alert.alert(
      t('grove.deleteChallengeTitle'),
      message,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChallengeAction(challengeId);
              setSelectedChallenge(null);
            } catch {
              Alert.alert(t('common.error'), t('grove.failedDeleteChallenge'));
            }
          },
        },
      ],
    );
  }, [deleteChallengeAction, challenges]);

  // Group into sections
  const pendingIncoming = challenges.filter(c => c.status === 'pending' && c.isIncoming);
  const active = challenges.filter(c => c.status === 'active');
  const completed = challenges.filter(c => c.status === 'completed' || c.status === 'failed');
  const cancelled = challenges.filter(c => c.status === 'cancelled');

  const sections = [
    ...(pendingIncoming.length > 0 ? [{ key: 'incoming', title: t('challengesList.secIncoming'), data: pendingIncoming }] : []),
    ...(active.length > 0 ? [{ key: 'active', title: t('challengesList.secActive'), data: active }] : []),
    ...(completed.length > 0 ? [{ key: 'completed', title: t('challengesList.secCompleted'), data: completed }] : []),
    ...(cancelled.length > 0 ? [{ key: 'cancelled', title: t('challengesList.secCancelled'), data: cancelled }] : []),
  ];

  const renderPendingIncoming = (challenge: ChallengeItem) => {
    const creatorParticipant = challenge.participants.find(p => p.role === 'creator');
    const creatorProfile = creatorParticipant?.profile || { display_name: t('challengesList.unknown'), avatar_color: '#6592E9', avatar_url: null, handle: 'unknown' };
    const otherInvitees = challenge.participants.filter(p => p.role === 'invitee' && p.userId !== currentUserId);

    return (
      <View className="flex-row items-center py-3 px-5">
        <View className="mr-3">
          <DefaultAvatar
            displayName={creatorProfile.display_name}
            color={creatorProfile.avatar_color}
            size={40}
          />
        </View>
        <View className="flex-1">
          <Typography variant="subtitle-14-medium" color="primary">
            {creatorProfile.display_name}
          </Typography>
          <Typography variant="body-12" color="secondary">
            {challenge.tagIcon} {challenge.tagName} · {formatTarget(challenge.targetMinutes, challenge.period)}
            {otherInvitees.length > 0 && ` · ${t('challengesList.otherInvitees', { count: otherInvitees.length })}`}
          </Typography>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => handleDecline(challenge.id)}
            className="w-9 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
          >
            <Ionicons name="close" size={18} color={colors.light.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => setAcceptingChallenge(challenge)}
            className="w-9 h-9 rounded-full items-center justify-center active:opacity-80"
            style={{ backgroundColor: ACCENT }}
          >
            <Ionicons name="checkmark" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderCancelled = (item: ChallengeItem) => {
    const isCreator = item.creatorId === currentUserId;
    return (
      <View className="flex-row items-center py-3 px-5">
        <View className="flex-1">
          <Typography variant="subtitle-14-medium" color="primary" numberOfLines={1}>
            {item.tagIcon} {item.tagName}
          </Typography>
          <Typography variant="body-12" color="secondary">
            {formatTarget(item.targetMinutes, item.period)} · {t('challengesList.noOneAccepted')}
          </Typography>
        </View>
        {isCreator && (
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => handleDelete(item.id)}
              className="w-9 h-9 rounded-full bg-red-500/20 items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderItem = ({ item, section }: { item: ChallengeItem; section: { key?: string } }) => {
    if (section.key === 'incoming') {
      return renderPendingIncoming(item);
    }

    if (section.key === 'cancelled') {
      return renderCancelled(item);
    }

    // Active or completed: show as ChallengeCard (tappable)
    return (
      <View className="px-5 py-2">
        <ChallengeCard
          challenge={item}
          currentUserId={currentUserId}
          onPress={() => setSelectedChallenge(item)}
        />
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
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </Pressable>
          <Typography variant="headline-18" color="primary" className="ml-2">
            {t('grove.challenges')}
          </Typography>
        </View>
        <Pressable
          onPress={() => router.push('/(modals)/create-challenge')}
          className="w-10 h-10 items-center justify-center active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="add" size={28} color={ACCENT} />
        </Pressable>
      </View>

      {isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="flame-outline" size={48} color={colors.light.textSecondary} />
          <Typography variant="body-14" color="secondary" className="mt-4 text-center px-8">
            {t('challengesList.emptyText')}
          </Typography>
          <Button
            variant="ghost"
            className="mt-4"
            style={{ backgroundColor: ACCENT }}
            onPress={() => router.push('/(modals)/create-challenge')}
          >
            <Typography variant="subtitle-14-medium" style={{ color: colors.white }}>
              {t('groveUI.startChallenge')}
            </Typography>
          </Button>
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

      <ChallengeDetailSheet
        challenge={selectedChallenge}
        isVisible={selectedChallenge !== null}
        onClose={() => setSelectedChallenge(null)}
        onDelete={handleDelete}
      />

      <ChallengeAcceptSheet
        challenge={acceptingChallenge}
        isVisible={acceptingChallenge !== null}
        onClose={() => setAcceptingChallenge(null)}
      />
    </SafeAreaView>
  );
}
