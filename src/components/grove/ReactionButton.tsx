import React, { useRef } from 'react';
import { Pressable, Animated, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../ui/Typography';

interface ReactionButtonProps {
  hasReacted: boolean;
  reactionCount: number;
  onToggle: () => void;
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  hasReacted,
  reactionCount,
  onToggle,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    // Scale animation
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  return (
    <Pressable onPress={handlePress} hitSlop={8}>
      <View className="flex-row items-center">
        <Animated.Text style={{ transform: [{ scale }], fontSize: 20 }}>
          {hasReacted ? '👏' : '👏'}
        </Animated.Text>
        {reactionCount > 0 && (
          <Typography
            variant="body-12"
            color={hasReacted ? 'primary' : 'secondary'}
            className="ml-1"
          >
            {reactionCount}
          </Typography>
        )}
      </View>
    </Pressable>
  );
};
