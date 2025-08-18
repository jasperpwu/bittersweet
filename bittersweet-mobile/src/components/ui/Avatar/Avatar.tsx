import React, { FC } from 'react';
import { View, Pressable, Image } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Typography } from '../Typography';

interface AvatarProps {
  size?: 'small' | 'medium' | 'large';
  source?: string;
  name?: string;
  showEditButton?: boolean;
  onEditPress?: () => void;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const sizeClasses = {
  small: 'w-10 h-10',
  medium: 'w-16 h-16',
  large: 'w-20 h-20',
};

const editButtonSizes = {
  small: 'w-6 h-6',
  medium: 'w-8 h-8',
  large: 'w-10 h-10',
};

export const Avatar: FC<AvatarProps> = ({
  size = 'medium',
  source,
  name,
  showEditButton = false,
  onEditPress,
  onPress,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.95);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const AvatarContent = () => (
    <View className={`${sizeClasses[size]} rounded-full bg-primary items-center justify-center overflow-hidden`}>
      {source ? (
        <Image 
          source={{ uri: source }} 
          className="w-full h-full"
          resizeMode="cover"
        />
      ) : (
        <Typography 
          variant={size === 'large' ? 'headline-18' : size === 'medium' ? 'subtitle-14-semibold' : 'body-12'} 
          color="white"
        >
          {getInitials(name)}
        </Typography>
      )}
    </View>
  );

  return (
    <View className="relative">
      {onPress ? (
        <AnimatedPressable
          style={animatedStyle}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={`Avatar for ${name || 'user'}`}
        >
          <AvatarContent />
        </AnimatedPressable>
      ) : (
        <AvatarContent />
      )}

      {showEditButton && onEditPress && (
        <Pressable
          onPress={onEditPress}
          accessibilityRole="button"
          accessibilityLabel="Edit avatar"
          className={`
            ${editButtonSizes[size]} 
            absolute -bottom-1 -right-1 
            bg-white dark:bg-dark-bg 
            border-2 border-dark-bg dark:border-white 
            rounded-full 
            items-center justify-center
            active:opacity-80
          `}
        >
          <Typography variant="body-12" color="primary">
            📷
          </Typography>
        </Pressable>
      )}
    </View>
  );
};