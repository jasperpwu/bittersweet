import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface EmptyGroveStateProps {
  onAddFriend: () => void;
}

export const EmptyGroveState: React.FC<EmptyGroveStateProps> = ({ onAddFriend }) => {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
        <Ionicons name="people-outline" size={32} color="#6592E9" />
      </View>
      <Typography variant="subtitle-16" color="primary" className="text-center mb-2">
        Your Grove is quiet
      </Typography>
      <Typography variant="body-14" color="secondary" className="text-center mb-6">
        Add friends to see their focus sessions here. Share your invite link to get started.
      </Typography>
      <Pressable
        onPress={onAddFriend}
        className="bg-primary rounded-xl px-6 py-3 active:opacity-80"
      >
        <Typography variant="subtitle-14-medium" style={{ color: '#FFFFFF' }}>
          Add Friends
        </Typography>
      </Pressable>
    </View>
  );
};
