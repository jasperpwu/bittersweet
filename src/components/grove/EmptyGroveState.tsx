import React from 'react';
import { View, Pressable } from 'react-native';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useTranslation } from 'react-i18next';

interface EmptyGroveStateProps {
  onAddFriend: () => void;
}

export const EmptyGroveState: React.FC<EmptyGroveStateProps> = ({ onAddFriend }) => {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center px-8 mt-12">
      <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
        <Ionicons name="people-outline" size={32} color={colors.primary} />
      </View>
      <Typography variant="subtitle-16" color="primary" className="text-center mb-2">
        {t('groveUI.emptyTitle')}
      </Typography>
      <Typography variant="body-14" color="secondary" className="text-center mb-6">
        {t('groveUI.emptyDesc')}
      </Typography>
      <Pressable
        onPress={onAddFriend}
        className="bg-primary rounded-xl px-6 py-3 active:opacity-80"
      >
        <Typography variant="subtitle-14-medium" style={{ color: colors.white }}>
          {t('groveUI.addFriends')}
        </Typography>
      </Pressable>
    </View>
  );
};
