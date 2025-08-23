import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface User {
  name: string;
  avatar?: string;
  level?: number;
}

interface UserProfileProps {
  user: User;
  onNotificationPress: () => void;
  notificationCount: number;
}

export const UserProfile: FC<UserProfileProps> = ({
  user,
  onNotificationPress,
  notificationCount,
}) => {
  return (
    <View className="px-4 py-6 flex-row items-center justify-between">
      <View className="flex-1">
        <Typography variant="body-14" color="secondary">
          Good morning
        </Typography>
        <Typography variant="headline-20" color="primary" className="mt-1">
          {user.name}
        </Typography>
        {user.level && (
          <Typography variant="body-12" color="secondary" className="mt-1">
            Level {user.level}
          </Typography>
        )}
      </View>
      
      <Pressable
        onPress={onNotificationPress}
        className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center relative"
      >
        <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
        {notificationCount > 0 && (
          <View className="absolute -top-1 -right-1 w-5 h-5 bg-error rounded-full items-center justify-center">
            <Typography variant="tiny-10" color="white">
              {notificationCount > 9 ? '9+' : notificationCount.toString()}
            </Typography>
          </View>
        )}
      </Pressable>
    </View>
  );
};