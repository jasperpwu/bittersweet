import React, { FC } from 'react';
import {
  Pressable,
  PressableProps,
  ActivityIndicator,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../Typography';
import { TypographyVariant } from '../../../config/fonts';
import { colors } from '../../../config/theme';

// Animate the Pressable itself (rather than an outer wrapper View) so that
// layout classes the caller passes — `flex-1`, `w-full`, margins — land on the
// actual flex child and stretch correctly inside rows/columns.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'soft' | 'ghost' | 'destructive';
export type ButtonSize = 'small' | 'medium' | 'large';

type TypographyColor = 'primary' | 'secondary' | 'error' | 'success' | 'white';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to fill the parent's cross axis. */
  fullWidth?: boolean;
  /** Show a spinner and block presses. Implies `disabled` for interaction. */
  loading?: boolean;
  disabled?: boolean;
  /** Fire a light selection haptic on press. Off by default. */
  haptic?: boolean;
  /** Scale-down press animation. On by default; disable for row-like controls. */
  pressScale?: boolean;
  /** Override the auto text color used when `children` is a plain string. */
  textColor?: TypographyColor;
  /** Override the Typography variant used when `children` is a plain string. */
  textVariant?: TypographyVariant;
  className?: string;
  /** Extra style merged after the press-scale transform (object form only). */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

const SPRING_CONFIG = { damping: 15, stiffness: 150 };

// Layout/shape defaults per size. Callers can override any of these via `className`
// (appended last), so icon buttons, pills, and custom paddings still work.
const sizeClasses: Record<ButtonSize, string> = {
  small: 'px-4 py-2 min-h-10',
  medium: 'px-5 py-3 min-h-12',
  large: 'px-6 py-4 min-h-14',
};

const sizeTextVariant: Record<ButtonSize, TypographyVariant> = {
  small: 'subtitle-14-semibold',
  medium: 'subtitle-14-semibold',
  large: 'subtitle-16',
};

// Chrome colors only — every value resolves to a Tailwind token, never a raw hex.
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-transparent border border-light-border dark:border-dark-border',
  outline: 'bg-transparent border-2 border-primary',
  soft: 'bg-primary-soft',
  ghost: 'bg-transparent',
  destructive: 'bg-error',
};

// Default text/spinner color per variant when `children` is a string.
const variantTextColor: Record<ButtonVariant, TypographyColor> = {
  primary: 'white',
  secondary: 'primary',
  outline: 'primary',
  soft: 'primary',
  ghost: 'primary',
  destructive: 'white',
};

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  disabled = false,
  haptic = false,
  pressScale = true,
  textColor,
  textVariant,
  className,
  children,
  style,
  onPress,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDisabled = disabled || loading;
  const resolvedTextColor = textColor ?? variantTextColor[variant];
  const spinnerColor = resolvedTextColor === 'white' ? colors.white : colors.primary;

  // Plain string/number children get wrapped in Typography; rich children
  // (icon + text rows, custom layouts) are rendered as-is so buttons can still
  // match their surrounding context.
  const content =
    typeof children === 'string' || typeof children === 'number' ? (
      <Typography variant={textVariant ?? sizeTextVariant[size]} color={resolvedTextColor}>
        {children}
      </Typography>
    ) : (
      children
    );

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
        items-center justify-center rounded-xl
        ${className || ''}
      `}
      disabled={isDisabled}
      onPress={(e) => {
        if (haptic) Haptics.selectionAsync();
        onPress?.(e);
      }}
      onPressIn={(e) => {
        if (pressScale) scale.value = withSpring(0.97, SPRING_CONFIG);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (pressScale) scale.value = withSpring(1, SPRING_CONFIG);
        onPressOut?.(e);
      }}
      {...props}>
      {loading ? (
        <View className="flex-row items-center justify-center">
          <ActivityIndicator size="small" color={spinnerColor} />
        </View>
      ) : (
        content
      )}
    </AnimatedPressable>
  );
};
