import { View, Modal, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui';
import { colors } from '../../../config/theme';
import {
  describeMotionKey,
  RATING_FRUIT_MULTIPLIER,
  type MotionSnapshot,
  type ActivityType,
} from '../../../utils/focusRating';

interface FocusRatingInsightsSheetProps {
  visible: boolean;
  onClose: () => void;
  snapshot: MotionSnapshot | null;
  activityType?: ActivityType;
  rating: number | null;
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** i18n key describing how motion maps to stars for this activity type. */
const MAPPING_KEY: Record<ActivityType, string> = {
  active: 'ratingInsights.mappingActive',
  on_phone: 'ratingInsights.mappingOnPhone',
  stationary: 'ratingInsights.mappingStationary',
};

/** i18n key naming which signal produced the estimate (used in the disclaimer). */
const SIGNAL_KEY: Record<MotionSnapshot['signal'], string> = {
  recorder: 'ratingInsights.signalRecorder',
  activity: 'ratingInsights.signalActivity',
  none: 'ratingInsights.signalNone',
};

/**
 * Explains how the suggested focus rating was estimated from on-device motion.
 * The rating itself is fixed; setting the tag's activity type improves how
 * motion is interpreted for future ratings.
 */
export function FocusRatingInsightsSheet({
  visible,
  onClose,
  snapshot,
  activityType,
  rating,
}: FocusRatingInsightsSheetProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const rewardPct = rating != null ? Math.round((RATING_FRUIT_MULTIPLIER[rating] ?? 1) * 100) : 100;

  /** Human-readable breakdown of whichever signal was used. */
  const breakdownLines = (): string[] => {
    if (!snapshot || snapshot.signal === 'none') {
      return [t('ratingInsights.noMotionData')];
    }
    if (snapshot.signal === 'recorder' && snapshot.recorder) {
      const r = snapshot.recorder;
      return [
        t('ratingInsights.inMotionPct', { pct: Math.round(r.activeFraction * 100) }),
        t('ratingInsights.movementBursts', { count: r.handlingEvents }),
      ];
    }
    if (snapshot.signal === 'activity' && snapshot.activity) {
      const a = snapshot.activity;
      const lines = [
        t('ratingInsights.activityBreakdown', {
          stationary: pct(a.stationarySec, a.totalSec),
          walking: pct(a.walkingSec, a.totalSec),
          running: pct(a.runningSec, a.totalSec),
        }),
      ];
      if (snapshot.steps != null) lines.push(t('ratingInsights.steps', { count: snapshot.steps }));
      return lines;
    }
    return [t('ratingInsights.estimateUnavailable')];
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-light-bg px-6 pb-10 pt-5 dark:bg-dark-bg"
          onPress={(e) => e.stopPropagation()}>
          <View className="mb-4 flex-row items-center justify-between">
            <Typography variant="headline-20" color="primary">
              {t('ratingInsights.title')}
            </Typography>
            <Pressable onPress={onClose} hitSlop={8} className="active:opacity-70">
              <Ionicons
                name="close"
                size={22}
                color={
                  colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.textSecondary
                }
              />
            </Pressable>
          </View>

          {/* What we observed */}
          <Typography variant="body-12" color="secondary" className="mb-1">
            {t('ratingInsights.phoneMoved')}
          </Typography>
          {breakdownLines().map((line, i) => (
            <Typography key={i} variant="subtitle-14-medium" color="primary" className="mb-0.5">
              {line}
            </Typography>
          ))}

          {/* Interpretation */}
          <Typography variant="body-14" color="primary" className="mt-4">
            {t(describeMotionKey(snapshot ?? { signal: 'none', profile: 'unknown' }))}
          </Typography>
          <Typography variant="body-12" color="secondary" className="mt-2">
            {t(MAPPING_KEY[activityType ?? 'stationary'])}
          </Typography>

          {/* Reward impact */}
          <View className="mt-4 rounded-2xl bg-light-border/30 px-4 py-3 dark:bg-dark-card">
            <Typography variant="body-12" color="secondary">
              {rating != null
                ? t('ratingInsights.rewardImpact', { rating, pct: rewardPct })
                : t('ratingInsights.ratingNotSet')}
            </Typography>
          </View>

          {/* Disclaimer */}
          <Typography variant="body-12" color="secondary" className="mt-4" style={{ opacity: 0.7 }}>
            {t('ratingInsights.disclaimer', { signal: t(SIGNAL_KEY[snapshot?.signal ?? 'none']) })}
          </Typography>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
