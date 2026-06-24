import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheet } from '../../ui/BottomSheet';
import { Typography } from '../../ui/Typography';
import { Badge } from '../../../store/types';
import { useTranslation } from 'react-i18next';

interface BadgeSummarySheetProps {
  badge?: Badge;
  isVisible: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const BadgeSummarySheet: FC<BadgeSummarySheetProps> = ({
  badge,
  isVisible,
  onClose,
  onDelete,
}) => {
  const { t } = useTranslation();
  if (!badge) return null;

  const totalHours = Math.floor(badge.totalMinutes / 60);
  const totalMins = badge.totalMinutes % 60;

  const formatPeriodStats = (stats: { longestStreak: number; periodsGoalMet: number; totalPeriods: number } | undefined, heading: string) => {
    if (!stats) return null;
    const hitRate = stats.totalPeriods > 0 ? Math.round((stats.periodsGoalMet / stats.totalPeriods) * 100) : 0;
    return (
      <View className="bg-light-border dark:bg-dark-border rounded-xl p-4 mb-3">
        <Typography variant="subtitle-16" color="primary" className="mb-2">
          {heading}
        </Typography>
        <View className="flex-row justify-between">
          <View className="items-center flex-1">
            <Typography variant="headline-20" color="primary">
              {stats.longestStreak}
            </Typography>
            <Typography variant="tiny-10" color="secondary">
              {t('badge.bestStreak')}
            </Typography>
          </View>
          <View className="items-center flex-1">
            <Typography variant="headline-20" color="primary">
              {stats.periodsGoalMet}/{stats.totalPeriods}
            </Typography>
            <Typography variant="tiny-10" color="secondary">
              {t('badge.goalsMet')}
            </Typography>
          </View>
          <View className="items-center flex-1">
            <Typography variant="headline-20" color="primary">
              {hitRate}%
            </Typography>
            <Typography variant="tiny-10" color="secondary">
              {t('badge.hitRate')}
            </Typography>
          </View>
        </View>
      </View>
    );
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center flex-1">
            <View className="flex-1">
              <Typography variant="headline-20" color="primary" numberOfLines={1}>
                {badge.goalName}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {badge.startDate} — {badge.endDate}
              </Typography>
            </View>
          </View>
          <Pressable onPress={onClose} className="p-2 active:opacity-70">
            <Typography variant="headline-18" color="secondary">
              ✕
            </Typography>
          </Pressable>
        </View>

        {/* Overview */}
        <View className="bg-light-border dark:bg-dark-border rounded-xl p-4 mb-3">
          <Typography variant="subtitle-16" color="primary" className="mb-2">
            {t('badge.overview')}
          </Typography>
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Typography variant="headline-20" color="primary">
                {totalHours}h {totalMins}m
              </Typography>
              <Typography variant="tiny-10" color="secondary">
                {t('badge.totalTime')}
              </Typography>
            </View>
            <View className="items-center flex-1">
              <Typography variant="headline-20" color="primary">
                {badge.totalSessions}
              </Typography>
              <Typography variant="tiny-10" color="secondary">
                {t('badge.sessions')}
              </Typography>
            </View>
          </View>
        </View>

        {/* Period Stats */}
        {formatPeriodStats(badge.dailyStats, t('badge.consistencyDaily'))}
        {formatPeriodStats(badge.weeklyStats, t('badge.consistencyWeekly'))}
        {formatPeriodStats(badge.monthlyStats, t('badge.consistencyMonthly'))}

        {/* Patterns */}
        <View className="bg-light-border dark:bg-dark-border rounded-xl p-4 mb-3">
          <Typography variant="subtitle-16" color="primary" className="mb-2">
            {t('badge.patterns')}
          </Typography>
          <View className="gap-y-2">
            <View className="flex-row justify-between">
              <Typography variant="body-12" color="secondary">{t('badge.avgSession')}</Typography>
              <Typography variant="body-12" color="primary">
                {badge.durationDistribution.avgMinutesPerSession}m
              </Typography>
            </View>
            <View className="flex-row justify-between">
              <Typography variant="body-12" color="secondary">{t('badge.shortest')}</Typography>
              <Typography variant="body-12" color="primary">
                {badge.durationDistribution.shortestSession}m
              </Typography>
            </View>
            <View className="flex-row justify-between">
              <Typography variant="body-12" color="secondary">{t('badge.longest')}</Typography>
              <Typography variant="body-12" color="primary">
                {badge.durationDistribution.longestSession}m
              </Typography>
            </View>
            {badge.durationDistribution.peakDay && (
              <View className="flex-row justify-between">
                <Typography variant="body-12" color="secondary">{t('badge.peakDay')}</Typography>
                <Typography variant="body-12" color="primary">
                  {badge.durationDistribution.peakDay}
                </Typography>
              </View>
            )}
            <View className="flex-row justify-between">
              <Typography variant="body-12" color="secondary">{t('badge.peakHour')}</Typography>
              <Typography variant="body-12" color="primary">
                {badge.durationDistribution.peakHour}:00
              </Typography>
            </View>
          </View>
        </View>

        {/* Notes */}
        {badge.notesCount > 0 && (
          <View className="bg-light-border dark:bg-dark-border rounded-xl p-4 mb-3">
            <Typography variant="subtitle-16" color="primary" className="mb-2">
              {t('badge.notes', { count: badge.notesCount })}
            </Typography>
            {badge.recentNotes.map((note, i) => (
              <Typography key={i} variant="body-12" color="secondary" className="mb-1" numberOfLines={2}>
                {note}
              </Typography>
            ))}
          </View>
        )}

        {/* Delete button */}
        <Pressable
          onPress={onDelete}
          className="bg-red-500/10 border border-red-500/30 rounded-xl py-3 items-center mt-2 mb-4 active:opacity-70"
        >
          <Typography variant="body-14" className="text-red-500">
            {t('badge.deleteButton')}
          </Typography>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
};
