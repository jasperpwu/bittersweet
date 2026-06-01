import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface InnerCircleInviteBannerProps {
  count: number;
  onPress: () => void;
}

export const InnerCircleInviteBanner: React.FC<InnerCircleInviteBannerProps> = ({
  count,
  onPress,
}) => {
  if (count === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="mx-5 mt-2 mb-3 bg-[#FF6B6B]/10 rounded-xl px-4 py-3 flex-row items-center active:opacity-70"
    >
      <View className="w-8 h-8 rounded-full bg-[#FF6B6B]/20 items-center justify-center mr-3">
        <Ionicons name="heart" size={16} color="#FF6B6B" />
      </View>
      <View className="flex-1">
        <Typography variant="subtitle-14-medium" color="primary">
          {count} inner circle {count === 1 ? 'invite' : 'invites'}
        </Typography>
        <Typography variant="body-12" color="secondary">
          Tap to review
        </Typography>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#FF6B6B" />
    </Pressable>
  );
};
