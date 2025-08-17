import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';

interface SeedCounterProps {
  seedCount: number;
  onPress?: () => void;
  showAnimation?: boolean;
  size?: 'small' | 'medium' | 'large';
}


export const SeedCounter: FC<SeedCounterProps> = ({
  seedCount,
  onPress,
  showAnimation = false,
  size = 'medium',
}) => {
  const formatSeedCount = (count: number) => {
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
      {/* Seed icon placeholder - will be replaced with actual icon */}
      <View 
        className={`
          rounded-full bg-success mr-2
          ${size === 'small' ? 'w-4 h-4' : size === 'large' ? 'w-8 h-8' : 'w-6 h-6'}
        `} 
      />
      <Typography 
        variant={size === 'small' ? 'body-12' : size === 'large' ? 'headline-18' : 'subtitle-14-semibold'}
        color="primary"
      >
        {formatSeedCount(seedCount)}
      </Typography>
    </Component>
  );
};