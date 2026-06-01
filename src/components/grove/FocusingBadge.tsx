import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';

interface FocusingBadgeProps {
  size?: number;
}

export const FocusingBadge: React.FC<FocusingBadgeProps> = ({ size = 10 }) => {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const borderWidth = Math.max(1.5, size * 0.2);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: size + borderWidth * 2,
        height: size + borderWidth * 2,
        borderRadius: (size + borderWidth * 2) / 2,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#34D399',
          opacity,
        }}
      />
    </View>
  );
};
