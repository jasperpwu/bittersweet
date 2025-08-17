import React, { FC } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface TabBarIconProps {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  size?: number;
}

export const TabBarIcon: FC<TabBarIconProps> = ({
  name,
  color,
  size = 28,
}) => {
  return (
    <FontAwesome 
      name={name} 
      size={size} 
      color={color}
      style={{ marginBottom: -3 }}
    />
  );
};