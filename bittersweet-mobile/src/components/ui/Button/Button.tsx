import React, { FC, memo } from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Typography } from '../Typography';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  children: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: FC<ButtonProps> = memo(({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  children,
  className,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.95);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1);
    }
  };

  const sizeClasses = {
    small: 'px-4 py-2 min-h-[36px]',
    medium: 'px-5 py-3 min-h-[48px]',
    large: 'px-6 py-4 min-h-[56px]',
  };

  const variantClasses = {
    primary: 'bg-primary',
    secondary: 'bg-transparent border border-light-border dark:border-dark-border',
  };

  return (
    <AnimatedPressable
      style={animatedStyle}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        rounded-xl
        items-center
        justify-center
        ${disabled ? 'opacity-50' : 'active:opacity-80'}
        ${className || ''}
      `}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      {...props}
    >
      <Typography 
        variant="subtitle-14-semibold" 
        color={variant === 'primary' ? 'white' : 'primary'}
      >
        {children}
      </Typography>
    </AnimatedPressable>
  );
});

Button.displayName = 'Button';