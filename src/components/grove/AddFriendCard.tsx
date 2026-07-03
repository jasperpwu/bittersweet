import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useTranslation } from 'react-i18next';
import { ACTIVITY_CARD_HEIGHT } from './FriendActivityCard';

interface AddFriendCardProps {
  onPress: () => void;
}

export const AddFriendCard: React.FC<AddFriendCardProps> = ({ onPress }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      className="bg-light-border/30 dark:bg-[#242540] rounded-2xl w-[280px] items-center justify-center active:opacity-70"
      style={{ height: ACTIVITY_CARD_HEIGHT }}
    >
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-3">
        <Ionicons name="person-add-outline" size={24} color="#6592E9" />
      </View>
      <Typography variant="subtitle-14-medium" color="primary">
        {t('groveUI.addFriend')}
      </Typography>
      <Typography variant="body-12" color="secondary" className="mt-1">
        {t('groveUI.shareInvite')}
      </Typography>
    </Pressable>
  );
};
