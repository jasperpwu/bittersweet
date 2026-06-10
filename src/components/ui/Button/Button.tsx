import React, { FC } from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Typography } from '../Typography';

interface ButtonProps extends PressableProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
  disabled?: boolean;
}

const SPRING_CONFIG = { damping: 15, stiffness: 150 };

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  disabled = false,
  className,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeClasses = {
    small: 'px-4 py-2 min-h-10',
    medium: 'px-5 py-3 min-h-12',
    large: 'px-6 py-4 min-h-14',
  };

  const variantClasses = {
    primary: 'bg-primary',
    secondary: 'bg-transparent border border-light-border dark:border-dark-border',
    outline: 'bg-transparent border-2 border-primary',
  };

  const textColor = {
    primary: 'white' as const,
    secondary: 'primary' as const,
    outline: 'primary' as const,
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        className={`
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${disabled ? 'opacity-50' : ''}
          rounded-xl items-center justify-center
          ${className || ''}
        `}
        disabled={disabled}
        onPressIn={(e) => {
          scale.value = withSpring(0.97, SPRING_CONFIG);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, SPRING_CONFIG);
          onPressOut?.(e);
        }}
        {...props}
      >
        <Typography
          variant="subtitle-14-semibold"
          color={textColor[variant]}
        >
          {children}
        </Typography>
      </Pressable>
    </Animated.View>
  );
};
