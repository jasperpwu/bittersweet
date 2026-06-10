import React from 'react';
import { View, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './Typography';
import { Toggle } from './Toggle';

export interface SettingsItemProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  hasChevron?: boolean;
  valueLabel?: string;
  onPress?: () => void;
  isLast?: boolean;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  icon,
  hasToggle = false,
  toggleValue = false,
  onToggleChange,
  hasChevron = false,
  valueLabel,
  onPress,
  isLast = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`
        w-full flex-row items-center py-3
        ${onPress ? 'active:opacity-70' : ''}
        ${!isLast ? 'border-b border-light-border dark:border-dark-border' : ''}
      `}
    >
      {icon && (
        <View className="w-8 items-center mr-3">
          <Ionicons name={icon} size={20} color={isDark ? '#CACACA' : '#8B7355'} />
        </View>
      )}

      <View className="flex-1 mr-3">
        <Typography variant="subtitle-14-medium" color="primary">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body-12" color="secondary" className="mt-0.5">
            {subtitle}
          </Typography>
        )}
      </View>

      {hasToggle && onToggleChange && (
        <Toggle
          value={toggleValue}
          onValueChange={onToggleChange}
          size="medium"
          accessibilityLabel={`Toggle ${title}`}
        />
      )}

      {valueLabel && (
        <Typography variant="body-12" color="secondary" className="mr-1">
          {valueLabel}
        </Typography>
      )}

      {hasChevron && (
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
      )}
    </Pressable>
  );
};

export interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        {title}
      </Typography>
      <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
        {children}
      </View>
    </View>
  );
};
