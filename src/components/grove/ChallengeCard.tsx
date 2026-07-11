import React from 'react';
import { View, Pressable } from 'react-native';
import { colors } from '../../config/theme';
import { Typography } from '../ui/Typography';
import type { ChallengeItem, ChallengeParticipant } from '../../services/grove/GroveChallengeService';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';

interface ChallengeCardProps {
  challenge: ChallengeItem;
  currentUserId: string;
  onPress?: () => void;
}

function formatStartDate(startDate: string | null): { label: string; dateStr: string } | null {
  if (!startDate) return null;
  const date = new Date(startDate + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = date.toLocaleString(i18n.language, { month: 'short' });
  const day = date.getDate();
  const dateStr = date.getFullYear() !== now.getFullYear()
    ? `${month} ${day}, ${date.getFullYear()}`
    : `${month} ${day}`;
  const label = date < today ? i18n.t('challenge.startedOn') : i18n.t('challenge.startOn');
  return { label, dateStr };
}

function daysRemaining(endDate: string | null): number {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export { formatStartDate };

export function formatTarget(targetMinutes: number, period: 'daily' | 'weekly'): string {
  const hours = targetMinutes / 60;
  let value: string;
  if (hours < 1) value = `${targetMinutes}min`;
  else if (hours === Math.floor(hours)) value = `${hours}h`;
  else value = `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}min`;
  return period === 'daily'
    ? i18n.t('challenge.targetDaily', { value })
    : i18n.t('challenge.targetWeekly', { value });
}

const BAR_COLORS = ['#6592E9', '#E9A065', '#8B5CF6'];

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, currentUserId, onPress }) => {
  const { t } = useTranslation();
  const remaining = daysRemaining(challenge.endDate);
  const isCompleted = challenge.status === 'completed';
  const isFailed = challenge.status === 'failed';
  const isCancelled = challenge.status === 'cancelled';

  const targetLabel = formatTarget(challenge.targetMinutes, challenge.period);
  const periodUnit = challenge.period === 'daily' ? t('challenge.daysUnit') : t('challenge.weeksUnit');
  const totalPeriods = challenge.totalPeriods;

  // Sort accepted participants: current user first, then by hits descending
  const acceptedParticipants = challenge.participants
    .filter(p => p.status === 'accepted')
    .sort((a, b) => {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
      return b.hits - a.hits;
    });

  // Show current user + top 2 others
  const myParticipant = acceptedParticipants.find(p => p.userId === currentUserId);
  const others = acceptedParticipants.filter(p => p.userId !== currentUserId);
  const displayedOthers = others.slice(0, 2);
  const remainingCount = others.length - displayedOthers.length;

  const renderBar = (participant: ChallengeParticipant, color: string, isMe: boolean) => (
    <View className={isMe ? 'mb-2' : 'mb-2'} key={participant.userId}>
      <View className="flex-row items-center justify-between mb-1">
        <Typography variant="body-12" color="secondary" numberOfLines={1} className="flex-1 mr-2">
          {isMe ? t('common.you') : participant.profile.display_name}
        </Typography>
        <Typography variant="body-12" color="primary">
          {t('challenge.progress', { hits: participant.hits, total: totalPeriods, unit: periodUnit })}
        </Typography>
      </View>
      <View className="h-2 bg-light-border/50 dark:bg-dark-card rounded-full">
        <View
          className="h-2 rounded-full"
          style={{
            width: `${totalPeriods > 0 ? Math.min((participant.hits / totalPeriods) * 100, 100) : 0}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );

  const Wrapper = onPress ? Pressable : View;
  const wrapperProps = onPress ? { onPress, className: 'active:opacity-80' } : {};

  return (
    <Wrapper {...(wrapperProps as any)}>
    <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl p-4 w-[260px]">
      {/* Tag + Status */}
      <View className="flex-row items-center mb-3">
        <Typography variant="body-14" className="mr-1.5">
          {challenge.tagIcon}
        </Typography>
        <Typography variant="subtitle-14-medium" color="primary" className="flex-1" numberOfLines={1}>
          {challenge.tagName}
        </Typography>
        {isCompleted && (
          <View className="bg-green-500/20 rounded-full px-2 py-0.5">
            <Typography variant="body-12" style={{ color: colors.success }}>
              {t('challenge.done')}
            </Typography>
          </View>
        )}
        {isFailed && (
          <View className="bg-red-500/20 rounded-full px-2 py-0.5">
            <Typography variant="body-12" style={{ color: colors.danger }}>
              {t('challenge.failed')}
            </Typography>
          </View>
        )}
        {isCancelled && (
          <View className="bg-yellow-500/20 rounded-full px-2 py-0.5">
            <Typography variant="body-12" style={{ color: colors.warning }}>
              {t('challenge.cancelled')}
            </Typography>
          </View>
        )}
      </View>

      {/* Start date + days left */}
      <View className="flex-row items-center justify-between mb-3">
        {(() => {
          const start = formatStartDate(challenge.startDate);
          return start ? (
            <Typography variant="body-12" color="secondary">
              {start.label}: {start.dateStr}
            </Typography>
          ) : <View />;
        })()}
        {challenge.status === 'active' && challenge.hasStarted && remaining > 0 && (
          <Typography variant="body-12" color="secondary">
            {t('challenge.daysLeft', { count: remaining })}
          </Typography>
        )}
        {challenge.status === 'active' && challenge.hasStarted && !challenge.endDate && (
          <Typography variant="body-12" color="secondary">
            {t('challenge.ongoing')}
          </Typography>
        )}
      </View>

      {/* Participant progress bars */}
      <View className="mb-1">
        {myParticipant && renderBar(myParticipant, BAR_COLORS[0], true)}
        {displayedOthers.map((p, i) => renderBar(p, BAR_COLORS[i + 1] || BAR_COLORS[1], false))}
      </View>

      {remainingCount > 0 && (
        <Typography variant="body-12" color="secondary" className="mb-2">
          {t('challenge.andMore', { count: remainingCount })}
        </Typography>
      )}

      {/* Footer */}
      <View className="flex-row items-center justify-between">
        <View className="bg-primary/10 rounded-lg px-2 py-1">
          <Typography variant="body-12" style={{ color: colors.primary }}>
            {targetLabel}
          </Typography>
        </View>
        <Typography variant="body-12" color="secondary">
          {t('challenge.fruitsReward', { count: challenge.fruitReward })}
        </Typography>
      </View>
    </View>
    </Wrapper>
  );
};
