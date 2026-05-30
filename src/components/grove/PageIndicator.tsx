import React from 'react';
import { View } from 'react-native';

interface PageIndicatorProps {
  count: number;
  activeIndex: number;
}

export const PageIndicator: React.FC<PageIndicatorProps> = ({ count, activeIndex }) => {
  if (count <= 1) return null;

  return (
    <View className="flex-row items-center justify-center mt-3">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          className={`mx-1 rounded-full ${
            i === activeIndex
              ? 'w-2 h-2 bg-primary'
              : 'w-1.5 h-1.5 bg-light-border dark:bg-dark-border'
          }`}
        />
      ))}
    </View>
  );
};
