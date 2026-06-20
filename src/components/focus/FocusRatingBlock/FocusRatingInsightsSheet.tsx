import { View, Modal, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../ui';
import { colors } from '../../../config/theme';
import {
  describeMotion,
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

/** One-line description of how motion maps to stars for this activity type. */
function mappingLine(activityType?: ActivityType): string {
  switch (activityType ?? 'stationary') {
    case 'active':
      return 'This is an active tag, so more movement earns more stars.';
    case 'on_phone':
      return 'This is an on-phone tag, so movement barely affects the rating.';
    case 'stationary':
    default:
      return 'This is a stationary tag, so staying still earns more stars.';
  }
}

/** Human-readable breakdown of whichever signal was used. */
function breakdownLines(snapshot: MotionSnapshot | null): string[] {
  if (!snapshot || snapshot.signal === 'none') {
    return ['No motion data was available for this session.'];
  }
  if (snapshot.signal === 'recorder' && snapshot.recorder) {
    const r = snapshot.recorder;
    return [
      `Phone in motion ${Math.round(r.activeFraction * 100)}% of the time`,
      `${r.handlingEvents} movement ${r.handlingEvents === 1 ? 'burst' : 'bursts'} detected`,
    ];
  }
  if (snapshot.signal === 'activity' && snapshot.activity) {
    const a = snapshot.activity;
    const lines = [
      `Stationary ${pct(a.stationarySec, a.totalSec)}% · Walking ${pct(a.walkingSec, a.totalSec)}% · Running ${pct(a.runningSec, a.totalSec)}%`,
    ];
    if (snapshot.steps != null) lines.push(`${snapshot.steps} steps`);
    return lines;
  }
  return ['Motion estimate unavailable.'];
}

const signalLabel: Record<MotionSnapshot['signal'], string> = {
  recorder: 'raw accelerometer',
  activity: 'motion activity',
  none: 'no signal',
};

/**
 * Explains how the suggested focus rating was estimated from on-device motion,
 * and that it can be overridden by tapping the stars.
 */
export function FocusRatingInsightsSheet({
  visible,
  onClose,
  snapshot,
  activityType,
  rating,
}: FocusRatingInsightsSheetProps) {
  const colorScheme = useColorScheme();
  const rewardPct = rating != null ? Math.round((RATING_FRUIT_MULTIPLIER[rating] ?? 1) * 100) : 100;

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
              How we estimated this
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
            How your phone moved
          </Typography>
          {breakdownLines(snapshot).map((line, i) => (
            <Typography key={i} variant="subtitle-14-medium" color="primary" className="mb-0.5">
              {line}
            </Typography>
          ))}

          {/* Interpretation */}
          <Typography variant="body-14" color="primary" className="mt-4">
            {describeMotion(snapshot ?? { signal: 'none', profile: 'unknown' })}
          </Typography>
          <Typography variant="body-12" color="secondary" className="mt-2">
            {mappingLine(activityType)}
          </Typography>

          {/* Reward impact */}
          <View className="mt-4 rounded-2xl bg-light-border/30 px-4 py-3 dark:bg-gray-700">
            <Typography variant="body-12" color="secondary">
              {rating != null
                ? `${rating}★ → ${rewardPct}% of this session's fruits`
                : 'Rating not set'}
            </Typography>
          </View>

          {/* Disclaimer */}
          <Typography variant="body-12" color="secondary" className="mt-4" style={{ opacity: 0.7 }}>
            On-device estimate from {signalLabel[snapshot?.signal ?? 'none']}. Tap the stars to
            adjust if needed.
          </Typography>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
