import React, { FC } from 'react';
import { Pressable, PressableProps } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface HeaderButtonProps extends PressableProps {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color?: string;
  size?: number;
}

export const HeaderButton: FC<HeaderButtonProps> = ({
  name,
  color = '#007AFF',
  size = 24,
  ...props
}) => {
  return (
    <Pressable
      style={{
        padding: 8,
        marginHorizontal: 4,
      }}
      accessibilityRole="button"
      {...props}
    >
      <FontAwesome name={name} size={size} color={color} />
    </Pressable>
  );
};