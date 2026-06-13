import React, { FC, ReactNode, useEffect } from 'react';
import { View, useColorScheme } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularTimerProps {
  /** Fraction of the session completed, 0..1. Ignored when `indeterminate`. */
  progress?: number;
  size?: number;
  strokeWidth?: number;
  /** Continuous rotating arc for infinite (∞) sessions with no fixed target. */
  indeterminate?: boolean;
  /** Session has finished its target and is now in bonus time — ring turns full gold. */
  isBonus?: boolean;
  /** Optional content rendered centered inside the ring (e.g. the countdown text). */
  children?: ReactNode;
}

// The ring "ripens" as focus accrues: a young green sprout fills toward golden,
// ready-to-harvest fruit — tying the timer to the app's grow-and-harvest metaphor.
const RIPENING = { from: '#51BC6F', to: '#F5A623' }; // success green → warm gold
const BONUS = { from: '#F5A623', to: '#FFD700' }; // amber → bright gold glow

export const CircularTimer: FC<CircularTimerProps> = ({
  progress = 0,
  size = 300,
  strokeWidth = 12,
  indeterminate = false,
  isBonus = false,
  children,
}) => {
  const colorScheme = useColorScheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const trackColor =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(93,78,55,0.12)';
  const gradient = isBonus ? BONUS : RIPENING;

  // Smoothly sweep between the once-per-second progress updates so the ring
  // glides rather than ticking in visible steps.
  const animatedProgress = useSharedValue(progress);
  const spin = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(Math.min(1, Math.max(0, progress)), {
      duration: 950,
      easing: Easing.linear,
    });
  }, [progress]);

  useEffect(() => {
    if (indeterminate) {
      spin.value = 0;
      spin.value = withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      spin.value = 0;
    }
  }, [indeterminate]);

  // Indeterminate sessions show a fixed quarter arc; determinate ones fill to progress.
  const dashRatio = useDerivedValue(() =>
    indeterminate ? 0.25 : animatedProgress.value,
  );

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - dashRatio.value),
  }));

  // Start the arc at 12 o'clock; rotate continuously when indeterminate.
  const animatedRotation = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + spin.value * 360}deg` }],
  }));

  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Animated.View style={[{ width: size, height: size }, animatedRotation]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="ripeningRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradient.from} />
              <Stop offset="100%" stopColor={gradient.to} />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ripeningRing)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            animatedProps={animatedCircleProps}
          />
        </Svg>
      </Animated.View>

      {children != null && (
        <View
          style={{ position: 'absolute', width: size, height: size }}
          className="items-center justify-center"
          pointerEvents="none"
        >
          {children}
        </View>
      )}
    </View>
  );
};
