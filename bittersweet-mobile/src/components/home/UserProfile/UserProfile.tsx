import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../ui/Avatar';
import { Typography } from '../../ui/Typography';

interface UserProfileProps {
  user: {
    name: string;
    avatar?: string;
  };
  onNotificationPress: () => void;
  notificationCount?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const UserProfile: FC<UserProfileProps> = ({
  user,
  onNotificationPress,
  notificationCount = 0,
}) => {
  const notificationScale = useSharedValue(1);

  const handleNotificationPress = () => {
    notificationScale.value = withSpring(0.9, {}, () => {
      notificationScale.value = withSpring(1);
    });
    onNotificationPress();
  };

  const notificationAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: notificationScale.value }],
  }));

  return (
    <View className="flex-row items-center justify-between px-5 py-6">
      {/* User Info */}
      <View className="flex-row items-center flex-1">
        <View className="mr-4">
          <Avatar
            source={user.avatar}
            size="medium"
          />
        </View>
        <View className="flex-1">
          <Typography 
            variant="headline-20" 
            color="primary"
            className="text-dark-text-primary"
          >
            Hello, {user.name}!
          </Typography>
          <Typography 
            variant="body-14" 
            color="secondary"
            className="text-dark-text-secondary mt-1"
          >
            Be productive today!
          </Typography>
        </View>
      </View>

      {/* Notification Icon */}
      <AnimatedPressable
        style={notificationAnimatedStyle}
        onPress={handleNotificationPress}
        className="relative p-2"
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        accessibilityHint={`You have ${notificationCount} notifications`}
      >
        <Ionicons 
          name="notifications-outline" 
          size={24} 
          color="#FFFFFF" 
        />
        
        {/* Notification Badge */}
        {notificationCount > 0 && (
          <View className="absolute -top-1 -right-1 bg-error rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
            <Typography 
              variant="tiny-10" 
              className="text-white font-poppins-semibold"
            >
              {notificationCount > 99 ? '99+' : notificationCount.toString()}
            </Typography>
          </View>
        )}
      </AnimatedPressable>
    </View>
  );
};