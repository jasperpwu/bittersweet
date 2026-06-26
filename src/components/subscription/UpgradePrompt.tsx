import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';

type LimitType = 'tags' | 'goals' | 'adhd' | 'health';

interface UpgradePromptProps {
  isVisible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  limitType: LimitType;
}

// i18n key suffix per limit type → subscription.limit{Tags,Goals,Adhd,Health}{Title,Sub}
const LIMIT_KEY: Record<LimitType, string> = {
  tags: 'Tags',
  goals: 'Goals',
  adhd: 'Adhd',
  health: 'Health',
};

const PERKS = [
  { icon: 'pricetags-outline' as const, labelKey: 'subscription.perkUnlimitedTags' },
  { icon: 'flag-outline' as const, labelKey: 'subscription.perkUnlimitedGoals' },
  { icon: 'cloud-outline' as const, labelKey: 'subscription.perkCloudSync' },
];

export const UpgradePrompt: FC<UpgradePromptProps> = ({
  isVisible,
  onClose,
  onUpgrade,
  limitType,
}) => {
  const { t } = useTranslation();
  const copy = {
    title: t(`subscription.limit${LIMIT_KEY[limitType]}Title`),
    subtitle: t(`subscription.limit${LIMIT_KEY[limitType]}Sub`),
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} height={380}>
      <View className="items-center mb-4">
        <View className="w-14 h-14 rounded-full bg-light-border/30 dark:bg-[#2A2B4A] items-center justify-center mb-4">
          <Ionicons name="diamond-outline" size={28} color="#8B7FFF" />
        </View>
        <Typography variant="headline-20" color="primary" className="text-center mb-2">
          {copy.title}
        </Typography>
        <Typography variant="body-14" color="secondary" className="text-center">
          {copy.subtitle}
        </Typography>
      </View>

      {/* Perks */}
      <View className="bg-light-border/30 dark:bg-[#2A2B4A] rounded-2xl p-4 mb-6">
        {PERKS.map((perk, i) => (
          <View
            key={perk.labelKey}
            className={`flex-row items-center py-2 ${i < PERKS.length - 1 ? 'border-b border-light-border dark:border-dark-border' : ''}`}
          >
            <Ionicons name={perk.icon} size={18} color="#8B7FFF" />
            <Typography variant="subtitle-14-medium" color="primary" className="ml-3">
              {t(perk.labelKey)}
            </Typography>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Pressable
        onPress={() => {
          onClose();
          onUpgrade();
        }}
        className="bg-primary rounded-2xl py-4 items-center active:opacity-80"
      >
        <Typography variant="subtitle-16" color="white" className="font-semibold">
          {t('subscription.seePlans')}
        </Typography>
      </Pressable>

      {/* Dismiss */}
      <Pressable onPress={onClose} className="mt-3 items-center active:opacity-70">
        <Typography variant="body-12" color="secondary">
          {t('subscription.maybeLater')}
        </Typography>
      </Pressable>
    </BottomSheet>
  );
};
