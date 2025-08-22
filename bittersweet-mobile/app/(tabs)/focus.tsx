import React, { useEffect, useRef, useState } from 'react';
import { View, SafeAreaView, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { TagSelector, TimeScroller } from '../../src/components/focus';

// Mock data for tags
const mockTags = [
  { id: '1', name: 'Work', color: '#6592E9' },
  { id: '2', name: 'Study', color: '#51BC6F' },
  { id: '3', name: 'Personal', color: '#EF786C' },
  { id: '4', name: 'Exercise', color: '#FF9800' },
  { id: '5', name: 'Reading', color: '#9C27B0' },
  { id: '6', name: 'Creative', color: '#FF5722' },
];

export default function FocusScreen() {
  const [selectedTime, setSelectedTime] = useState(10); // minutes; 0 => ∞
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Session + timer state
  const [isSessionActive, setIsSessionActive] = useState(false); // true during transition or running
  const [isRunning, setIsRunning] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionCancelledRef = useRef(false);

  // Animation refs
  const scrollerOpacity = useRef(new Animated.Value(1)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(0.94)).current;
  const timerTranslateY = useRef(new Animated.Value(6)).current;
  const tagsOpacity = useRef(new Animated.Value(1)).current;

  const handleTagSelect = (tagId: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const resetToIdleVisuals = () => {
    scrollerOpacity.setValue(1);
    tagsOpacity.setValue(1);
    timerOpacity.setValue(0);
    timerScale.setValue(0.94);
    timerTranslateY.setValue(6);
  };

  const startTimer = () => {
    const infinite = selectedTime === 0;
    setIsInfinite(infinite);
    setIsRunning(true);

    if (infinite) {
      setElapsedSeconds(0);
    } else {
      setRemainingSeconds(selectedTime * 60);
    }

    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => {
      if (infinite) {
        setElapsedSeconds(prev => prev + 1);
      } else {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current as any);
            timerRef.current = null;
            setIsRunning(false);
            setIsSessionActive(false);
            // Reverse to scroller view at the end
            Animated.parallel([
              Animated.timing(timerOpacity, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(timerScale, { toValue: 0.96, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(timerTranslateY, { toValue: 6, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start(() => {
              Animated.parallel([
                Animated.timing(scrollerOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(tagsOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              ]).start();
            });
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
  };

  const stopCompletely = () => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;
    setIsRunning(false);
    setIsSessionActive(false);
  };

  const stopWithAnimation = () => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;
    setIsRunning(false);

    Animated.parallel([
      Animated.timing(timerOpacity, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(timerScale, { toValue: 0.96, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(timerTranslateY, { toValue: 6, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(scrollerOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagsOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setIsSessionActive(false);
      });
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
    };
  }, []);

  const handleStartFocus = () => {
    // If running or transitioning, treat as Stop/Cancel immediately
    if (isRunning || isSessionActive) {
      transitionCancelledRef.current = true;
      // Cancel any in-flight animations and reset visuals
      resetToIdleVisuals();
      stopCompletely();
      return;
    }

    // Start flow: switch button to Stop immediately
    setIsSessionActive(true);
    transitionCancelledRef.current = false;

    // Prepare timer visuals for entrance
    timerOpacity.setValue(0);
    timerScale.setValue(0.94);
    timerTranslateY.setValue(6);

    // Fade out scroller and tags first to avoid layout shifts
    Animated.parallel([
      Animated.timing(scrollerOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tagsOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      if (transitionCancelledRef.current) return;
      Animated.parallel([
        Animated.timing(timerOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(timerScale, { toValue: 1, stiffness: 220, damping: 20, mass: 0.6, useNativeDriver: true }),
        Animated.spring(timerTranslateY, { toValue: 0, stiffness: 220, damping: 20, mass: 0.6, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !transitionCancelledRef.current) startTimer();
      });
    });
  };

  const handleTimeChange = (time: number) => {
    setSelectedTime(time);
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const displayTime = isInfinite ? formatTime(elapsedSeconds) : formatTime(remainingSeconds);

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <Pressable className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center">
          <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-4">
        {/* Time Selector or Running Timer - stacked and crossfaded */}
        <View style={{ height: 240, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          <Animated.View style={{ position: 'absolute', opacity: scrollerOpacity, width: '100%', zIndex: 0 }} pointerEvents={isRunning ? 'none' : 'auto'}>
            <TimeScroller
              selectedTime={selectedTime}
              onTimeChange={handleTimeChange}
            />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: timerOpacity, transform: [{ scale: timerScale }, { translateY: timerTranslateY }], zIndex: 100 }}>
            <Animated.Text
              style={{ fontSize: 96, lineHeight: 104, color: '#FFFFFF', fontFamily: 'Poppins-Bold', textAlign: 'center' }}
            >
              {displayTime}
            </Animated.Text>
          </Animated.View>
        </View>

        {/* Tag Selector (kept mounted, fade only) */}
        <View style={{ width: '100%', marginBottom: 64, minHeight: 96, justifyContent: 'center' }}>
          <Animated.View style={{ opacity: tagsOpacity }} pointerEvents={isRunning ? 'none' : 'auto'}>
            <TagSelector
              tags={mockTags}
              selectedTags={selectedTags}
              onTagSelect={handleTagSelect}
            />
          </Animated.View>
        </View>
      </View>

      {/* Start/Stop Button - Fixed at bottom */}
      <View className="px-4 pb-8">
        <Pressable
          onPress={handleStartFocus}
          className="bg-white rounded-2xl py-4 items-center active:opacity-80"
          style={{ 
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Typography 
            variant="subtitle-16" 
            className="font-semibold"
            style={{ color: '#1B1C30' }}
          >
            {isSessionActive ? 'Stop' : 'Start Focus'}
          </Typography>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}