import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Slider, Typography, TimePicker } from '../../src/components/ui';
import { TagSelector } from '../../src/components/focus/TagSelector';
import { DateSelector, Timeline } from '../../src/components/journal';
import { FruitCounter } from '../../src/components/rewards';
import { calculateFruitsEarnedForDuration, useFocus, useFocusActions } from '../../src/store';
import { isToday } from '../../src/utils/dateUtils';
import { FocusSession } from '../../src/types/models';
import { showToast } from '../../src/components/ui/Toast';

export default function JournalScreen() {
  const params = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollToSessionId, setScrollToSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);
  const [adjustedDuration, setAdjustedDuration] = useState(0);
  const { sessions, tags } = useFocus();
  const { adjustSessionDuration, deleteSession, createCompletedSession } = useFocusActions();

  // Manual Entry State
  const [isManualEntryModalVisible, setIsManualEntryModalVisible] = useState(false);
  const [manualStartTime, setManualStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - 25);
    return d;
  });
  const [manualEndTime, setManualEndTime] = useState(new Date());
  const [manualTag, setManualTag] = useState<string>('');
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);

  // Shake animation for manual entry modal
  const manualEntryShakeX = useSharedValue(0);
  const manualEntryShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: manualEntryShakeX.value }],
  }));
  const triggerManualEntryShake = useCallback(() => {
    manualEntryShakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [manualEntryShakeX]);

  const openManualEntryModal = () => {
    const now = new Date();
    const twentyFiveMinAgo = new Date(now.getTime() - 25 * 60 * 1000);

    // Find the latest session endTime that falls before "now" (any date)
    let latestEndTime: Date | null = null;
    (sessions.allIds || []).forEach(id => {
      const session = sessions.byId?.[id];
      if (!session?.endTime) return;
      const end = new Date(session.endTime);
      if (end <= now && (!latestEndTime || end > latestEndTime)) {
        latestEndTime = end;
      }
    });

    // Use whichever is later: last session end or 25 min ago (avoid overlap)
    const start = latestEndTime && latestEndTime > twentyFiveMinAgo
      ? latestEndTime
      : twentyFiveMinAgo;

    setManualStartTime(start);
    setManualEndTime(now);
    setManualTag('');
    setManualEntryError(null);
    setIsManualEntryModalVisible(true);
  };

  const closeManualEntryModal = () => {
    setIsManualEntryModalVisible(false);
  };

  const handleManualEntrySave = () => {
    if (!manualTag) {
      setManualEntryError('Please select a tag');
      return;
    }

    const finalStart = new Date(selectedDate);
    finalStart.setHours(manualStartTime.getHours(), manualStartTime.getMinutes(), 0, 0);

    const finalEnd = new Date(selectedDate);
    finalEnd.setHours(manualEndTime.getHours(), manualEndTime.getMinutes(), 0, 0);

    if (finalEnd <= finalStart) {
      setManualEntryError('End time must be after start time');
      return;
    }

    // Check overlap with existing sessions
    const newStart = finalStart.getTime();
    const newEnd = finalEnd.getTime();
    const hasOverlap = (sessions.allIds || []).some(id => {
      const session = sessions.byId?.[id];
      if (!session?.startTime || !session?.endTime) return false;
      const existingStart = new Date(session.startTime).getTime();
      const existingEnd = new Date(session.endTime).getTime();
      return newStart < existingEnd && existingStart < newEnd;
    });

    if (hasOverlap) {
      setManualEntryError('Time overlaps with another focus session');
      triggerManualEntryShake();
      showToast('Time overlaps with another focus session', 'error');
      return;
    }

    const duration = Math.round((finalEnd.getTime() - finalStart.getTime()) / (1000 * 60));

    createCompletedSession({
      startTime: finalStart,
      endTime: finalEnd,
      duration: duration,
      targetDuration: duration,
      tagId: manualTag,
      isManualEntry: true,
    });

    closeManualEntryModal();
  };

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

  // Current time for the timeline indicator
  const currentTime = new Date();

  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const isSwiping = useSharedValue(false);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const showJumpToToday = !isToday(selectedDate);

  const handleJumpToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

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

  const insets = useSafeAreaInsets();

  // Format header date like "May 05, Today"
  const headerDateString = useMemo(() => {
    const month = selectedDate.toLocaleDateString('en-US', { month: 'long' });
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const todayDate = new Date();
    const suffix = isToday(selectedDate) ? ', Today' : '';
    return `${month} ${day}${suffix}`;
  }, [selectedDate]);

  const selectedActualDuration = selectedSession?.actualDuration ?? selectedSession?.duration ?? 0;
  const selectedInitialDuration = selectedSession?.initialSetDuration ?? selectedSession?.duration ?? 0;
  const selectedTargetDuration = selectedSession?.initialSetDuration ?? selectedSession?.duration ?? 0;
  const isManual = selectedSession?.isManualEntry;
  const currentFruits = isManual ? 0 : calculateFruitsEarnedForDuration(
    selectedSession?.adjustedDuration ?? selectedSession?.duration ?? 0,
    selectedTargetDuration
  );
  const adjustedFruits = isManual ? 0 : calculateFruitsEarnedForDuration(adjustedDuration, selectedTargetDuration);
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
          tagId: session.tagId || '',
          notes: session.notes,
          isManualEntry: session.isManualEntry,
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
    <View className="flex-1 bg-dark-bg" style={{ paddingTop: insets.top }}>
      <StatusBar variant="dark" />

      {/* Header + Date Selector */}
      <View style={{ backgroundColor: '#1B1C30' }} className="border-b border-dark-border">
        {/* Header row */}
        <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
          <Typography variant="headline-20" color="white" style={{ fontWeight: '700' }}>
            {headerDateString}
          </Typography>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Pressable
              onPress={openManualEntryModal}
              className="w-9 h-9 items-center justify-center rounded-lg active:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              accessibilityLabel="Add manual focus session"
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Week strip */}
        <DateSelector
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      </View>

      <View className="flex-1">

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

        {/* Jump to Today floating button */}
        {showJumpToToday && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={{
              position: 'absolute',
              bottom: 24,
              right: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5,
            }}
          >
            <Pressable
              onPress={handleJumpToToday}
              className="flex-row items-center bg-[#6592E9] rounded-full px-4 py-2.5 active:opacity-80"
            >
              <Ionicons name="today-outline" size={18} color="#fff" />
              <Typography variant="subtitle-14-semibold" color="white" className="ml-1.5">
                Today
              </Typography>
            </Pressable>
          </Animated.View>
        )}
      </View>

      <Modal isVisible={!!selectedSession} onClose={closeSessionModal} size="medium">
        {selectedSession && (
          <View>
            <Typography variant="headline-20" color="white" className="mb-1">
              {isManual ? 'Focus Session (Manual)' : 'Focus Session'}
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

            {!isManual ? (
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
            ) : (
              <View className="bg-[#2A2B42] rounded-xl p-4 mb-5 flex-row items-start">
                <Ionicons name="information-circle-outline" size={20} color="#6592E9" className="mr-2" />
                <Typography variant="body-12" color="secondary" className="flex-1 ml-2">
                  No fruits are associated with Manual Focus sessions.
                </Typography>
              </View>
            )}

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

      {/* Manual Entry Modal */}
      <Modal isVisible={isManualEntryModalVisible} onClose={closeManualEntryModal} size="large">
        <Animated.View style={manualEntryShakeStyle}>
          <Typography variant="headline-20" color="white" className="mb-4">
            Add Focus Session
          </Typography>

          <View className="mb-5">
            <Typography variant="subtitle-14-medium" color="white" className="mb-2">
              Time Range (for {selectedDate.toLocaleDateString()})
            </Typography>
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-2">
                <TimePicker
                  value={manualStartTime}
                  onChange={setManualStartTime}
                  label="Start Time"
                />
              </View>
              <View className="flex-1 ml-2">
                <TimePicker
                  value={manualEndTime}
                  onChange={setManualEndTime}
                  label="End Time"
                />
              </View>
            </View>
            
            <Typography variant="subtitle-14-medium" color="white" className="mb-2 mt-2">
              Tag
            </Typography>
            <View className="mb-4">
              <TagSelector
                tags={tags.allIds.map(id => tags.byId[id]).filter(Boolean)}
                selectedTags={manualTag ? [manualTag] : []}
                onTagSelect={setManualTag}
                maxSelections={1}
              />
            </View>

            {manualEntryError && (
              <Typography variant="body-14" color="error" className="mb-4">
                {manualEntryError}
              </Typography>
            )}

            <View className="bg-[#2A2B42] rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <Ionicons name="information-circle-outline" size={20} color="#6592E9" className="mr-2" />
                <Typography variant="body-12" color="secondary" className="flex-1 ml-2">
                  Sessions added manually do not grant fruit bonuses and are for tracking purposes only.
                </Typography>
              </View>
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={closeManualEntryModal}
                className="flex-1 bg-gray-700 rounded-xl py-3 items-center justify-center active:opacity-80"
              >
                <Typography variant="subtitle-14-semibold" color="white">
                  Cancel
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleManualEntrySave}
                className="flex-1 bg-[#6592E9] rounded-xl py-3 items-center justify-center active:opacity-80"
              >
                <Typography variant="subtitle-14-semibold" color="white">
                  Save Session
                </Typography>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}
