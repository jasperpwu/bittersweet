import { View, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui';
import { colors } from '../../../config/theme';

interface FocusRatingBlockProps {
  /** 1–5, or null while a suggestion is still being computed. */
  rating: number | null;
  analyzing?: boolean;
  onWhyPress: () => void;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Read-only 5-star focus rating estimated from motion — the stars can't be
 * edited (a lock next to the label signals this). The "Why this rating?" link
 * opens the insights sheet, which explains the estimate and how to improve it
 * via the tag's activity type.
 */
export function FocusRatingBlock({ rating, analyzing, onWhyPress }: FocusRatingBlockProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const secondaryColor =
    colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.textSecondary;
  const emptyColor = colorScheme === 'dark' ? colors.dark.border : colors.light.border;

  return (
    <View className="mb-8 items-center">
      <View className="mb-2 flex-row items-center" style={{ gap: 4 }}>
        <Typography variant="body-12" color="secondary">
          {analyzing ? t('sessionComplete.analyzingFocus') : t('sessionComplete.focusRating')}
        </Typography>
        {!analyzing && <Ionicons name="lock-closed" size={11} color={secondaryColor} />}
      </View>
      <View className="flex-row" style={{ gap: 6 }}>
        {STARS.map((s) => {
          const filled = (rating ?? 0) >= s;
          return (
            <Ionicons
              key={s}
              name={filled ? 'star' : 'star-outline'}
              size={32}
              color={filled ? colors.primary : emptyColor}
            />
          );
        })}
      </View>
      {!analyzing && (
        <Pressable onPress={onWhyPress} className="mt-3 active:opacity-70" hitSlop={6}>
          <Typography
            variant="body-12"
            color="secondary"
            style={{ textDecorationLine: 'underline' }}>
            {t('sessionComplete.whyThisRating')}
          </Typography>
        </Pressable>
      )}
    </View>
  );
}
