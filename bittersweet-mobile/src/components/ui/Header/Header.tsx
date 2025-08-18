import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Typography } from '../Typography';

interface HeaderAction {
  icon: string;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface HeaderProps {
  title: string;
  leftAction?: HeaderAction;
  rightAction?: HeaderAction;
  variant?: 'default' | 'settings';
  backgroundColor?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ActionButton: FC<{ action: HeaderAction; variant?: 'default' | 'danger' }> = ({ 
  action, 
  variant = 'default' 
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <AnimatedPressable
      style={animatedStyle}
      onPress={action.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      className="w-10 h-10 items-center justify-center"
    >
      <Typography 
        variant="headline-18" 
        color={variant === 'danger' ? 'error' : 'white'}
      >
        {action.icon}
      </Typography>
    </AnimatedPressable>
  );
};

export const Header: FC<HeaderProps> = ({
  title,
  leftAction,
  rightAction,
  variant = 'default',
  backgroundColor = '#1B1C30',
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View 
      className="bg-dark-bg border-b border-dark-border"
      style={{ 
        paddingTop: insets.top,
        backgroundColor,
      }}
    >
      <View className="flex-row items-center justify-between h-14 px-4">
        {/* Left Action */}
        <View className="w-10 h-10 items-center justify-center">
          {leftAction && <ActionButton action={leftAction} />}
        </View>

        {/* Title */}
        <View className="flex-1 items-center">
          <Typography variant="headline-18" color="white">
            {title}
          </Typography>
        </View>

        {/* Right Action */}
        <View className="w-10 h-10 items-center justify-center">
          {rightAction && (
            <ActionButton 
              action={rightAction} 
              variant={variant === 'settings' && rightAction.icon === 'Log out' ? 'danger' : 'default'}
            />
          )}
        </View>
      </View>
    </View>
  );
};