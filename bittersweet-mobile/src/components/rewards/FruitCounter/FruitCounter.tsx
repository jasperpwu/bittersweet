import React, { FC } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Typography } from '../../ui/Typography';

interface FruitCounterProps {
  fruitCount: number;
  onPress?: () => void;
  showAnimation?: boolean;
  size?: 'small' | 'medium' | 'large';
}

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

  const Component = onPress ? Pressable : View;

  return (
    <Component
      onPress={onPress}
      className={`
        flex-row items-center
        ${size === 'small' ? 'px-2 py-1' : size === 'large' ? 'px-4 py-3' : 'px-3 py-2'}
        ${onPress ? 'active:opacity-80' : ''}
        ${showAnimation ? 'animate-pulse' : ''}
      `}
    >
      <Text 
        className={`
          mr-2
          ${size === 'small' ? 'text-sm' : size === 'large' ? 'text-2xl' : 'text-lg'}
        `}
      >
        🍎
      </Text>
      <Typography 
        variant={size === 'small' ? 'body-12' : size === 'large' ? 'headline-18' : 'subtitle-14-semibold'}
        color="primary"
      >
        {formatFruitCount(fruitCount)}
      </Typography>
    </Component>
  );
};