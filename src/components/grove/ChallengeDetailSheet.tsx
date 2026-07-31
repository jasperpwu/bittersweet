import React, { useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { showToast } from '../ui/Toast';
import { UserGrid } from './ChallengeDetailGrid';
import { formatTarget, formatStartDate } from './ChallengeCard';
import { useAppStore } from '../../store';
import { useChallengeReward } from '../../hooks/useChallengeReward';
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
  const claimChallengeReward = useAppStore((s) => s.grove.claimChallengeReward);

  const [details, setDetails] = useState<ChallengePeriodDetailsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const reward = useChallengeReward(challenge);

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

  const handleClaim = async () => {
    if (!challenge || claiming) return;
    setClaiming(true);
    try {
      const { claimed, fruitReward } = await claimChallengeReward(challenge.id);
      if (claimed) showToast(t('challenge.rewardClaimedToast', { count: fruitReward }), 'success');
    } catch {
      showToast(t('gm.errClaimReward'), 'error');
    } finally {
      setClaiming(false);
    }
  };

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

  const myParticipant =
    challenge.myParticipant ?? challenge.participants.find((p) => p.userId === currentUserId) ?? null;
  const claimed = !!myParticipant?.rewardClaimedAt;
  const claimedAmount = myParticipant?.rewardAmount ?? null;

  // Periods the user still has to hit for the pooled perfect-run bonus. Personal,
  // not group-wide — hence myHits/myTotalPeriods rather than hits/totalPeriods.
  const perfectPeriodsToGo = reward ? Math.max(0, reward.myTotalPeriods - reward.myHits) : 0;
  const periodUnit = challenge.period === 'daily' ? t('challenge.daysUnit') : t('challenge.weeksUnit');

  // Find current user's period data
  const myPeriodData = details?.participants.find((p) => p.user_id === currentUserId);

  return (
    // `scrollable` (rather than a nested ScrollView) so a downward pull while the
    // content is at its top drags the sheet down to dismiss, matching the TODO /
    // tag-picker sheets. A nested ScrollView would swallow that gesture.
    <BottomSheet isVisible={isVisible} onClose={onClose} height={screenHeight * 0.75} scrollable>
      <>
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

        {/* Target + reward mode */}
        <View className="flex-row items-center gap-2 mb-4">
          <View className="rounded-lg px-2 py-1" style={{ backgroundColor: `${colors.challenge}1A` }}>
            <Typography variant="body-12" style={{ color: colors.challenge }}>
              {targetLabel}
            </Typography>
          </View>
          <View className="rounded-lg px-2 py-1" style={{ backgroundColor: `${colors.challenge}1A` }}>
            <Typography variant="body-12" style={{ color: colors.challenge }}>
              {challenge.rewardMode === 'pooled'
                ? t('challenge.rewardModePooled')
                : t('challenge.rewardModeIsolated')}
            </Typography>
          </View>
        </View>

        {/* Reward breakdown. Not shown for a cancelled challenge — nobody ever
            focused against it, so there is nothing to double. */}
        {!isCancelled && reward && (
          <View className="bg-light-border/30 dark:bg-dark-card rounded-xl p-4 mb-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-1">
              {isOver ? t('challenge.rewardTitleFinal') : t('challenge.rewardTitleProjected')}
            </Typography>
            <Typography variant="body-12" color="secondary" className="mb-3">
              {challenge.rewardMode === 'pooled'
                ? t('challenge.rewardModePooledDesc')
                : t('challenge.rewardModeIsolatedDesc')}
            </Typography>

            <View className="flex-row items-center justify-between py-1">
              <Typography variant="body-12" color="secondary" className="flex-1 mr-2">
                {t('challenge.rewardBase', { tag: challenge.tagName })}
              </Typography>
              <Typography variant="body-12" color="primary">
                {t('challenge.fruitsCount', { count: reward.baseFruits })}
              </Typography>
            </View>

            <View className="flex-row items-center justify-between py-1">
              <Typography variant="body-12" color="secondary" className="flex-1 mr-2">
                {challenge.rewardMode === 'pooled'
                  ? t('challenge.rewardGroupCompletion')
                  : t('challenge.rewardMyCompletion')}
              </Typography>
              <Typography variant="body-12" color="primary">
                {reward.hits}/{reward.totalPeriods} ({Math.round(reward.ratio * 100)}%)
              </Typography>
            </View>

            <View className="flex-row items-center justify-between py-1">
              <Typography variant="body-12" color="secondary" className="flex-1 mr-2">
                {t('challenge.rewardMultiplier')}
              </Typography>
              <Typography variant="body-12" color="primary">
                ×{reward.multiplier.toFixed(2)}
                {reward.isFull ? ` · ${t('challenge.rewardFullDouble')}` : ''}
              </Typography>
            </View>

            {/* Pooled only. Shown for the WHOLE challenge, not just once earned —
                a bonus that only appears after you've secured it can't motivate
                the run it's meant to drive. Dimmed while still in reach (with the
                periods left to go), highlighted once banked, struck to a dash if
                the challenge ended without it. Kept as its own line rather than
                folded into the multiplier, so the shared multiplier above stays
                one number every participant can compare. */}
            {challenge.rewardMode === 'pooled' && (
              <View className="flex-row items-center justify-between py-1">
                <Typography
                  variant="body-12"
                  color={reward.earnedPerfectBonus ? undefined : 'secondary'}
                  className="flex-1 mr-2"
                  style={reward.earnedPerfectBonus ? { color: colors.challenge } : undefined}
                >
                  {t('challenge.rewardPerfectBonus')}
                  {!reward.earnedPerfectBonus && !isOver && perfectPeriodsToGo > 0
                    ? ` · ${t('challenge.rewardPerfectBonusToGo', {
                        count: perfectPeriodsToGo,
                        unit: periodUnit,
                      })}`
                    : ''}
                </Typography>
                <Typography
                  variant="body-12"
                  color={reward.earnedPerfectBonus ? undefined : 'secondary'}
                  style={reward.earnedPerfectBonus ? { color: colors.challenge } : undefined}
                >
                  {reward.earnedPerfectBonus
                    ? t('challenge.fruitsReward', { count: reward.perfectBonus })
                    : isOver
                      ? t('challenge.rewardPerfectBonusMissed')
                      : t('challenge.fruitsReward', { count: reward.potentialPerfectBonus })}
                </Typography>
              </View>
            )}

            <View className="h-px bg-light-border dark:bg-dark-border my-2" />

            <View className="flex-row items-center justify-between">
              <Typography variant="subtitle-14-medium" color="primary" className="flex-1 mr-2">
                {claimed
                  ? t('challenge.rewardClaimedLabel')
                  : isOver
                    ? t('challenge.rewardClaimable')
                    : t('challenge.rewardIfEndedNow')}
              </Typography>
              <Typography variant="subtitle-14-medium" style={{ color: colors.challenge }}>
                {t('challenge.fruitsReward', { count: claimedAmount ?? reward.reward })}
              </Typography>
            </View>

            {/* Partial runs are claimable too, so the CTA is gated on a non-zero
                payout rather than on winning. */}
            {isOver && !claimed && reward.reward > 0 && (
              <Pressable
                onPress={handleClaim}
                disabled={claiming}
                className={`mt-3 py-3 rounded-xl items-center justify-center active:opacity-80 ${claiming ? 'opacity-50' : ''}`}
                style={{ backgroundColor: colors.challenge }}
              >
                <Typography variant="subtitle-14-medium" style={{ color: colors.white }}>
                  {claiming ? t('gm.notifClaiming') : t('challenge.rewardClaimCta')}
                </Typography>
              </Pressable>
            )}

            {isOver && claimed && (
              <View className="mt-3 flex-row items-center justify-center">
                <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                <Typography variant="body-12" className="ml-1" style={{ color: colors.success }}>
                  {t('gm.notifClaimed')}
                </Typography>
              </View>
            )}
          </View>
        )}

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
      </>
    </BottomSheet>
  );
};
