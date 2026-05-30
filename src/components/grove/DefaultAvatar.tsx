import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';

const AVATAR_COLORS = [
  '#6592E9', '#E96565', '#65C4E9', '#E9A365',
  '#65E9A3', '#C465E9', '#E9E265', '#E965C4',
];

interface DefaultAvatarProps {
  displayName: string;
  userId?: string;
  color?: string;
  size?: number;
}

export const DefaultAvatar: React.FC<DefaultAvatarProps> = ({
  displayName,
  userId,
  color,
  size = 64,
}) => {
  const letter = (displayName || '?').charAt(0).toUpperCase();

  const bgColor = color
    ? color
    : userId
    ? AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length]
    : AVATAR_COLORS[0];

  const fontSize = size * 0.4;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography
        variant="headline-24"
        color="white"
        style={{ fontSize, lineHeight: fontSize * 1.2 }}
      >
        {letter}
      </Typography>
    </View>
  );
};
