import { View, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui';
import { colors } from '../../../config/theme';

interface FocusRatingBlockProps {
  /** 1–5, or null while a suggestion is still being computed. */
  rating: number | null;
  analyzing?: boolean;
  /**
   * True for self-rated tags (incl. unset), where motion doesn't grade the
   * session and the stars are the user's to set. Motion-graded tags stay locked.
   */
  editable?: boolean;
  /** Called with the tapped star count; only wired when `editable`. */
  onChange?: (rating: number) => void;
  onWhyPress: () => void;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * 5-star focus rating shown in the session summary.
 *
 * Two modes, decided by the tag's activity type:
 *  - motion-graded (`stationary` / `active`) — read-only, a lock next to the
 *    label signals it; the "Why this rating?" link explains the estimate and how
 *    to improve it via the tag's activity type.
 *  - self-rated (`self_rated`, and tags with no activity type) — starts at 5★
 *    and the user taps to set it, since motion can't judge phone-based or mixed
 *    work. Editing is intentionally offered here only, not in the journal.
 */
export function FocusRatingBlock({
  rating,
  analyzing,
  editable,
  onChange,
  onWhyPress,
}: FocusRatingBlockProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const secondaryColor =
    colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.textSecondary;
  const emptyColor = colorScheme === 'dark' ? colors.dark.border : colors.light.border;

  const label = analyzing
    ? t('sessionComplete.analyzingFocus')
    : editable
      ? t('sessionComplete.rateYourFocus')
      : t('sessionComplete.focusRating');

  return (
    <View className="mb-5 items-center">
      <View className="mb-1.5 flex-row items-center" style={{ gap: 4 }}>
        <Typography variant="body-12" color="secondary">
          {label}
        </Typography>
        {!analyzing && !editable && (
          <Ionicons name="lock-closed" size={11} color={secondaryColor} />
        )}
      </View>
      <View className="flex-row" style={{ gap: 6 }}>
        {STARS.map((s) => {
          const filled = (rating ?? 0) >= s;
          const star = (
            <Ionicons
              name={filled ? 'star' : 'star-outline'}
              size={26}
              color={filled ? colors.primary : emptyColor}
            />
          );
          if (!editable) return <View key={s}>{star}</View>;
          return (
            <Pressable
              key={s}
              onPress={() => {
                Haptics.selectionAsync();
                onChange?.(s);
              }}
              hitSlop={6}
              className="active:opacity-70">
              {star}
            </Pressable>
          );
        })}
      </View>
      {!analyzing && (
        <Pressable onPress={onWhyPress} className="mt-2 active:opacity-70" hitSlop={6}>
          <Typography
            variant="body-12"
            color="secondary"
            style={{ textDecorationLine: 'underline' }}>
            {editable ? t('sessionComplete.howRatingWorks') : t('sessionComplete.whyThisRating')}
          </Typography>
        </Pressable>
      )}
    </View>
  );
}
