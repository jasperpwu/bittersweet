import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface AddFriendCardProps {
  onPress: () => void;
}

export const AddFriendCard: React.FC<AddFriendCardProps> = ({ onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      className="bg-light-border/30 dark:bg-[#242540] rounded-2xl w-[280px] items-center justify-center active:opacity-70"
      style={{ minHeight: 150 }}
    >
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-3">
        <Ionicons name="person-add-outline" size={24} color="#6592E9" />
      </View>
      <Typography variant="subtitle-14-medium" color="primary">
        Add Friend
      </Typography>
      <Typography variant="body-12" color="secondary" className="mt-1">
        Share your invite link
      </Typography>
    </Pressable>
  );
};
