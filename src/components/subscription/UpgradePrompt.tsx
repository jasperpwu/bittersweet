import React, { FC } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { colors } from '../../config/theme';
import { PREMIUM_PERKS } from './premiumPerks';

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
    <BottomSheet isVisible={isVisible} onClose={onClose} height={480}>
      <View className="mb-4 items-center">
        <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <Ionicons name="diamond-outline" size={28} color={colors.primary} />
        </View>
        <Typography variant="headline-20" color="primary" className="mb-2 text-center">
          {copy.title}
        </Typography>
        <Typography variant="body-14" color="secondary" className="text-center">
          {copy.subtitle}
        </Typography>
      </View>

      {/* Perks — single source of truth (premiumPerks.ts) */}
      <View className="mb-6 rounded-2xl bg-light-border/20 p-4 dark:bg-white/[0.03]">
        {PREMIUM_PERKS.map((perk, i) => (
          <View
            key={perk.labelKey}
            className={`flex-row items-center py-2 ${i < PREMIUM_PERKS.length - 1 ? 'border-b border-light-border dark:border-dark-border' : ''}`}>
            <Ionicons name={perk.icon} size={18} color={colors.primary} />
            <Typography variant="subtitle-14-medium" color="primary" className="ml-3">
              {t(perk.labelKey)}
            </Typography>
          </View>
        ))}
      </View>

      {/* CTA */}
      <Button
        variant="primary"
        size="large"
        fullWidth
        haptic
        className="rounded-2xl"
        onPress={() => {
          onClose();
          onUpgrade();
        }}>
        {t('subscription.seePlans')}
      </Button>

      {/* Dismiss */}
      <Button
        variant="ghost"
        size="small"
        fullWidth
        textColor="secondary"
        textVariant="body-12"
        className="mt-2"
        onPress={onClose}>
        {t('subscription.maybeLater')}
      </Button>
    </BottomSheet>
  );
};
