import React from 'react';
import { View, Pressable, useColorScheme } from 'react-native';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { Toggle } from '../ui/Toggle';
import { useTranslation } from 'react-i18next';

type ProfileType = 'public' | 'private';

interface PrivacyToggleListProps {
  profileType: ProfileType;
  showLiveStatus: boolean;
  onChangeProfileType: (value: ProfileType) => void;
  onToggleShowLiveStatus: (value: boolean) => void;
}

export const PrivacyToggleList: React.FC<PrivacyToggleListProps> = ({
  profileType,
  showLiveStatus,
  onChangeProfileType,
  onToggleShowLiveStatus,
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary;

  const options: { value: ProfileType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: 'public', label: t('privacy.profilePublic'), icon: 'earth-outline' },
    { value: 'private', label: t('privacy.profilePrivate'), icon: 'lock-closed-outline' },
  ];

  return (
    <View>
      {/* Profile Type */}
      <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
        {t('privacy.profileType')}
      </Typography>
      <View className="flex-row bg-light-border/30 dark:bg-dark-card rounded-2xl p-1 mb-2">
        {options.map((opt) => {
          const selected = profileType === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChangeProfileType(opt.value)}
              accessibilityLabel={opt.label}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl ${
                selected ? 'bg-primary' : ''
              }`}
            >
              <Ionicons
                name={opt.icon}
                size={16}
                color={selected ? colors.white : iconColor}
                style={{ marginRight: 6 }}
              />
              <Typography
                variant="subtitle-14-medium"
                style={{ color: selected ? colors.white : iconColor }}
              >
                {opt.label}
              </Typography>
            </Pressable>
          );
        })}
      </View>
      <Typography variant="body-12" color="secondary" className="mb-4">
        {profileType === 'public'
          ? t('privacy.profilePublicSub')
          : t('privacy.profilePrivateSub')}
      </Typography>

      {/* Other privacy toggles */}
      <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
        {t('privacy.sharing')}
      </Typography>

      <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl px-4">
        <View className="flex-row items-center justify-between py-3">
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-8 items-center mr-3">
              <Ionicons name="radio-outline" size={20} color={iconColor} />
            </View>
            <View className="flex-1">
              <Typography variant="subtitle-14-medium" color="primary">
                {t('privacy.liveStatus')}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {t('privacy.liveStatusSub')}
              </Typography>
            </View>
          </View>
          <Toggle
            value={showLiveStatus}
            onValueChange={onToggleShowLiveStatus}
            size="medium"
            accessibilityLabel={t('privacy.a11yLiveStatus')}
          />
        </View>
      </View>
    </View>
  );
};
