import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '../Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Tab icons - these would be replaced with actual icons
const TabIcon: FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const iconMap: Record<string, string> = {
    index: '🏠', // Time/Homepage
    tasks: '📋', // Tasks
    'task-creation': '➕', // Add new task
    insights: '📊', // Statistics
    settings: '⚙️', // Settings
  };

  return (
    <View className={`w-6 h-6 items-center justify-center ${focused ? 'opacity-100' : 'opacity-60'}`}>
      <Typography variant="body-14" color={focused ? 'white' : 'secondary'}>
        {iconMap[name] || '•'}
      </Typography>
    </View>
  );
};

export const TabBar: FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  const focusedIndex = state.index;

  return (
    <View 
      className="bg-dark-bg border-t border-dark-border"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row h-16">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined 
            ? options.tabBarLabel 
            : options.title !== undefined 
            ? options.title 
            : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Animation for active state
          const scale = useSharedValue(isFocused ? 1.1 : 1);
          const opacity = useSharedValue(isFocused ? 1 : 0.6);

          React.useEffect(() => {
            scale.value = withSpring(isFocused ? 1.1 : 1);
            opacity.value = withTiming(isFocused ? 1 : 0.6, { duration: 200 });
          }, [isFocused]);

          const animatedStyle = useAnimatedStyle(() => ({
            transform: [{ scale: scale.value }],
            opacity: opacity.value,
          }));

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              className="flex-1 items-center justify-center"
            >
              <Animated.View 
                style={animatedStyle}
                className="items-center justify-center"
              >
                <TabIcon name={route.name} focused={isFocused} />
                {isFocused && (
                  <View className="w-1 h-1 bg-primary rounded-full mt-1" />
                )}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};