import { View, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../ui';
import { colors } from '../../../config/theme';

interface FocusRatingBlockProps {
  /** 1–5, or null while a suggestion is still being computed. */
  rating: number | null;
  analyzing?: boolean;
  onChange: (rating: number) => void;
  onWhyPress: () => void;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Tappable 5-star focus rating. Shows the suggested rating once computed; tapping
 * a star overrides it. The "Why this rating?" link opens the insights sheet.
 */
export function FocusRatingBlock({
  rating,
  analyzing,
  onChange,
  onWhyPress,
}: FocusRatingBlockProps) {
  const colorScheme = useColorScheme();
  const emptyColor = colorScheme === 'dark' ? colors.dark.border : colors.light.border;

  return (
    <View className="mb-8 items-center">
      <Typography variant="body-12" color="secondary" className="mb-2">
        {analyzing ? 'Analyzing focus…' : 'Focus rating'}
      </Typography>
      <View className="flex-row" style={{ gap: 6 }}>
        {STARS.map((s) => {
          const filled = (rating ?? 0) >= s;
          return (
            <Pressable
              key={s}
              onPress={() => onChange(s)}
              disabled={analyzing}
              hitSlop={6}
              className="active:opacity-70">
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={32}
                color={filled ? colors.primary : emptyColor}
              />
            </Pressable>
          );
        })}
      </View>
      {!analyzing && (
        <Pressable onPress={onWhyPress} className="mt-3 active:opacity-70" hitSlop={6}>
          <Typography
            variant="body-12"
            color="secondary"
            style={{ textDecorationLine: 'underline' }}>
            Why this rating?
          </Typography>
        </Pressable>
      )}
    </View>
  );
}
