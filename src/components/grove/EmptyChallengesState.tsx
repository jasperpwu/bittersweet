import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useTranslation } from 'react-i18next';

interface EmptyChallengesStateProps {
  onCreateChallenge: () => void;
}

export const EmptyChallengesState: React.FC<EmptyChallengesStateProps> = ({ onCreateChallenge }) => {
  const { t } = useTranslation();
  return (
    <View className="mx-5 bg-light-border/30 dark:bg-[#242540] rounded-2xl p-5 items-center">
      <View className="w-12 h-12 rounded-full bg-[#E9A065]/10 items-center justify-center mb-3">
        <Ionicons name="flame-outline" size={24} color="#E9A065" />
      </View>
      <Typography variant="subtitle-14-medium" color="primary" className="text-center mb-1">
        {t('groveUI.noChallengesTitle')}
      </Typography>
      <Typography variant="body-12" color="secondary" className="text-center mb-4">
        {t('groveUI.noChallengesDesc')}
      </Typography>
      <Pressable
        onPress={onCreateChallenge}
        className="bg-[#E9A065] rounded-xl px-5 py-2.5 active:opacity-80"
      >
        <Typography variant="subtitle-14-medium" style={{ color: '#FFFFFF' }}>
          {t('groveUI.startChallenge')}
        </Typography>
      </Pressable>
    </View>
  );
};
