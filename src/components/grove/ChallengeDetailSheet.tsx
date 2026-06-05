import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { UserGrid } from './ChallengeDetailGrid';
import { formatTarget } from './ChallengeCard';
import { useAppStore } from '../../store';
import type { ChallengeItem, ChallengePeriodDetailsResult } from '../../services/grove/GroveChallengeService';

const OUTCOME_COLORS = {
  completed: '#22C55E',
  failed: '#EF4444',
};

const { height: screenHeight } = Dimensions.get('window');

interface ChallengeDetailSheetProps {
  challenge: ChallengeItem | null;
  isVisible: boolean;
  onClose: () => void;
  onDelete: (challengeId: string) => void;
}

export const ChallengeDetailSheet: React.FC<ChallengeDetailSheetProps> = ({
  challenge,
  isVisible,
  onClose,
  onDelete,
}) => {
  const currentUserId = useAppStore((s) => s.auth.user?.id ?? '');
  const fetchChallengePeriodDetails = useAppStore((s) => s.grove.fetchChallengePeriodDetails);

  const [details, setDetails] = useState<ChallengePeriodDetailsResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!challenge || !isVisible) {
      setDetails(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetails(null);

    fetchChallengePeriodDetails(challenge.id)
      .then((result) => {
        if (!cancelled) setDetails(result);
      })
      .catch(() => {
        // Silently fail
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [challenge?.id, isVisible]);

  if (!challenge) return null;

  const isCreator = challenge.creatorId === currentUserId;
  const isCompleted = challenge.status === 'completed';
  const isFailed = challenge.status === 'failed';
  const isCancelled = challenge.status === 'cancelled';
  const targetLabel = formatTarget(challenge.targetMinutes, challenge.period);

  const daysLeft = challenge.endDate
    ? Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Find current user's period data
  const myPeriodData = details?.participants.find((p) => p.user_id === currentUserId);

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} height={screenHeight * 0.75}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Header */}
        <View className="flex-row items-center mb-2">
          <Typography variant="body-14" className="mr-1.5">
            {challenge.tagIcon}
          </Typography>
          <Typography variant="headline-18" color="primary" className="flex-1" numberOfLines={1}>
            {challenge.tagName}
          </Typography>
          {isCompleted && (
            <View className="bg-green-500/20 rounded-full px-2.5 py-1">
              <Typography variant="body-12" style={{ color: '#22C55E' }}>
                Done
              </Typography>
            </View>
          )}
          {isFailed && (
            <View className="bg-red-500/20 rounded-full px-2.5 py-1">
              <Typography variant="body-12" style={{ color: '#EF4444' }}>
                Failed
              </Typography>
            </View>
          )}
          {isCancelled && (
            <View className="bg-yellow-500/20 rounded-full px-2.5 py-1">
              <Typography variant="body-12" style={{ color: '#EAB308' }}>
                Cancelled
              </Typography>
            </View>
          )}
        </View>

        {/* Target + meta row */}
        <View className="flex-row items-center flex-wrap gap-2 mb-4">
          <View className="bg-primary/10 rounded-lg px-2 py-1">
            <Typography variant="body-12" style={{ color: '#6592E9' }}>
              {targetLabel}
            </Typography>
          </View>
          {challenge.status === 'active' && daysLeft !== null && daysLeft > 0 && (
            <Typography variant="body-12" color="secondary">
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </Typography>
          )}
          {challenge.status === 'active' && !challenge.endDate && (
            <Typography variant="body-12" color="secondary">
              Ongoing
            </Typography>
          )}
          <Typography variant="body-12" color="secondary">
            +{challenge.fruitReward} fruits
          </Typography>
        </View>

        {/* Loading spinner */}
        {loading && (
          <View className="py-8 items-center">
            <ActivityIndicator size="small" />
          </View>
        )}

        {/* Current user's period grid */}
        {details && myPeriodData && challenge.startDate && (
          <View className="bg-light-border/30 dark:bg-[#242540] rounded-xl p-4 mb-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              Your Progress
            </Typography>
            <UserGrid
              label="You"
              minutesPerPeriod={myPeriodData.minutes}
              target={challenge.targetMinutes}
              periodType={challenge.period}
              startDate={challenge.startDate}
            />
          </View>
        )}

        {/* Ranking */}
        {details && (
          <View className="bg-light-border/30 dark:bg-[#242540] rounded-xl p-4 mb-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-3">
              Ranking
            </Typography>
            {[...details.participants]
              .sort((a, b) => b.hits - a.hits)
              .map((p, index) => {
                const participant = challenge.participants.find((cp) => cp.userId === p.user_id);
                const outcome = participant?.outcome;
                return (
                  <View key={p.user_id} className="flex-row items-center py-2">
                    <Typography variant="body-14" color="secondary" className="w-6">
                      {index + 1}.
                    </Typography>
                    <Typography variant="subtitle-14-medium" color="primary" className="flex-1">
                      {p.user_id === currentUserId ? 'You' : p.display_name}
                    </Typography>
                    <Typography variant="body-12" color="primary" className="mr-2">
                      {p.hits}/{details.total_periods}
                    </Typography>
                    {outcome && (
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: outcome === 'completed' ? '#22C55E20' : '#EF444420',
                        }}
                      >
                        <Typography
                          variant="tiny-10"
                          style={{ color: OUTCOME_COLORS[outcome] }}
                        >
                          {outcome === 'completed' ? 'Done' : 'Failed'}
                        </Typography>
                      </View>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        {/* Delete button for creator */}
        {isCreator && (
          <Pressable
            onPress={() => onDelete(challenge.id)}
            className="flex-row items-center justify-center mt-1 mb-4 py-3 rounded-xl bg-red-500/10 active:opacity-70"
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Typography variant="subtitle-14-medium" style={{ color: '#EF4444' }} className="ml-2">
              Delete Challenge
            </Typography>
          </Pressable>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
