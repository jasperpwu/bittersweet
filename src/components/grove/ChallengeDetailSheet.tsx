import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { UserGrid } from './ChallengeDetailGrid';
import { formatTarget, formatStartDate } from './ChallengeCard';
import { useAppStore } from '../../store';
import type { ChallengeItem, ChallengePeriodDetailsResult } from '../../services/grove/GroveChallengeService';
import { useTranslation } from 'react-i18next';

const OUTCOME_COLORS = {
  completed: colors.success,
  failed: colors.danger,
};

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
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
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

  // The challenge is over once today (local) is past its end date — the same rule
  // the per-individual result derivation uses in GroveChallengeService.
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isOver = !!challenge.endDate && challenge.endDate < todayStr;

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
              <Typography variant="body-12" style={{ color: colors.success }}>
                {t('challenge.done')}
              </Typography>
            </View>
          )}
          {isFailed && (
            <View className="bg-red-500/20 rounded-full px-2.5 py-1">
              <Typography variant="body-12" style={{ color: colors.danger }}>
                {t('challenge.failed')}
              </Typography>
            </View>
          )}
          {isCancelled && (
            <View className="bg-yellow-500/20 rounded-full px-2.5 py-1">
              <Typography variant="body-12" style={{ color: colors.warning }}>
                {t('challenge.cancelled')}
              </Typography>
            </View>
          )}
        </View>

        {/* Start date + days left */}
        <View className="flex-row items-center justify-between mb-2">
          {(() => {
            const start = formatStartDate(challenge.startDate);
            return start ? (
              <Typography variant="body-12" color="secondary">
                {start.label}: {start.dateStr}
              </Typography>
            ) : <View />;
          })()}
          {challenge.status === 'active' && challenge.hasStarted && daysLeft !== null && daysLeft > 0 && (
            <Typography variant="body-12" color="secondary">
              {t('challenge.daysLeft', { count: daysLeft })}
            </Typography>
          )}
          {challenge.status === 'active' && challenge.hasStarted && !challenge.endDate && (
            <Typography variant="body-12" color="secondary">
              {t('challenge.ongoing')}
            </Typography>
          )}
        </View>

        {/* Target + fruits */}
        <View className="flex-row items-center gap-2 mb-4">
          <View className="bg-primary/10 rounded-lg px-2 py-1">
            <Typography variant="body-12" style={{ color: colors.primary }}>
              {targetLabel}
            </Typography>
          </View>
          <Typography variant="body-12" color="secondary">
            {t('challenge.fruitsReward', { count: challenge.fruitReward })}
          </Typography>
        </View>

        {/* Loading spinner */}
        {loading && (
          <View className="py-8 items-center">
            <ActivityIndicator size="small" />
          </View>
        )}

        {/* Current user's period grid. pb-1 rather than p-4: UserGrid already
            ends with its own mb-3, so a full bottom padding would double up
            into a visible gap under the grid. */}
        {details && myPeriodData && challenge.startDate && (
          <View className="bg-light-border/30 dark:bg-dark-card rounded-xl px-4 pt-4 pb-1 mb-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('challenge.yourProgress')}
            </Typography>
            <UserGrid
              label={t('common.you')}
              minutesPerPeriod={myPeriodData.minutes}
              target={challenge.targetMinutes}
              periodType={challenge.period}
              startDate={challenge.startDate}
            />
          </View>
        )}

        {/* Ranking */}
        {details && (
          <View className="bg-light-border/30 dark:bg-dark-card rounded-xl p-4 mb-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-3">
              {t('challenge.ranking')}
            </Typography>
            {[...details.participants]
              .sort((a, b) => b.hits - a.hits)
              .map((p, index) => {
                // Outcome is derived from hits — no stored value needed: once the
                // challenge is over, hitting every period is a win. Mirrors the
                // per-individual result logic in GroveChallengeService.
                const outcome: 'completed' | 'failed' | null = isOver
                  ? p.hits >= details.total_periods
                    ? 'completed'
                    : 'failed'
                  : null;
                return (
                  <View key={p.user_id} className="flex-row items-center py-2">
                    <Typography variant="body-14" color="secondary" className="w-6">
                      {index + 1}.
                    </Typography>
                    <Typography variant="subtitle-14-medium" color="primary" className="flex-1">
                      {p.user_id === currentUserId ? t('common.you') : p.display_name}
                    </Typography>
                    <Typography variant="body-12" color="primary" className="mr-2">
                      {p.hits}/{details.total_periods}
                    </Typography>
                    {outcome && (
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: outcome === 'completed' ? colors.success + '33' : colors.danger + '33',
                        }}
                      >
                        <Typography
                          variant="tiny-10"
                          style={{ color: OUTCOME_COLORS[outcome] }}
                        >
                          {outcome === 'completed' ? t('challenge.done') : t('challenge.failed')}
                        </Typography>
                      </View>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        {/* Delete/remove button: creator can always remove; either party can
            remove a finished (completed/failed) or cancelled challenge from
            their own list. */}
        {(isCreator || isCompleted || isFailed || isCancelled) && (
          <Pressable
            onPress={() => onDelete(challenge.id)}
            className="flex-row items-center justify-center mt-1 mb-4 py-3 rounded-xl bg-red-500/10 active:opacity-70"
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Typography variant="subtitle-14-medium" style={{ color: colors.danger }} className="ml-2">
              {t('grove.deleteChallengeTitle')}
            </Typography>
          </Pressable>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
