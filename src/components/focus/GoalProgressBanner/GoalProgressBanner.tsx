import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import LottieView from 'lottie-react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography';
import { FocusSession } from '../../../types/models';
import { useFocus } from '../../../store';
import { useAppSettings } from '../../../store/unified-store';
import {
  calculateGoalProgress,
  getTargetForDate,
  getGoalPeriodRange,
  getSessionMinutesInPeriod,
} from '../../../utils/goalProgress';

const celebrationSource = require('../../../../assets/goal.json');

// Banner palettes. Per CLAUDE.md we avoid raw inline hex; these are named
// constants chosen to read on both light/dark backgrounds. Green = goal hit,
// blue (theme primary) = in-progress.
const GREEN = {
  light: { bg: '#34C759', border: '#2BB350' }, // iOS system green
  dark: { bg: '#2BA84A', border: '#249B41' },
};
const BLUE = {
  light: { bg: '#6592E9', border: '#4F7FD6' }, // theme `primary`
  dark: { bg: '#4F7FD6', border: '#3B6BBF' }, // theme `primary-light`
};
const ON_BANNER = '#FFFFFF'; // text/fill color on the colored banner
const TRACK_ON_BANNER = 'rgba(255, 255, 255, 0.28)'; // unfilled bar

// Shiny tip at the leading edge of the white fill — fades from the white bar
// into a glow whose color reflects goal state: blue while in progress, green
// once reached. Colors reuse the banner palette.
const TIP = {
  blue: BLUE.light.bg, // '#6592E9'
  green: GREEN.light.bg, // '#34C759'
};
const TIP_WIDTH = 48; // px width of the gradient accent at the bar's leading edge
const BAR_HEIGHT = 14; // progress bar / track height

