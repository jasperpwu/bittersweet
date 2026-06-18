import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { View, useColorScheme } from 'react-native';
import LottieView from 'lottie-react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography';
import { FocusSession } from '../../../types/models';
import { useFocus } from '../../../store';
import { useAppSettings } from '../../../store/unified-store';
import {
  calculateGoalProgress,
  calculateGoalStreak,
  getTargetForDate,
  getGoalPeriodRange,
  getSessionMinutesInPeriod,
} from '../../../utils/goalProgress';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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
const FLAME = '#FF9500'; // streak flame — iOS system orange, reads on the banner
const SCRIM = 'rgba(0, 0, 0, 0.6)'; // semi-opaque backdrop behind the goal-met celebration
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

    // Consecutive-completed-period streak (includes this just-completed period).
    // Only needed for the celebration, so skip the walk unless the goal was
    // actually reached by this session.
    const streak = reachedNow
      ? calculateGoalStreak(goal as any, safeSessions as any, restDays, weekStartDay)
      : 0;

    return { target, afterMinutes, beforePct, afterPct, reachedNow, streak, period: normalized };
  }, [goal, sessions, preferences.restDays, session]);

  const [visible, setVisible] = useState(true);
  const [celebrate, setCelebrate] = useState(false);
  // The streak number currently shown — starts at the previous streak and ticks
  // up to the new value so the user sees today's period get added.
  const [displayStreak, setDisplayStreak] = useState(0);
  const celebrationRef = useRef<LottieView>(null);

  const opacity = useSharedValue(0);
  const fill = useSharedValue(computed?.beforePct ?? 0);
  const streakScale = useSharedValue(0.7);
  const streakOpacity = useSharedValue(0);

  useEffect(() => {
    if (!computed) return;
    // Fade in, then animate the bar from `before` to `after`.
    opacity.value = withTiming(1, { duration: 250 });
    fill.value = withDelay(
      200,
      withTiming(computed.afterPct, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );

    // Pop confetti as the bar lands, only if the goal was just reached.
    const celebrateTimer = computed.reachedNow
      ? setTimeout(() => setCelebrate(true), 900)
      : undefined;

    // Streak reveal: the count fades in showing the *previous* streak, a short
    // ramping "drumroll" of haptics builds, then today's period ticks the number
    // up (+1) with a scale punch and a strong success tap.
    const streakTimers: ReturnType<typeof setTimeout>[] = [];
    if (computed.reachedNow && computed.streak > 0) {
      const finalStreak = computed.streak;
      const hasIncrement = finalStreak > 1;
      setDisplayStreak(hasIncrement ? finalStreak - 1 : finalStreak);

      const appearAt = 1100;
      streakTimers.push(
        setTimeout(() => {
          streakOpacity.value = withTiming(1, { duration: 220 });
          streakScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        }, appearAt),
      );

      // Ramping drumroll of light→medium taps leading into the increment.
      [0, 110, 220, 330].forEach((dt, idx) => {
        streakTimers.push(
          setTimeout(() => {
            Haptics.impactAsync(
              idx < 2 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
            ).catch(() => {});
          }, appearAt + 140 + dt),
        );
      });

      // The "+1 day" moment: tick the number up, punch the scale, strong haptic.
      streakTimers.push(
        setTimeout(() => {
          if (hasIncrement) setDisplayStreak(finalStreak);
          streakScale.value = withSequence(
            withSpring(1.28, { damping: 8, stiffness: 200 }),
            withSpring(1, { damping: 12, stiffness: 200 }),
          );
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }, appearAt + 560),
      );
    }

    // Auto-dismiss: fade out and unmount. For the celebration, hold the fully
    // settled final state (streak ticked up, goal-met animation finishes ≈4s
    // at speed 1.0) for ~1s before fading so the end state reads as a beat.
    const dismissDelay = computed.reachedNow && computed.streak > 0 ? 5000 : 4000;
    const fadeTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) runOnJS(setVisible)(false);
      });
    }, dismissDelay);

    return () => {
      if (celebrateTimer) clearTimeout(celebrateTimer);
      clearTimeout(fadeTimer);
      streakTimers.forEach(clearTimeout);
    };
    // Runs once — `computed` is stable for a given session/goal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));
  const streakStyle = useAnimatedStyle(() => ({
    opacity: streakOpacity.value,
    transform: [{ scale: streakScale.value }],
  }));

  if (!goal || !computed || !visible) return null;

  const tag = tags.byId[goal.tagId];
  const goalName = goal.customName || (tag ? `${tag.icon} ${tag.name}` : 'Goal');
  const reached = computed.afterMinutes >= computed.target;
  const palette = reached ? (isDark ? GREEN.dark : GREEN.light) : (isDark ? BLUE.dark : BLUE.light);
  const tipColor = reached ? TIP.green : TIP.blue;

  const showStreak = computed.reachedNow && computed.streak > 0;
  const periodNoun = computed.period === 'weekly' ? 'week' : computed.period === 'monthly' ? 'month' : 'day';

  // The session that *crosses* the target gets the full celebration: a dimmed
  // full-screen backdrop holding the banner, the goal-met animation, and the
  // streak. A plain progress update keeps the lightweight top banner.
  const celebrating = computed.reachedNow;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        celebrating
          ? {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingTop: 24,
              paddingHorizontal: 16,
              backgroundColor: SCRIM,
            }
          : {
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
      <View style={{ width: '100%' }}>
        {/* Goal-met banner: name + animated progress bar */}
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

        {/* Goal-met animation — a flow block between the banner and the streak,
            so the three stack vertically. `contain` keeps the full burst from
            being cropped within its box. */}
        {celebrate && (
          <LottieView
            ref={celebrationRef}
            source={celebrationSource}
            // Skip the first 0.3s (18 frames at 60fps). The clip spans frames
            // 262–466, so start at 280 instead of using `autoPlay`.
            onLayout={() => celebrationRef.current?.play(280, 466)}
            loop={false}
            speed={1.0}
            resizeMode="contain"
            style={{ width: '100%', height: 260, marginTop: 4 }}
          />
        )}

        {/* Consecutive-period streak — sits at the bottom of the stack. */}
        {showStreak && (
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                alignSelf: 'center',
                marginTop: 8,
              },
              streakStyle,
            ]}
          >
            <Ionicons name="flame" size={28} color={FLAME} />
            <Typography
              variant="headline-18"
              className="font-poppins-semibold ml-2"
              style={{ color: ON_BANNER }}
            >
              {displayStreak} {periodNoun} streak!
            </Typography>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
};
