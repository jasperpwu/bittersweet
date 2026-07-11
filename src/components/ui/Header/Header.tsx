import React, { FC } from 'react';
import { View, Pressable, useColorScheme } from 'react-native';
import { colors } from '../../../config/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
  leftComponent?: React.ReactNode;
  rightAction?: HeaderAction;
  variant?: 'default' | 'settings';
  backgroundColor?: string;
  useSafeArea?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ActionButton: FC<{ action: HeaderAction; variant?: 'default' | 'danger' }> = ({
  action,
  variant = 'default'
}) => {
  const colorScheme = useColorScheme();
  const iconColor = colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary;
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
      <Ionicons 
        name={action.icon as keyof typeof Ionicons.glyphMap}
        size={20}
        color={variant === 'danger' ? colors.error : iconColor}
      />
    </AnimatedPressable>
  );
};

export const Header: FC<HeaderProps> = ({
  title,
  leftAction,
  leftComponent,
  rightAction,
  variant = 'default',
  backgroundColor,
  useSafeArea = true,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const defaultBg = colorScheme === 'dark' ? colors.dark.background : colors.light.screen;

  return (
    <View
      className="bg-light-bg dark:bg-dark-bg border-b border-light-border dark:border-dark-border"
      style={{
        paddingTop: useSafeArea ? insets.top : 0,
        ...(backgroundColor ? { backgroundColor } : { backgroundColor: defaultBg }),
      }}
    >
      <View className="flex-row items-center justify-between h-14 px-4">
        {/* Left Action */}
        <View className="w-10 h-10 items-center justify-center">
          {leftAction && <ActionButton action={leftAction} />}
          {leftComponent && leftComponent}
        </View>

        {/* Title */}
        <View className="flex-1 items-center">
          <Typography variant="headline-18" color="primary">
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