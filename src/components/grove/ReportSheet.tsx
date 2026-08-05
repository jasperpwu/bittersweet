import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '../ui/BottomSheet';
import { Typography } from '../ui/Typography';
import { colors } from '../../config/theme';
import type { ReportReason } from '../../services/grove/GroveModerationService';

interface ReportSheetProps {
  isVisible: boolean;
  onClose: () => void;
  /** Display name of the account being reported, shown in the subtitle. */
  displayName: string;
  onSubmit: (reason: ReportReason) => void;
}

const REASONS: { reason: ReportReason; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { reason: 'inappropriate', icon: 'eye-off-outline' },
  { reason: 'harassment', icon: 'sad-outline' },
  { reason: 'spam', icon: 'mail-unread-outline' },
  { reason: 'impersonation', icon: 'person-outline' },
  { reason: 'other', icon: 'ellipsis-horizontal' },
];

export const ReportSheet: React.FC<ReportSheetProps> = ({
  isVisible,
  onClose,
  displayName,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose}>
      <View className="mb-4">
        <Typography variant="headline-18" color="primary">
          {t('moderation.reportTitle')}
        </Typography>
        <Typography variant="body-14" color="secondary" className="mt-1">
          {t('moderation.reportSubtitle', { name: displayName })}
        </Typography>
      </View>

      <View className="pb-4">
        {REASONS.map(({ reason, icon }, i) => (
          <Pressable
            key={reason}
            onPress={() => onSubmit(reason)}
            className={`flex-row items-center py-3.5 active:opacity-60 ${
              i < REASONS.length - 1 ? 'border-b border-light-border dark:border-dark-border' : ''
            }`}>
            <View className="h-8 w-8 items-center justify-center rounded-full bg-light-border/40 dark:bg-white/[0.06]">
              <Ionicons name={icon} size={16} color={colors.primary} />
            </View>
            <Typography variant="subtitle-14-medium" color="primary" className="ml-3 flex-1">
              {t(`moderation.reason.${reason}`)}
            </Typography>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
};
