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
  isSelfRated,
  normalizeActivityType,
  DEFAULT_ACTIVITY_TYPE,
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
  self_rated: 'ratingInsights.mappingSelfRated',
  stationary: 'ratingInsights.mappingStationary',
};

/** i18n key naming which signal produced the estimate (used in the disclaimer). */
const SIGNAL_KEY: Record<MotionSnapshot['signal'], string> = {
  activity: 'ratingInsights.signalActivity',
  none: 'ratingInsights.signalNone',
};

/**
 * Explains how the focus rating was arrived at.
 *
 * For motion-graded tags that means the on-device motion estimate; setting the
 * tag's activity type improves how motion is interpreted for future ratings.
 * For self-rated tags the motion sections are omitted entirely — motion played
 * no part, so showing a breakdown (often "no data", since we don't request
 * Motion access for these) would imply it did.
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
  const selfRated = isSelfRated(activityType);

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

  const motionOff = !!motionStatus && motionStatus !== 'granted';
  const noMotionData = !snapshot || snapshot.signal === 'none' || snapshot.profile === 'unknown';
  // Did movement actually produce this rating? Only then do the motion breakdown
  // and the "how motion maps to stars" line describe what really happened — on a
  // session with no data, "staying still earns more stars" describes a grading
  // that never ran, which reads as if it did.
  const motionGraded = !selfRated && !noMotionData;

  // One explanation, chosen for what actually happened to THIS session.
  const explanation = motionGraded
    ? t(MAPPING_KEY[normalizeActivityType(activityType) ?? DEFAULT_ACTIVITY_TYPE])
    : selfRated
      ? t('ratingInsights.mappingSelfRated')
      : motionOff
        ? t('ratingInsights.explainMotionOff')
        : t('ratingInsights.explainNoMotionData');

  // The follow-up tells the user the one thing that would change future ratings.
  // A self-rated tag with motion off needs BOTH changes, so it must not just say
  // "switch to Stationary/Active" — that alone still wouldn't produce a rating.
  const settingsAction = { label: t('ratingInsights.enableMotion'), onPress: Linking.openSettings };
  const editActivityTypeAction = onEditActivityType
    ? { label: t('ratingInsights.changeActivityType'), onPress: onEditActivityType }
    : null;
  const disclaimerBody = motionGraded
    ? t('ratingInsights.disclaimerActivityMismatch')
    : selfRated
      ? motionOff
        ? t('ratingInsights.disclaimerSelfRatedMotionOff')
        : t('ratingInsights.disclaimerSelfRated')
      : motionOff
        ? t('ratingInsights.disclaimerTurnOnMotion')
        : // Motion is on and simply had nothing for this window — nothing to fix.
          null;
  const disclaimerAction: { label: string; onPress: () => void } | null = motionGraded
    ? editActivityTypeAction
    : selfRated
      ? motionOff
        ? settingsAction
        : editActivityTypeAction
      : motionOff
        ? settingsAction
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
              {t(motionGraded ? 'ratingInsights.title' : 'ratingInsights.titleUserSet')}
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

          {/* What we observed + how it was read — shown only when movement
              actually produced the rating. */}
          {motionGraded && (
            <>
              <Typography variant="body-12" color="secondary" className="mb-1">
                {t('ratingInsights.phoneMoved')}
              </Typography>
              {breakdownLines().map((line, i) => (
                <Typography key={i} variant="subtitle-14-medium" color="primary" className="mb-0.5">
                  {line}
                </Typography>
              ))}
              <Typography variant="body-14" color="primary" className="mt-4">
                {t(describeMotionKey(snapshot ?? { signal: 'none', profile: 'unknown' }))}
              </Typography>
            </>
          )}
          <Typography
            variant={motionGraded ? 'body-12' : 'body-14'}
            color={motionGraded ? 'secondary' : 'primary'}
            className={motionGraded ? 'mt-2' : undefined}>
            {explanation}
          </Typography>

          {/* Reward impact */}
          <View className="mt-4 rounded-2xl bg-light-border/30 px-4 py-3 dark:bg-dark-card">
            <Typography variant="body-12" color="secondary">
              {rating != null
                ? t('ratingInsights.rewardImpact', { rating, pct: rewardPct })
                : t('ratingInsights.ratingNotSet')}
            </Typography>
          </View>

          {/* Follow-up — omitted entirely when there is nothing true left to say
              (motion is on and simply recorded nothing for this window). */}
          {(disclaimerBody || disclaimerAction) && (
            <View className="mt-4">
              {disclaimerBody && (
                <Typography variant="body-12" color="secondary" style={{ opacity: 0.7 }}>
                  {/* The "on-device estimate" preamble only applies when motion
                      actually produced the rating. */}
                  {motionGraded
                    ? `${t('ratingInsights.disclaimerBase', {
                        signal: t(SIGNAL_KEY[snapshot?.signal ?? 'none']),
                      })} ${disclaimerBody}`
                    : disclaimerBody}
                </Typography>
              )}
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
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
