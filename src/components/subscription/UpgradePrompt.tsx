import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';

type LimitType = 'tags' | 'goals' | 'adhd';

interface UpgradePromptProps {
  isVisible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  limitType: LimitType;
}

const LIMIT_COPY: Record<LimitType, { title: string; subtitle: string }> = {
  tags: {
    title: "You've used all your free tags",
    subtitle: 'Upgrade to Premium to create unlimited tags and organize your focus sessions however you want.',
  },
  goals: {
    title: "You've reached your goal limit",
    subtitle: 'Upgrade to Premium to set unlimited focus goals and track your progress across all areas.',
  },
  adhd: {
    title: 'ADHD mode is a Premium feature',
    subtitle: 'Upgrade to Premium to add a second tag to a session — perfect for tracking two things you do at once, like a workout and an audiobook.',
  },
};

const PERKS = [
  { icon: 'pricetags-outline' as const, label: 'Unlimited tags' },
  { icon: 'flag-outline' as const, label: 'Unlimited goals' },
  { icon: 'cloud-outline' as const, label: 'Cloud backup & sync' },
];

export const UpgradePrompt: FC<UpgradePromptProps> = ({
  isVisible,
  onClose,
  onUpgrade,
  limitType,
}) => {
  const copy = LIMIT_COPY[limitType];

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
            key={perk.label}
            className={`flex-row items-center py-2 ${i < PERKS.length - 1 ? 'border-b border-light-border dark:border-dark-border' : ''}`}
          >
            <Ionicons name={perk.icon} size={18} color="#8B7FFF" />
            <Typography variant="subtitle-14-medium" color="primary" className="ml-3">
              {perk.label}
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
          See Plans
        </Typography>
      </Pressable>

      {/* Dismiss */}
      <Pressable onPress={onClose} className="mt-3 items-center active:opacity-70">
        <Typography variant="body-12" color="secondary">
          Maybe later
        </Typography>
      </Pressable>
    </BottomSheet>
  );
};
