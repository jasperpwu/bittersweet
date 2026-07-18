import React from 'react';
import { View } from 'react-native';
import { Button } from '../ui/Button';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useTranslation } from 'react-i18next';

interface EmptyChallengesStateProps {
  onCreateChallenge: () => void;
}

export const EmptyChallengesState: React.FC<EmptyChallengesStateProps> = ({ onCreateChallenge }) => {
  const { t } = useTranslation();
  return (
    <View className="mx-5 bg-light-border/30 dark:bg-dark-card rounded-2xl p-5 items-center">
      <View className="w-12 h-12 rounded-full bg-[#E9A065]/10 items-center justify-center mb-3">
        <Ionicons name="flame-outline" size={24} color="#E9A065" />
      </View>
      <Typography variant="subtitle-14-medium" color="primary" className="text-center mb-1">
        {t('groveUI.noChallengesTitle')}
      </Typography>
      <Typography variant="body-12" color="secondary" className="text-center mb-4">
        {t('groveUI.noChallengesDesc')}
      </Typography>
      <Button
        variant="ghost"
        className="rounded-xl px-5"
        style={{ backgroundColor: '#E9A065' }}
        onPress={onCreateChallenge}
      >
        <Typography variant="subtitle-14-medium" style={{ color: colors.white }}>
          {t('groveUI.startChallenge')}
        </Typography>
      </Button>
    </View>
  );
};