const formatTime = (minutes: number): string => {
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

interface GoalProgressBannerProps {
  session: FocusSession;
}

/**
 * Non-blocking, ~80%-transparent banner shown at the top of the session summary.
 * It animates the goal progress bar (for the session's primary tag) from its
 * value *before* this session up to the new value, and pops a Lottie confetti
 * burst over the bar if the session pushed the goal across its target. The
 * banner fades itself out after a few seconds. `pointerEvents="none"` keeps the
 * summary form underneath fully interactive.
 */
export const GoalProgressBanner: FC<GoalProgressBannerProps> = ({ session }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { sessions, tags, goals } = useFocus();
  const { preferences } = useAppSettings();
  const weekStartDay = 1; // Always Monday — matches GoalProgress

  // Active goal tied to the session's primary tag (goals are 1:1 with a tag).
  const goal = useMemo(() => {
    const all = goals.allIds.map((id) => goals.byId[id]).filter(Boolean);
    return all.find((g) => g.isActive && g.tagId === session.tagId) ?? null;
  }, [goals, session.tagId]);

  // Before/after progress for this period.
  const computed = useMemo(() => {
    if (!goal) return null;
    const restDays = preferences.restDays ?? [0, 6];
    const target = getTargetForDate(goal, new Date(), restDays);
    if (target <= 0) return null;

    // goalProgress utils type their params via store/types but read fields with
    // `as any`; the store's session/goal shapes (types/models) are compatible.
    const safeSessions = sessions.allIds.map((id) => sessions.byId[id]).filter(Boolean);
    const afterMinutes =
      calculateGoalProgress([goal as any], safeSessions as any, undefined, weekStartDay)[goal.id] ?? 0;

    const period = (goal.activePeriod ?? 'daily') as 'daily' | 'weekly' | 'monthly';
    const normalized = (period === ('yearly' as string) ? 'monthly' : period) as 'daily' | 'weekly' | 'monthly';
    const { periodStart, periodEnd } = getGoalPeriodRange(normalized, new Date(), weekStartDay);
    const sessionMinutes = getSessionMinutesInPeriod(session as any, periodStart, periodEnd);
    const beforeMinutes = Math.max(0, afterMinutes - sessionMinutes);

    const beforePct = Math.min((beforeMinutes / target) * 100, 100);
    const afterPct = Math.min((afterMinutes / target) * 100, 100);
    const reachedNow = beforeMinutes < target && afterMinutes >= target;

    return { target, afterMinutes, beforePct, afterPct, reachedNow };
  }, [goal, sessions, preferences.restDays, session]);

  const [visible, setVisible] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  const celebrationRef = useRef<LottieView>(null);

  const opacity = useSharedValue(0);
  const fill = useSharedValue(computed?.beforePct ?? 0);

  useEffect(() => {
    if (!computed) return;
    // Fade in, then animate the bar from `before` to `after`.
    opacity.value = withTiming(1, { duration: 300 });
    fill.value = withDelay(
      400,
      withTiming(computed.afterPct, { duration: 1200, easing: Easing.out(Easing.cubic) }),
    );

    // Pop confetti once the bar has filled, only if the goal was just reached.
    const celebrateTimer = computed.reachedNow
      ? setTimeout(() => setCelebrate(true), 1600)
      : undefined;

    // Auto-dismiss: fade out and unmount.
    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }, 4000);

    return () => {
      if (celebrateTimer) clearTimeout(celebrateTimer);
      clearTimeout(fadeTimer);
    };
    // Runs once — `computed` is stable for a given session/goal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  if (!goal || !computed || !visible) return null;

  const tag = tags.byId[goal.tagId];
  const goalName = goal.customName || (tag ? `${tag.icon} ${tag.name}` : 'Goal');
  const reached = computed.afterMinutes >= computed.target;
  const palette = reached ? (isDark ? GREEN.dark : GREEN.light) : (isDark ? BLUE.dark : BLUE.light);
  const tipColor = reached ? TIP.green : TIP.blue;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          paddingTop: 56,
          paddingHorizontal: 16,
        },
        containerStyle,
      ]}
    >
      <View
        style={{
          backgroundColor: palette.bg,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: palette.border,
          paddingHorizontal: 20,
          paddingVertical: 18,
          overflow: 'hidden',
          // Lift it off the page so it reads as a distinct banner
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Typography
            variant="subtitle-16"
            numberOfLines={1}
            className="font-poppins-semibold"
            style={{ color: ON_BANNER, flexShrink: 1, marginRight: 8 }}
          >
            {goalName}
          </Typography>
          <Typography variant="subtitle-14-medium" style={{ color: ON_BANNER }}>
            {reached ? 'Goal reached! 🎉' : `${formatTime(computed.afterMinutes)} / ${formatTime(computed.target)}`}
          </Typography>
        </View>

        {/* Progress bar */}
        <View
          style={{
            height: BAR_HEIGHT,
            borderRadius: 999,
            backgroundColor: TRACK_ON_BANNER,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={[{ height: '100%', borderRadius: 999, backgroundColor: ON_BANNER }, fillStyle]}
          >
            {/* Shiny tip riding the leading edge of the fill. Blue while the
                goal is still in progress, green once it's reached. */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: TIP_WIDTH,
                shadowColor: tipColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.9,
                shadowRadius: 4,
              }}
            >
              <Svg width={TIP_WIDTH} height={BAR_HEIGHT}>
                <Defs>
                  <SvgGradient id="barTip" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={ON_BANNER} stopOpacity={0} />
                    <Stop offset="1" stopColor={tipColor} stopOpacity={1} />
                  </SvgGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#barTip)" />
              </Svg>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Goal-hit celebration over the bar. This is a large animation, so we
          use `contain` and let it overflow the banner bounds (the parent View
          has no `overflow: hidden`) so it's never cropped. */}
      {celebrate && (
        <LottieView
          ref={celebrationRef}
          source={celebrationSource}
          // Skip the first 0.3s (18 frames at 60fps). The clip spans frames
          // 262–466, so start at 280 instead of using `autoPlay`.
          onLayout={() => celebrationRef.current?.play(280, 466)}
          loop={false}
          speed={1.5}
          resizeMode="contain"
          style={{ position: 'absolute', top: -10, left: -40, right: -40, height: 360 }}
        />
      )}
    </Animated.View>
  );
};
