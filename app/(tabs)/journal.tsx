import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, SafeAreaView, Alert, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { Header } from '../../src/components/ui/Header';
import { DateSelector, Timeline } from '../../src/components/journal';
import { useFocus, useRewards, useFocusActions } from '../../src/store';
import { FruitCounter } from '../../src/components/rewards';
import { generateExtendedWeekDates } from '../../src/utils/dateUtils';

export default function JournalScreen() {
  const params = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollToSessionId, setScrollToSessionId] = useState<string | null>(null);
  const { sessions } = useFocus();
  const rewards = useRewards();
  const { deleteSession } = useFocusActions();

  // Handle navigation from session creation
  useEffect(() => {
    if (params.sessionId && params.sessionDate) {
      const sessionDate = new Date(params.sessionDate as string);
      setSelectedDate(sessionDate);
      setScrollToSessionId(params.sessionId as string);
      
      // Clear the params to avoid re-triggering
      router.setParams({ sessionId: undefined, sessionDate: undefined });
    }
  }, [params.sessionId, params.sessionDate]);

  // Generate week dates for the date selector
  const weekDates = useMemo(() => generateExtendedWeekDates(), []);

  // Current time for the timeline indicator
  const currentTime = new Date();

  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const isSwiping = useSharedValue(false);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const navigateDay = useCallback((direction: -1 | 1) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction);
      return next;
    });
  }, []);

  const slideIn = useCallback((fromDirection: -1 | 1) => {
    // New content enters from the opposite side
    translateX.value = fromDirection * screenWidth * 0.3;
    translateX.value = withTiming(0, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    }, () => {
      isSwiping.value = false;
    });
  }, [screenWidth, translateX, isSwiping]);

  const swipeGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-30, 30])
      .failOffsetY([-20, 20])
      .onUpdate((event) => {
        if (!isSwiping.value) {
          translateX.value = event.translationX;
        }
      })
      .onEnd((event) => {
        if (isSwiping.value) return;
        if (Math.abs(event.translationX) > 50) {
          const direction = event.translationX < 0 ? 1 : -1;
          isSwiping.value = true;
          // Slide current content off-screen
          translateX.value = withTiming(
            -direction * screenWidth * 0.5,
            { duration: 150, easing: Easing.in(Easing.cubic) },
            () => {
              runOnJS(navigateDay)(direction);
              runOnJS(slideIn)(direction);
            }
          );
        } else {
          // Snap back
          translateX.value = withTiming(0, { duration: 200 });
        }
      }),
    [navigateDay, screenWidth, translateX, isSwiping, slideIn]
  );

  const animatedTimelineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: withTiming(isSwiping.value ? 0.5 : 1, { duration: 100 }),
  }));

  const handleAddSession = () => {
    router.push('/(modals)/session-creation');
  };

  const handleSessionPress = (sessionId: string) => {
    const session = sessions.byId[sessionId];
    if (!session) return;
    
    // Format times for display
    const startTime = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const options = [];
    
    // Add delete button
    options.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        deleteSession(sessionId);
      }
    });
    
    options.push({ text: 'Cancel', style: 'cancel' });
    
    // Create detailed message with start/end times and duration
    let message = `Start: ${startTime}\nEnd: ${endTime}\nDuration: ${session.targetDuration} minutes`;
    
    if (session.notes) {
      message += `\n\nNotes: ${session.notes}`;
    }
    
    Alert.alert(
      'Focus Session',
      message,
      options
    );
  };

  // Convert store sessions to component format and filter for selected date
  const sessionsForSelectedDate = useMemo(() => {
    // Safety check to handle undefined sessions
    if (!sessions || !sessions.allIds || !sessions.byId) {
      console.warn('Sessions data is not properly initialized:', sessions);
      return [];
    }
    
    return sessions.allIds
      .map(id => {
        const session = sessions.byId[id];
        if (!session) return null;
        
        return {
          id: session.id,
          startTime: new Date(session.startTime),
          endTime: new Date(session.endTime),
          duration: Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60)),
          tagName: session.tagName || '', // Use tagName directly
          notes: session.notes || '',
        };
      })
      .filter(session => {
        if (!session) return false;
        
        // Filter for selected date
        const sessionDate = session.startTime.toDateString();
        const selectedDateString = selectedDate.toDateString();
        return sessionDate === selectedDateString;
      })
      .filter((session): session is NonNullable<typeof session> => session !== null);
  }, [sessions, selectedDate]);


  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <StatusBar variant="dark" />
      
      <Header
        title="Journal"
        leftComponent={<FruitCounter fruitCount={rewards.balance} size="small" />}
        rightAction={{
          icon: 'add',
          onPress: handleAddSession,
        }}
        useSafeArea={false}
      />

      <View className="flex-1">
        {/* Date Selector */}
        <View className="border-b border-dark-border" style={{ backgroundColor: '#1B1C30' }}>
          <DateSelector
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            weekDates={weekDates}
          />
        </View>

        {/* Timeline */}
        <GestureDetector gesture={swipeGesture}>
          <Animated.View className="flex-1 px-5 pt-4" style={animatedTimelineStyle}>
            <Timeline
              sessions={sessionsForSelectedDate}
              currentTime={currentTime}
              onSessionPress={handleSessionPress}
              scrollToSessionId={scrollToSessionId}
              onScrollComplete={() => setScrollToSessionId(null)}
            />
          </Animated.View>
        </GestureDetector>
      </View>
    </SafeAreaView>
  );
}