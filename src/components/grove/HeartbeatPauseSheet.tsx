import React, { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { colors } from '../../config/theme';
import { BottomSheet } from '../ui/BottomSheet';
import i18n from '../../i18n';
import type { HeartbeatSettings } from '../../services/grove/GroveHeartbeatService';

type PauseDuration = '1_week' | '2_weeks' | '1_month';

interface HeartbeatPauseSheetProps {
  isVisible: boolean;
  onClose: () => void;
  settings: HeartbeatSettings | null;
  onPause: (duration: PauseDuration) => Promise<void>;
  onResume: () => Promise<void>;
}

const DURATION_OPTIONS: { value: PauseDuration; labelKey: string }[] = [
  { value: '1_week', labelKey: 'gm.hbDur1Week' },
  { value: '2_weeks', labelKey: 'gm.hbDur2Weeks' },
  { value: '1_month', labelKey: 'gm.hbDur1Month' },
];

export const HeartbeatPauseSheet: React.FC<HeartbeatPauseSheetProps> = ({
  isVisible,
  onClose,
  settings,
  onPause,
  onResume,
}) => {
  const { t } = useTranslation();
  const [selectedDuration, setSelectedDuration] = useState<PauseDuration>('1_week');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPaused = settings?.isPaused ?? false;

  const handlePause = async () => {
    setIsSubmitting(true);
    try {
      await onPause(selectedDuration);
      onClose();
    } catch {
      // Error handled by store
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResume = async () => {
    setIsSubmitting(true);
    try {
      await onResume();
      onClose();
    } catch {
      // Error handled by store
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatExpiryDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} height={isPaused ? 280 : 380} scrollable>
      <View className="px-1">
        <View className="flex-row items-center mb-4">
          <Ionicons name="heart" size={20} color={colors.error} />
          <Typography variant="headline-18" color="primary" className="ml-2">
            {isPaused ? t('gm.icPaused') : t('gm.icPauseHeartbeat')}
          </Typography>
        </View>

        {isPaused ? (
          <>
            <View className="bg-light-border/30 dark:bg-dark-card rounded-xl p-4 mb-4">
              <Typography variant="body-14" color="secondary">
                {t('gm.hbPausedUntilPrefix')}{' '}
                <Typography variant="subtitle-14-medium" color="primary">
                  {formatExpiryDate(settings?.pauseExpiresAt ?? null)}
                </Typography>
              </Typography>
              <Typography variant="body-12" color="secondary" className="mt-2">
                {t('gm.hbPausedDesc')}
              </Typography>
            </View>

            <Button
              variant="destructive"
              fullWidth
              loading={isSubmitting}
              textVariant="subtitle-14-medium"
              className="bg-error rounded-xl py-3.5"
              onPress={handleResume}
            >
              {t('gm.hbResume')}
            </Button>
          </>
        ) : (
          <>
            <Typography variant="body-14" color="secondary" className="mb-4">
              {t('gm.hbPauseDesc')}
            </Typography>

            <View className="mb-4">
              {DURATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setSelectedDuration(option.value)}
                  className="flex-row items-center py-3 active:opacity-70"
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center mr-3 ${
                      selectedDuration === option.value
                        ? 'border-error'
                        : 'border-light-border dark:border-dark-border'
                    }`}
                  >
                    {selectedDuration === option.value && (
                      <View className="w-2.5 h-2.5 rounded-full bg-error" />
                    )}
                  </View>
                  <Typography variant="subtitle-14-medium" color="primary">
                    {t(option.labelKey)}
                  </Typography>
                </Pressable>
              ))}
            </View>

            <Button
              variant="destructive"
              fullWidth
              loading={isSubmitting}
              textVariant="subtitle-14-medium"
              className="bg-error rounded-xl py-3.5"
              onPress={handlePause}
            >
              {t('gm.icPauseHeartbeat')}
            </Button>
          </>
        )}
      </View>
    </BottomSheet>
  );
};
