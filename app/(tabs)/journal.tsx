import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, SafeAreaView, Pressable, useWindowDimensions } from 'react-native';
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
import { Modal, Slider, Typography } from '../../src/components/ui';
import { DateSelector, Timeline } from '../../src/components/journal';
import { FruitCounter } from '../../src/components/rewards';
import { calculateFruitsEarnedForDuration, useFocus, useFocusActions } from '../../src/store';
import { generateExtendedWeekDates } from '../../src/utils/dateUtils';
import { FocusSession } from '../../src/types/models';

export default function JournalScreen() {
  const params = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollToSessionId, setScrollToSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);
  const [adjustedDuration, setAdjustedDuration] = useState(0);
  const { sessions } = useFocus();
  const { adjustSessionDuration, deleteSession } = useFocusActions();

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

  const handleSessionPress = (sessionId: string) => {
    const session = sessions.byId[sessionId];
    if (!session) return;
    const actualDuration = session.actualDuration ?? session.duration;
    const currentAdjustedDuration = session.adjustedDuration ?? session.duration;
    setSelectedSession(session);
    setAdjustedDuration(Math.max(0, Math.min(actualDuration, currentAdjustedDuration)));
  };

  const closeSessionModal = () => {
    setSelectedSession(null);
  };

  const handleSessionDone = () => {
    if (selectedSession) {
      adjustSessionDuration(selectedSession.id, adjustedDuration);
    }
    closeSessionModal();
  };

  const handleSessionDelete = () => {
    if (selectedSession) {
      deleteSession(selectedSession.id);
    }
    closeSessionModal();
  };

  const formatDuration = (minutes: number) => {
    const roundedMinutes = Math.max(0, Math.round(minutes));
    const h = Math.floor(roundedMinutes / 60);
    const m = roundedMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const selectedActualDuration = selectedSession?.actualDuration ?? selectedSession?.duration ?? 0;
  const selectedInitialDuration = selectedSession?.initialSetDuration ?? selectedSession?.duration ?? 0;
  const selectedTargetDuration = selectedSession?.initialSetDuration ?? selectedSession?.duration ?? 0;
  const currentFruits = calculateFruitsEarnedForDuration(
    selectedSession?.adjustedDuration ?? selectedSession?.duration ?? 0,
    selectedTargetDuration
  );
  const adjustedFruits = calculateFruitsEarnedForDuration(adjustedDuration, selectedTargetDuration);
  const fruitDelta = adjustedFruits - currentFruits;

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
        const adjustedSessionDuration = session.adjustedDuration ?? session.duration;
        
        return {
          ...session,
          startTime: new Date(session.startTime),
          endTime: new Date(session.endTime),
          duration: adjustedSessionDuration,
          initialSetDuration: session.initialSetDuration ?? session.duration,
          actualDuration: session.actualDuration ?? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60)),
          adjustedDuration: adjustedSessionDuration,
          tagName: session.tagName || '',
          notes: session.notes,
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

      <Modal isVisible={!!selectedSession} onClose={closeSessionModal} size="medium">
        {selectedSession && (
          <View>
            <Typography variant="headline-20" color="white" className="mb-1">
              Focus Session
            </Typography>

            <Typography variant="body-14" color="secondary" className="mb-5">
              {formatTime(selectedSession.startTime)} - {formatTime(selectedSession.endTime)}
            </Typography>

            <View className="mb-5">
              <Slider
                value={adjustedDuration}
                minimumValue={0}
                maximumValue={Math.max(1, selectedActualDuration)}
                step={1}
                onValueChange={setAdjustedDuration}
                width={Math.min(screenWidth - 96, 320)}
              />
              <View className="items-center mt-2">
                <Typography variant="body-14" color="secondary">
                  Adjusted duration: {formatDuration(adjustedDuration)}
                </Typography>
              </View>
            </View>

            <View className="bg-gray-700 rounded-xl p-4 mb-5">
              <View className="flex-row items-center justify-between">
                <Typography variant="body-12" color="secondary">
                  Fruits after adjustment
                </Typography>
                <FruitCounter fruitCount={adjustedFruits} size="small" />
              </View>
              {fruitDelta !== 0 && (
                <Typography
                  variant="body-12"
                  color={fruitDelta > 0 ? 'success' : 'error'}
                  className="mt-2"
                >
                  {fruitDelta > 0 ? '+' : ''}{fruitDelta} fruit change
                </Typography>
              )}
            </View>

            {selectedSession.notes && (
              <View className="bg-gray-700 rounded-xl p-4 mb-5">
                <Typography variant="body-12" color="secondary" className="mb-1">
                  Notes
                </Typography>
                <Typography variant="body-14" color="white">
                  {selectedSession.notes}
                </Typography>
              </View>
            )}

            <View className="flex-row gap-3">
              <Pressable
                onPress={handleSessionDelete}
                className="flex-1 rounded-xl py-3 items-center justify-center active:opacity-80"
              >
                <Typography variant="subtitle-14-semibold" style={{ color: '#EF4444' }}>
                  Delete
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleSessionDone}
                className="flex-1 bg-white rounded-xl py-3 items-center active:opacity-80"
              >
                <Typography variant="subtitle-14-semibold" style={{ color: '#1B1C30' }}>
                  Done
                </Typography>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}
