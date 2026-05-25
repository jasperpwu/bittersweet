import React, { FC } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Typography } from '../../ui/Typography';

interface FruitCounterProps {
  fruitCount: number;
  onPress?: () => void;
  showAnimation?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const sizeConfig = {
  small: { iconSize: 22, paddingH: 14, paddingV: 8, gap: 6 },
  medium: { iconSize: 28, paddingH: 16, paddingV: 10, gap: 8 },
  large: { iconSize: 34, paddingH: 20, paddingV: 12, gap: 10 },
} as const;

export const FruitCounter: FC<FruitCounterProps> = ({
  fruitCount,
  onPress,
  showAnimation = false,
  size = 'medium',
}) => {
  const formatFruitCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const config = sizeConfig[size];
  const Component = onPress ? Pressable : View;

  return (
    <Component
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: config.paddingH,
        paddingVertical: config.paddingV,
        borderRadius: 100,
        borderWidth: 1,
        gap: config.gap,
      }}
      className={`
        bg-light-text-primary/[0.08] dark:bg-white/[0.08]
        border-light-text-primary/10 dark:border-white/10
        ${onPress ? 'active:opacity-80' : ''}
        ${showAnimation ? 'animate-pulse' : ''}
      `}
    >
      <Text style={{ fontSize: config.iconSize, lineHeight: config.iconSize + 4 }}>
        🍎
      </Text>
      <Typography
        variant={size === 'small' ? 'subtitle-14-semibold' : size === 'large' ? 'headline-20' : 'headline-18'}
      >
        {formatFruitCount(fruitCount)}
      </Typography>
    </Component>
  );
};