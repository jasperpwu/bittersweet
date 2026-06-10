import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../Typography';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  description: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  iconColor = '#6592E9',
  title,
  description,
  buttonLabel,
  onButtonPress,
}) => {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="w-16 h-16 rounded-full items-center justify-center mb-4"
        style={{ backgroundColor: `${iconColor}15` }}
      >
        <Ionicons name={icon} size={32} color={iconColor} />
      </View>
      <Typography variant="subtitle-16" color="primary" className="text-center mb-2">
        {title}
      </Typography>
      <Typography variant="body-14" color="secondary" className="text-center mb-6">
        {description}
      </Typography>
      {buttonLabel && onButtonPress && (
        <Pressable
          onPress={onButtonPress}
          className="bg-primary rounded-xl px-6 py-3 active:opacity-80"
        >
          <Typography variant="subtitle-14-medium" style={{ color: '#FFFFFF' }}>
            {buttonLabel}
          </Typography>
        </Pressable>
      )}
    </View>
  );
};
