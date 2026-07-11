import React from 'react';
import { View, Pressable, useColorScheme } from 'react-native';
import { colors } from '../../config/theme';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { Toggle } from '../ui/Toggle';
import { useTranslation } from 'react-i18next';

interface TagOption {
  id: string;
  name: string;
  icon: string;
}

interface PrivacyToggleListProps {
  tags: TagOption[];
  sharedTagIds: string[];
  shareNotes: boolean;
  showLiveStatus: boolean;
  onToggleTag: (tagId: string) => void;
  onToggleShareNotes: (value: boolean) => void;
  onToggleShowLiveStatus: (value: boolean) => void;
}

export const PrivacyToggleList: React.FC<PrivacyToggleListProps> = ({
  tags,
  sharedTagIds,
  shareNotes,
  showLiveStatus,
  onToggleTag,
  onToggleShareNotes,
  onToggleShowLiveStatus,
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary;

  return (
    <View>
      {/* Shared Tags */}
      <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
        {t('privacy.sharedTags')}
      </Typography>
      <Typography variant="body-12" color="secondary" className="mb-3">
        {t('privacy.sharedTagsSub')}
      </Typography>

      <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl px-4 mb-4">
        {tags.map((tag, index) => {
          const isShared = sharedTagIds.includes(tag.id);
          return (
            <View
              key={tag.id}
              className={`flex-row items-center justify-between py-3 ${
                index < tags.length - 1 ? 'border-b border-light-border dark:border-dark-border' : ''
              }`}
            >
              <View className="flex-row items-center flex-1">
                <Typography variant="body-14" className="mr-2">
                  {tag.icon}
                </Typography>
                <Typography variant="subtitle-14-medium" color="primary">
                  {tag.name}
                </Typography>
              </View>
              <Toggle
                value={isShared}
                onValueChange={() => onToggleTag(tag.id)}
                size="medium"
                accessibilityLabel={t('privacy.a11yShareTag', { name: tag.name })}
              />
            </View>
          );
        })}

        {tags.length === 0 && (
          <View className="py-3">
            <Typography variant="body-12" color="secondary">
              {t('privacy.noTags')}
            </Typography>
          </View>
        )}
      </View>

      {/* Other privacy toggles */}
      <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
        {t('privacy.sharing')}
      </Typography>

      <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl px-4">
        <View className="flex-row items-center justify-between py-3 border-b border-light-border dark:border-dark-border">
          <View className="flex-row items-center flex-1 mr-3">
            <View className="w-8 items-center mr-3">
              <Ionicons name="document-text-outline" size={20} color={iconColor} />
            </View>
            <View className="flex-1">
              <Typography variant="subtitle-14-medium" color="primary">
                {t('privacy.shareNotes')}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {t('privacy.shareNotesSub')}
              </Typography>
            </View>
          </View>
          <Toggle
            value={shareNotes}
            onValueChange={onToggleShareNotes}
            size="medium"
            accessibilityLabel={t('privacy.a11yShareNotes')}
          />
        </View>

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
