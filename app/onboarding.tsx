import React, { useRef, useState } from 'react';
import { View, FlatList, useWindowDimensions, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../src/components/ui/Typography';
import { Button } from '../src/components/ui/Button';
import { useUnifiedStore } from '../src/store/unified-store';

const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'Focus and Plant',
    description: 'Stay focused to grow your tree and later enjoy the fruits of your hard work.',
    iconName: 'leaf-outline',
    iconColor: '#51BC6F',
  },
  {
    id: '2',
    title: 'Configure Your Focus',
    description: 'Set your session tags, goals, and start your timer. Personalize your productivity journey.',
    iconName: 'timer-outline',
    iconColor: '#6592E9',
  },
  {
    id: '3',
    title: 'Earn Fruits & Unlock Apps',
    description: 'Use the fruits earned from focus sessions to unlock apps in your blocklist.',
    iconName: 'shield-checkmark-outline',
    iconColor: '#EF786C',
  },
  {
    id: '4',
    title: 'Welcome to Bittersweet',
    description: 'We are actively developing this app and would love your feedback to shape its future.',
    iconName: 'megaphone-outline',
    iconColor: '#F5A623',
  },
];

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  const completeOnboarding = async () => {
    // Set hasSeenOnboarding to true in the store
    const updatePreferences = useUnifiedStore.getState().updatePreferences;
    if (updatePreferences) {
      await updatePreferences({ hasSeenOnboarding: true });
    }
    // Navigate to the main tabs
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      completeOnboarding();
    }
  };

  const onScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    if (index !== currentIndex && index >= 0 && index < ONBOARDING_DATA.length) {
      setCurrentIndex(index);
    }
  };

  const renderItem = ({ item }: { item: typeof ONBOARDING_DATA[0] }) => {
    return (
      <View style={{ width }} className="flex-1 items-center justify-center px-8">
        <View className="bg-light-surface dark:bg-dark-surface p-10 rounded-[40px] shadow-sm mb-12 items-center justify-center" style={{ width: width * 0.7, aspectRatio: 1 }}>
          <Ionicons name={item.iconName as any} size={100} color={item.iconColor} />
        </View>
        <Typography variant="headline-24" className="text-center mb-4">
          {item.title}
        </Typography>
        <Typography variant="body-16" color="secondary" className="text-center">
          {item.description}
        </Typography>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-light-background dark:bg-dark-background">
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_DATA}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />
      
      <View className="px-8 pb-12 pt-4">
        {/* Pagination Dots */}
        <View className="flex-row justify-center items-center mb-8">
          {ONBOARDING_DATA.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full mx-1 ${
                index === currentIndex 
                  ? 'w-6 bg-primary' 
                  : 'w-2 bg-light-border dark:bg-dark-border'
              }`}
            />
          ))}
        </View>

        {/* Action Button */}
        <Button 
          onPress={handleNext} 
          variant="primary" 
          size="large"
          className="w-full"
        >
          {currentIndex === ONBOARDING_DATA.length - 1 ? 'Get Started' : 'Next'}
        </Button>
      </View>
    </View>
  );
}
