import React from 'react';
import { View, Pressable } from 'react-native';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface FriendRequestBannerProps {
  count: number;
  onPress: () => void;
}

export const FriendRequestBanner: React.FC<FriendRequestBannerProps> = ({
  count,
  onPress,
}) => {
  if (count === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="mx-5 mt-2 mb-3 bg-primary/10 rounded-xl px-4 py-3 flex-row items-center active:opacity-70"
    >
      <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3">
        <Ionicons name="person-add" size={16} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Typography variant="subtitle-14-medium" color="primary">
          {count} friend {count === 1 ? 'request' : 'requests'}
        </Typography>
        <Typography variant="body-12" color="secondary">
          Tap to review
        </Typography>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.primary} />
    </Pressable>
  );
};
