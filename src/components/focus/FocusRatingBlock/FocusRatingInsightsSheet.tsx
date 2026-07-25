import { useEffect, useState } from 'react';
import { View, Modal, Pressable, Linking, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui';
import { colors } from '../../../config/theme';
import {
  getMotionPermissionStatus,
  type MotionPermissionStatus,
} from '../../../services/motionInsights';
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
  /** Opens the Edit Tag sheet for the session's tag; omit when there is no tag. */
  onEditActivityType?: () => void;
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
  onEditActivityType,
}: FocusRatingInsightsSheetProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const rewardPct = rating != null ? Math.round((RATING_FRUIT_MULTIPLIER[rating] ?? 1) * 100) : 100;

  // Read (never prompt) the Motion & Fitness permission while the sheet is open,
  // so the disclaimer can distinguish "motion is off" from "activity type wrong".
  const [motionStatus, setMotionStatus] = useState<MotionPermissionStatus | null>(null);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getMotionPermissionStatus().then((s) => {
      if (!cancelled) setMotionStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // The disclaimer targets whichever gap most limits rating accuracy, in order:
  //  1. Tag has no activity type    → ratings assume "stationary"; prompt to set it.
  //  2. Type set but motion is off  → ratings can't read movement; deep-link Settings.
  //  3. Both in place               → offer to fix a mis-set activity type.
  // While the async permission read is pending we fall through to (3), the benign
  // informational case, and switch to (2) only once we know motion is off.
  const disclaimerBody = !activityType
    ? t('ratingInsights.disclaimerNoActivityType')
    : motionStatus && motionStatus !== 'granted'
      ? t('ratingInsights.disclaimerMotionOff')
      : t('ratingInsights.disclaimerActivityMismatch');
  const disclaimerAction: { label: string; onPress: () => void } | null = !activityType
    ? onEditActivityType
      ? { label: t('ratingInsights.setActivityType'), onPress: onEditActivityType }
      : null
    : motionStatus && motionStatus !== 'granted'
      ? { label: t('ratingInsights.enableMotion'), onPress: () => Linking.openSettings() }
      : onEditActivityType
        ? { label: t('ratingInsights.changeActivityType'), onPress: onEditActivityType }
        : null;

  /** Human-readable breakdown of whichever signal was used. */
  const breakdownLines = (): string[] => {
    if (!snapshot || snapshot.signal === 'none') {
      return [t('ratingInsights.noMotionData')];
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

          {/* Disclaimer — conditional guidance + an action to close the gap */}
          <View className="mt-4">
            <Typography variant="body-12" color="secondary" style={{ opacity: 0.7 }}>
              {`${t('ratingInsights.disclaimerBase', {
                signal: t(SIGNAL_KEY[snapshot?.signal ?? 'none']),
              })} ${disclaimerBody}`}
            </Typography>
            {disclaimerAction && (
              <Pressable
                onPress={disclaimerAction.onPress}
                hitSlop={6}
                className="mt-2 active:opacity-60">
                <Typography variant="subtitle-14-medium" style={{ color: colors.primary }}>
                  {disclaimerAction.label}
                </Typography>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
