import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Pressable, useWindowDimensions, TextInput, Image, useColorScheme, ActivityIndicator, Alert, Linking, Keyboard } from 'react-native';
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
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Slider, Typography, TimePicker, DatePicker } from '../../src/components/ui';
import { HorizontalTagSelector } from '../../src/components/focus/TagSelector';
import { CreateTagModal } from '../../src/components/focus';
import { DateSelector, Timeline, ThreeDayTimeline, TodoSheet } from '../../src/components/journal';
import { TodoEditModal } from '../../src/components/journal/TodoSheet/TodoEditModal';
import { TodoDragGhost } from '../../src/components/journal/TodoSheet/TodoDragGhost';
import { useTodoScheduleController } from '../../src/components/journal/TodoSheet/TodoScheduleController';
import { FruitCounter } from '../../src/components/rewards';
import { calculateFruitsEarnedForDuration, useFocus, useFocusActions, useAppStore, useTodos, useTodoActions } from '../../src/store';
import type { Todo } from '../../src/store/types';
import type { ChallengeItem } from '../../src/services/grove/GroveChallengeService';
import { showToast } from '../../src/components/ui/Toast';
import { isToday } from '../../src/utils/dateUtils';
import { fruitsForRating, RATING_FRUIT_MULTIPLIER } from '../../src/utils/focusRating';
import { FocusSession } from '../../src/types/models';
import { saveSessionPhoto, uploadSessionPhoto, deleteSessionPhoto } from '../../src/services/sessionPhotoService';
import { EmptyState } from '../../src/components/ui/EmptyState/EmptyState';
import { useSecondaryTagEnabled } from '../../src/hooks/useSecondaryTagEnabled';
import { isDevUser } from '../../src/config/devUsers';
import { useTranslation } from 'react-i18next';


export default function JournalScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollToSessionId, setScrollToSessionId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<FocusSession | null>(null);
  const [adjustedDuration, setAdjustedDuration] = useState(0);
  const { sessions, tags } = useFocus();
  const { adjustSessionDuration, deleteSession, createCompletedSession, updateSession } = useFocusActions();
  const secondaryTagEnabled = useSecondaryTagEnabled();

  // Which calendar is showing: the single-day Sessions timeline or the 3-day
  // TODOs planner. Dragging a todo out of the sheet force-switches to TODOs.
  const [journalView, setJournalView] = useState<'sessions' | 'todos'>('sessions');

  // TODO scheduling — drag from the sheet onto the calendar + tap-to-edit blocks.
  const todosState = useTodos();
  const { updateTodo } = useTodoActions();
  const [calendarEditTodo, setCalendarEditTodo] = useState<Todo | null>(null);
  const [calendarEditVisible, setCalendarEditVisible] = useState(false);
  const openTodoEditor = useCallback((todo: Todo) => {
    setCalendarEditTodo(todo);
    setCalendarEditVisible(true);
  }, []);
  const switchToTodosView = useCallback(() => setJournalView('todos'), []);
  const schedule = useTodoScheduleController({
    selectedDate,
    updateTodo,
    onEditTodo: openTodoEditor,
    onDragStart: switchToTodosView,
  });
  // Timed todos falling in the TODOs view's 3-day window (selected date + 2).
  const scheduledTodosForRange = useMemo(() => {
    const rangeStart = new Date(selectedDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeEnd.getDate() + 3);
    return todosState.allIds
      .map((id) => todosState.byId[id])
      .filter(
        (td): td is Todo =>
          !!td &&
          !td.deletedAt &&
          !!td.startAt &&
          // Only timed todos appear on the calendar; date-only ones (startHasTime
          // explicitly false) stay in the sheet's day sections but off the timeline.
          td.startHasTime !== false &&
          new Date(td.startAt) >= rangeStart &&
          new Date(td.startAt) < rangeEnd
      );
  }, [todosState, selectedDate]);

  // Manual Entry State
  const [isManualEntryModalVisible, setIsManualEntryModalVisible] = useState(false);
  const [manualStartTime, setManualStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - 25);
    return d;
  });
  const [manualEndTime, setManualEndTime] = useState(new Date());
  const [manualDate, setManualDate] = useState(new Date());
  const [manualTag, setManualTag] = useState<string>('');
  const [manualSecondaryTag, setManualSecondaryTag] = useState<string>('');
  // Which tag field a newly created tag should populate (drives CreateTagModal).
  const [createTagTarget, setCreateTagTarget] = useState<
    null | 'manual' | 'manualSecondary' | 'editSecondary'
  >(null);
  const [manualNotes, setManualNotes] = useState('');
  const [manualPhotoUri, setManualPhotoUri] = useState<string | null>(null);
  const [manualEntryError, setManualEntryError] = useState<string | null>(null);
  const [isManualSaving, setIsManualSaving] = useState(false);

  // Edit session state (notes + photo + secondary tag for existing sessions)
  const [editNotes, setEditNotes] = useState('');
  const [editSecondaryTag, setEditSecondaryTag] = useState<string>('');
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [editFocusRating, setEditFocusRating] = useState<number | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);

  const colorScheme = useColorScheme();

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

    // Use whichever is later: last session end + 1 minute or 25 min ago (avoid overlap)
    const start = latestEndTime && latestEndTime >= twentyFiveMinAgo
      ? new Date(latestEndTime.getTime() + 60 * 1000)
      : twentyFiveMinAgo;

    setManualStartTime(start);
    setManualEndTime(now);
    setManualDate(selectedDate);
    setManualTag('');
    setManualSecondaryTag('');
    setManualNotes('');
    setManualPhotoUri(null);
    setManualEntryError(null);
    setIsManualEntryModalVisible(true);
  };

  const closeManualEntryModal = () => {
    setIsManualEntryModalVisible(false);
  };

  const handleManualEntrySave = async () => {
    if (!manualTag) {
      setManualEntryError(t('journal.errSelectTag'));
      return;
    }

    const finalStart = new Date(manualDate);
    finalStart.setHours(manualStartTime.getHours(), manualStartTime.getMinutes(), 0, 0);

    const finalEnd = new Date(manualDate);
    finalEnd.setHours(manualEndTime.getHours(), manualEndTime.getMinutes(), 0, 0);

    if (finalEnd <= finalStart) {
      setManualEntryError(t('journal.errStartBeforeEnd'));
      triggerManualEntryShake();
      return;
    }

    // Check if end time is in the future
    const now = new Date();
    if (finalEnd > now) {
      setManualEntryError(t('journal.errFuture'));
      triggerManualEntryShake();
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

    // Overlapping with an existing session is allowed but discouraged — warn
    // and let the user proceed or back out (mirrors the discard-changes prompt).
    if (hasOverlap) {
      Alert.alert(t('journal.overlapWarnTitle'), t('journal.overlapWarnMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('journal.overlapProceed'),
          style: 'destructive',
          onPress: () => {
            void persistManualEntry(finalStart, finalEnd);
          },
        },
      ]);
      return;
    }

    await persistManualEntry(finalStart, finalEnd);
  };

  // Writes the manual session to the store (plus optional photo) and closes the
  // modal. Split out of handleManualEntrySave so the overlap-warning "Proceed"
  // path can reuse the exact same save flow.
  const persistManualEntry = async (finalStart: Date, finalEnd: Date) => {
    const duration = Math.round((finalEnd.getTime() - finalStart.getTime()) / (1000 * 60));

    setIsManualSaving(true);

    const createdSession = createCompletedSession({
      startTime: finalStart,
      endTime: finalEnd,
      duration: duration,
      targetDuration: duration,
      tagId: manualTag,
      secondaryTagId: manualSecondaryTag || undefined,
      notes: manualNotes.trim() || undefined,
      isManualEntry: true,
    });

    // Upload photo if one was selected
    if (manualPhotoUri && createdSession) {
      try {
        // Save locally first (fast, works offline)
        const photoUrl = await saveSessionPhoto(manualPhotoUri, createdSession.id);
        updateSession(createdSession.id, { photoUrl });

        // Upload to Supabase for feed visibility, update to cloud URL on success
        try {
          const cloudUrl = await uploadSessionPhoto(manualPhotoUri, createdSession.id);
          updateSession(createdSession.id, { photoUrl: cloudUrl });
        } catch (uploadError) {
          console.warn('Failed to upload photo to cloud (local copy saved):', uploadError);
        }
      } catch (error) {
        console.error('Failed to save session photo:', error);
        showToast(t('journal.failedSavePhoto'), 'error');
      }
    }

    setIsManualSaving(false);

    // Navigate the journal calendar to the session's date so the user can see it
    setSelectedDate(new Date(manualDate));
    closeManualEntryModal();
  };

  // Expand the TODO sheet when arriving from the TODO Home Screen widget. The
  // param carries a timestamp so each widget tap produces a fresh signal value.
  const [todoExpandSignal, setTodoExpandSignal] = useState<string | null>(null);
  useEffect(() => {
    if (params.expandTodos) {
      setTodoExpandSignal(String(params.expandTodos));
      router.setParams({ expandTodos: undefined });
    }
  }, [params.expandTodos]);

  // Open the new-TODO modal when arriving from the widget's "+" button.
  const [todoCreateSignal, setTodoCreateSignal] = useState<string | null>(null);
  useEffect(() => {
    if (params.newTodo) {
      setTodoCreateSignal(String(params.newTodo));
      router.setParams({ newTodo: undefined });
    }
  }, [params.newTodo]);

  // Handle navigation from session creation
  useEffect(() => {
    if (params.sessionId && params.sessionDate) {
      const sessionDate = new Date(params.sessionDate as string);
      setSelectedDate(sessionDate);
      setScrollToSessionId(params.sessionId as string);
      setJournalView('sessions');
      
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

  const pickImage = async (
    source: 'library' | 'camera',
    onPicked: (uri: string) => void
  ) => {
    try {
      // Request appropriate permission first
      const permissionResult =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          t('journal.permissionTitle'),
          source === 'camera'
            ? t('journal.permissionBodyCamera')
            : t('journal.permissionBodyLibrary'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('journal.openSettings'), onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets[0]) {
        onPicked(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  };

  const handleSessionPress = (sessionId: string) => {
    const session = sessions.byId[sessionId];
    if (!session) return;
    const actualDuration = session.actualDuration ?? session.duration;
    const currentAdjustedDuration = session.adjustedDuration ?? session.duration;
    setSelectedSession(session);
    setAdjustedDuration(Math.max(0, Math.min(actualDuration, currentAdjustedDuration)));
    setEditNotes(session.notes ?? '');
    setEditSecondaryTag(session.secondaryTagId ?? '');
    setEditPhotoUri(null);
    setEditFocusRating(session.focusRating ?? null);
  };

  const closeSessionModal = () => {
    setSelectedSession(null);
  };

  const handleSessionDone = async () => {
    if (!selectedSession) return;

    setIsEditSaving(true);

    adjustSessionDuration(selectedSession.id, adjustedDuration);

    // Save notes if changed
    const trimmedNotes = editNotes.trim();
    if (trimmedNotes !== (selectedSession.notes ?? '')) {
      updateSession(selectedSession.id, { notes: trimmedNotes || undefined });
    }

    // Save secondary tag if changed. updateSession doesn't recompute challenges,
    // so do it here for both the old and new secondary tag (either may gain/lose
    // this session's contribution).
    const prevSecondary = selectedSession.secondaryTagId ?? '';
    const nextSecondary = editSecondaryTag || '';
    if (nextSecondary !== prevSecondary) {
      updateSession(selectedSession.id, { secondaryTagId: nextSecondary || undefined });
      [prevSecondary, nextSecondary].forEach(tagId => {
        if (tagId && tagId !== selectedSession.tagId) {
          recomputeChallengeHitsForTag(tagId).catch(() => {});
        }
      });
    }

    // Upload photo if selected and session doesn't already have a photo
    if (editPhotoUri && !selectedSession.photoUrl) {
      try {
        // Save locally first (fast, works offline)
        const photoUrl = await saveSessionPhoto(editPhotoUri, selectedSession.id);
        updateSession(selectedSession.id, { photoUrl });

        // Upload to Supabase for feed visibility, update to cloud URL on success
        try {
          const cloudUrl = await uploadSessionPhoto(editPhotoUri, selectedSession.id);
          updateSession(selectedSession.id, { photoUrl: cloudUrl });
        } catch (uploadError) {
          console.warn('Failed to upload photo to cloud (local copy saved):', uploadError);
        }
      } catch (error) {
        console.error('Failed to save session photo:', error);
        showToast(t('journal.failedSavePhoto'), 'error');
      }
    }

    setIsEditSaving(false);
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
    const dateStr = selectedDate.toLocaleDateString(i18n.language, {
      month: 'long',
      day: 'numeric',
    });
    const suffix = isToday(selectedDate) ? t('journal.todaySuffix') : '';
    return `${dateStr}${suffix}`;
  }, [selectedDate, i18n.language, t]);

  const selectedActualDuration = selectedSession?.actualDuration ?? selectedSession?.duration ?? 0;
  const selectedInitialDuration = selectedSession?.initialSetDuration ?? selectedSession?.duration ?? 0;
  const selectedTargetDuration = selectedSession?.initialSetDuration ?? selectedSession?.duration ?? 0;
  const isManual = selectedSession?.isManualEntry;
  // Sync banner state (hooks must be called unconditionally)
  const syncBannerUserId = useAppStore((s) => s.auth.user?.id);
  const syncStatus = useAppStore((s) => s.sync.syncStatus);
  const syncError = useAppStore((s) => s.sync.syncError);
  const offlineQueueSize = useAppStore((s) => s.sync.offlineQueueSize);
  const syncIsSyncing = useAppStore((s) => s.sync.isSyncing);
  const flushOfflineQueue = useAppStore((s) => s.sync.flushOfflineQueue);

  const challenges = useAppStore((s) => s.grove.challenges);
  const recomputeChallengeHitsForTag = useAppStore((s) => s.grove.recomputeChallengeHitsForTag);

  // Resolve tag name for the selected session (handles challenge/shared tags)
  const selectedSessionTag = selectedSession?.tagId ? tags.byId[selectedSession.tagId] : null;
  const selectedSessionChallengeTag = !selectedSessionTag && selectedSession?.tagId
    ? challenges.find((c: ChallengeItem) => c.tagId === selectedSession.tagId)
    : null;
  const selectedSessionTagName = selectedSessionTag?.name
    || selectedSessionChallengeTag?.tagName
    || null;
  const fallbackAccelerateMultiplier = useAppStore((s) => s.rewards.isAccelerateActive()) ? 2 : 1;
  const selectedAccelerateMultiplier = selectedSession?.accelerateMultiplier ?? fallbackAccelerateMultiplier;
  const selectedCurrentDuration = selectedSession?.adjustedDuration ?? selectedSession?.duration ?? 0;
  const currentBaseFruits = isManual ? 0 : calculateFruitsEarnedForDuration(
    selectedCurrentDuration,
    selectedTargetDuration,
    selectedAccelerateMultiplier
  );
  const adjustedBaseFruits = isManual ? 0 : calculateFruitsEarnedForDuration(
    adjustedDuration,
    selectedTargetDuration,
    selectedAccelerateMultiplier
  );
  const currentFruits = isManual
    ? 0
    : selectedSession?.awardedFruits ??
      (selectedSession?.focusRating != null
        ? fruitsForRating(currentBaseFruits, selectedSession.focusRating)
        : currentBaseFruits);
  const adjustedFruits = isManual
    ? 0
    : editFocusRating != null
      ? fruitsForRating(adjustedBaseFruits, editFocusRating)
      : adjustedBaseFruits;
  const fruitDelta = adjustedFruits - currentFruits;
  const ratingRewardPercent = editFocusRating != null
    ? Math.round((RATING_FRUIT_MULTIPLIER[editFocusRating] ?? 1) * 100)
    : 100;

  // Convert store sessions to component format and filter for selected date
  const hasAnySessions = sessions?.allIds?.length > 0;

  const sessionsForSelectedDate = useMemo(() => {
    // Safety check to handle undefined sessions
    if (!sessions || !sessions.allIds || !sessions.byId) {
      console.warn('Sessions data is not properly initialized:', sessions);
      return [];
    }

    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

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
      .filter((session): session is NonNullable<typeof session> => session !== null)
      // Show the session on every day its time range overlaps, not just its
      // start day — a cross-midnight session appears on both days.
      .filter(session => session.startTime < dayEnd && session.endTime > dayStart)
      // Clip cross-midnight sessions to the selected day so each day renders
      // only its own portion (top position and block height stay in bounds).
      .map(session => {
        if (session.startTime >= dayStart && session.endTime <= dayEnd) return session;
        const clippedStart = session.startTime < dayStart ? dayStart : session.startTime;
        const clippedEnd = session.endTime > dayEnd ? dayEnd : session.endTime;
        return {
          ...session,
          startTime: clippedStart,
          endTime: clippedEnd,
          duration: Math.round((clippedEnd.getTime() - clippedStart.getTime()) / (1000 * 60)),
        };
      });
  }, [sessions, selectedDate]);


  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg" style={{ paddingTop: insets.top }}>
      {/* Global Empty State — covers entire tab when user has no sessions at all */}
      {!hasAnySessions && (
        <View className="flex-1">
          <EmptyState
            icon="leaf-outline"
            iconColor="#51BC6F"
            title={t('journal.emptyTitle')}
            description={t('journal.emptyDesc')}
            buttonLabel={t('journal.emptyButton')}
            onButtonPress={() => router.push('/(tabs)')}
          />
        </View>
      )}

      {/* Normal journal UI — header, date carousel, timeline */}
      {hasAnySessions && (
        <>
          {/* Header + Date Selector */}
          <View className="bg-light-bg dark:bg-dark-bg border-b border-light-border dark:border-dark-border">
            {/* Header row */}
            <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
              <Typography variant="headline-20" color="primary" style={{ fontWeight: '700' }}>
                {headerDateString}
              </Typography>
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Pressable
                  onPress={openManualEntryModal}
                  className="w-9 h-9 items-center justify-center rounded-lg active:opacity-80 bg-black/10 dark:bg-white/10"
                  accessibilityLabel={t('journal.addManualA11y')}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {/* View switcher: Sessions (single-day) / TODOs (3-day planner) */}
            <View className="px-4 pb-2">
              <View className="flex-row self-start rounded-full p-1 bg-black/10 dark:bg-white/10">
                {(
                  [
                    { key: 'sessions', label: t('journal.viewSessions') },
                    { key: 'todos', label: t('todos.title') },
                  ] as const
                ).map(({ key, label }) => {
                  const active = journalView === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setJournalView(key)}
                      className={`rounded-full px-4 py-1.5 active:opacity-80 ${active ? 'bg-primary' : ''}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Typography
                        variant="subtitle-14-semibold"
                        color={active ? 'white' : 'secondary'}
                      >
                        {label}
                      </Typography>
                    </Pressable>
                  );
                })}
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
                {journalView === 'sessions' ? (
                  <Timeline
                    sessions={sessionsForSelectedDate}
                    currentTime={currentTime}
                    isToday={!showJumpToToday}
                    onSessionPress={handleSessionPress}
                    scrollToSessionId={scrollToSessionId}
                    onScrollComplete={() => setScrollToSessionId(null)}
                  />
                ) : (
                  <ThreeDayTimeline
                    startDate={selectedDate}
                    todos={scheduledTodosForRange}
                    currentTime={currentTime}
                    schedule={schedule}
                    onTodoPress={openTodoEditor}
                    onTodoReschedule={schedule.rescheduleTodo}
                  />
                )}
              </Animated.View>
            </GestureDetector>

            {/* Jump to Today floating button */}
            {showJumpToToday && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(200)}
                style={{
                  position: 'absolute',
                  bottom: 12,
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
                  className="flex-row items-center rounded-full px-4 py-2.5 active:opacity-80"
                  style={{ backgroundColor: 'rgba(101, 146, 233, 0.5)' }}
                >
                  <Ionicons name="today-outline" size={18} color="#fff" />
                  <Typography variant="subtitle-14-semibold" color="white" className="ml-1.5">
                    {t('journal.backToToday')}
                  </Typography>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </>
      )}

      {/* Sync Status Banner (dev-only) */}
      {isDevUser(syncBannerUserId) && (() => {
        let bannerBg = 'bg-green-800/80';
        let bannerText = 'All sessions synced';
        let bannerTextColor = '#4ADE80';
        let showRetry = false;
        let showSpinner = false;

        if (syncIsSyncing || syncStatus === 'syncing') {
          bannerBg = 'bg-gray-700/80';
          bannerText = 'Syncing...';
          bannerTextColor = '#D1D5DB';
          showSpinner = true;
        } else if (syncStatus === 'error') {
          bannerBg = 'bg-red-900/80';
          bannerText = syncError || 'Sync error';
          bannerTextColor = '#FCA5A5';
          showRetry = true;
        } else if (offlineQueueSize > 0) {
          bannerBg = 'bg-amber-800/80';
          bannerText = `${offlineQueueSize} session${offlineQueueSize === 1 ? '' : 's'} pending sync`;
          bannerTextColor = '#FCD34D';
        }

        return (
          <View className={`${bannerBg} px-4 py-2 flex-row items-center justify-between`} style={{ paddingBottom: insets.bottom + 8 }}>
            <View className="flex-row items-center flex-1">
              {showSpinner && <ActivityIndicator size="small" color={bannerTextColor} style={{ marginRight: 8 }} />}
              <Typography variant="body-12" style={{ color: bannerTextColor }} className="flex-1">
                {bannerText}
              </Typography>
            </View>
            {showRetry && (
              <Pressable onPress={flushOfflineQueue} className="ml-3 px-3 py-1 rounded-md bg-white/20 active:opacity-70">
                <Typography variant="body-12" style={{ color: '#FCA5A5', fontWeight: '600' }}>
                  Retry
                </Typography>
              </Pressable>
            )}
          </View>
        );
      })()}

      <Modal isVisible={!!selectedSession} onClose={closeSessionModal} size="medium">
        {selectedSession && (
          <Pressable onPress={Keyboard.dismiss} accessible={false}>
            <Typography variant="headline-20" color="primary" className="mb-1">
              {selectedSessionTagName
                ? (isManual ? `${selectedSessionTagName} ${t('journal.manualSuffix')}` : selectedSessionTagName)
                : (isManual ? `${t('journal.focusSession')} ${t('journal.manualSuffix')}` : t('journal.focusSession'))}
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
                  {t('journal.adjustedDuration', { duration: formatDuration(adjustedDuration) })}
                </Typography>
              </View>
            </View>

            {!isManual ? (
              <View className="bg-light-border/30 dark:bg-gray-700 rounded-xl p-4 mb-5">
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Typography variant="body-12" color="secondary">
                      {t('journal.focusRating', { defaultValue: 'Focus rating' })}
                    </Typography>
                    <Typography variant="body-12" color="secondary">
                      {editFocusRating != null
                        ? t('journal.ratingRewardPercent', {
                            defaultValue: '{{percent}}% reward',
                            percent: ratingRewardPercent,
                          })
                        : t('journal.unratedReward', { defaultValue: 'Full reward' })}
                    </Typography>
                  </View>
                  <View className="flex-row" style={{ gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((rating) => {
                      const filled = (editFocusRating ?? 0) >= rating;
                      return (
                        <Ionicons
                          key={rating}
                          name={filled ? 'star' : 'star-outline'}
                          size={28}
                          color={filled ? '#6592E9' : colorScheme === 'dark' ? '#4B5563' : '#D4C4A8'}
                        />
                      );
                    })}
                  </View>
                </View>
                <View className="flex-row items-center justify-between">
                  <Typography variant="body-12" color="secondary">
                    {t('journal.fruitsAfterAdjustment')}
                  </Typography>
                  <FruitCounter fruitCount={adjustedFruits} size="small" />
                </View>
                {fruitDelta !== 0 && (
                  <Typography
                    variant="body-12"
                    color={fruitDelta > 0 ? 'success' : 'error'}
                    className="mt-2"
                  >
                    {t('journal.fruitChange', { delta: `${fruitDelta > 0 ? '+' : ''}${fruitDelta}` })}
                  </Typography>
                )}
              </View>
            ) : (
              <View className="bg-light-border/30 dark:bg-[#2A2B42] rounded-xl p-4 mb-5 flex-row items-start">
                <Ionicons name="information-circle-outline" size={20} color="#6592E9" className="mr-2" />
                <Typography variant="body-12" color="secondary" className="flex-1 ml-2">
                  {t('journal.noFruitsManual')}
                </Typography>
              </View>
            )}

            {/* Optional secondary tag (premium Multi-Task mode) — two activities at once */}
            {secondaryTagEnabled && (
              <View className="mb-5">
                <Typography variant="body-12" color="secondary" className="mb-2">
                  {t('journal.secondaryTag')}
                </Typography>
                <HorizontalTagSelector
                  tags={tags.allIds.map(id => tags.byId[id]).filter(t => t && !t.deletedAt && t.id !== selectedSession.tagId)}
                  selectedTags={editSecondaryTag ? [editSecondaryTag] : []}
                  onTagSelect={(id) => setEditSecondaryTag(prev => (prev === id ? '' : id))}
                  maxSelections={1}
                  onCreateTag={() => setCreateTagTarget('editSecondary')}
                />
              </View>
            )}

            {/* Notes section */}
            <View className="mb-5">
              <Typography variant="body-12" color="secondary" className="mb-2">
                {t('journal.note')}
              </Typography>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder={t('journal.notePlaceholder')}
                placeholderTextColor="#666"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                style={{
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
                  minHeight: 60,
                }}
              />
            </View>

            {/* Photo section */}
            {selectedSession.photoUrl ? (
              <View className="mb-5">
                <Typography variant="body-12" color="secondary" className="mb-2">
                  {t('journal.photo')}
                </Typography>
                <Image
                  source={{ uri: selectedSession.photoUrl }}
                  style={{ width: '100%', height: 160, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={async () => {
                    try {
                      await deleteSessionPhoto(selectedSession.id);
                      updateSession(selectedSession.id, { photoUrl: undefined });
                      setSelectedSession({ ...selectedSession, photoUrl: undefined });
                    } catch (error) {
                      console.error('Failed to delete session photo:', error);
                    }
                  }}
                  className="mt-2 flex-row items-center justify-center rounded-xl py-2.5 active:opacity-70"
                  style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Typography variant="body-12" className="ml-1.5" style={{ color: '#DC2626' }}>
                    {t('journal.removePhoto')}
                  </Typography>
                </Pressable>
              </View>
            ) : (
              <View className="mb-5">
                <Typography variant="body-12" color="secondary" className="mb-2">
                  {t('journal.addPhoto')}
                </Typography>
                {editPhotoUri ? (
                  <View>
                    <Image
                      source={{ uri: editPhotoUri }}
                      style={{ width: '100%', height: 160, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => setEditPhotoUri(null)}
                      className="mt-2 flex-row items-center justify-center rounded-xl py-2.5 active:opacity-70"
                      style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Typography variant="body-12" className="ml-1.5" style={{ color: '#DC2626' }}>
                        {t('journal.removePhoto')}
                      </Typography>
                    </Pressable>
                  </View>
                ) : (
                  <View className="flex-row gap-x-3">
                    <Pressable
                      onPress={() => pickImage('library', setEditPhotoUri)}
                      className="flex-row items-center bg-primary/20 rounded-xl px-4 py-2.5 active:opacity-70"
                    >
                      <Ionicons name="images-outline" size={16} color="#6592E9" />
                      <Typography variant="body-12" className="text-primary ml-1.5">
                        {t('journal.library')}
                      </Typography>
                    </Pressable>
                    <Pressable
                      onPress={() => pickImage('camera', setEditPhotoUri)}
                      className="flex-row items-center bg-primary/20 rounded-xl px-4 py-2.5 active:opacity-70"
                    >
                      <Ionicons name="camera-outline" size={16} color="#6592E9" />
                      <Typography variant="body-12" className="text-primary ml-1.5">
                        {t('journal.camera')}
                      </Typography>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <View className="flex-row gap-3">
              <Pressable
                onPress={handleSessionDelete}
                disabled={isEditSaving}
                className="flex-1 rounded-xl py-3 items-center justify-center active:opacity-80"
              >
                <Typography variant="subtitle-14-semibold" style={{ color: '#EF4444' }}>
                  {t('common.delete')}
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleSessionDone}
                disabled={isEditSaving}
                className="flex-1 bg-white rounded-xl py-3 items-center active:opacity-80"
                style={{ opacity: isEditSaving ? 0.6 : 1 }}
              >
                {isEditSaving ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#1B1C30" />
                    <Typography variant="subtitle-14-semibold" style={{ color: '#1B1C30' }} className="ml-2">
                      {t('journal.saving')}
                    </Typography>
                  </View>
                ) : (
                  <Typography variant="subtitle-14-semibold" style={{ color: '#1B1C30' }}>
                    {t('common.done')}
                  </Typography>
                )}
              </Pressable>
            </View>
          </Pressable>
        )}
      </Modal>

      {/* Manual Entry Modal */}
      <Modal isVisible={isManualEntryModalVisible} onClose={closeManualEntryModal} size="large">
        <Pressable onPress={Keyboard.dismiss} accessible={false}>
        <Animated.View style={manualEntryShakeStyle}>
          <Typography variant="headline-20" color="primary" className="mb-4">
            {t('journal.addFocusSession')}
          </Typography>

          <View className="mb-5">
            <View className="mb-4">
              <DatePicker
                value={manualDate}
                onChange={setManualDate}
                label={t('journal.dateLabel')}
                maximumDate={new Date()}
              />
            </View>

            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('journal.timeRange')}
            </Typography>
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-2">
                <TimePicker
                  value={manualStartTime}
                  onChange={setManualStartTime}
                  label={t('journal.startTime')}
                />
              </View>
              <View className="flex-1 ml-2">
                <TimePicker
                  value={manualEndTime}
                  onChange={setManualEndTime}
                  label={t('journal.endTime')}
                />
              </View>
            </View>
            
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2 mt-2">
              {t('journal.tagLabel')}
            </Typography>
            <View className="mb-4">
              <HorizontalTagSelector
                tags={tags.allIds.map(id => tags.byId[id]).filter(t => t && !t.deletedAt)}
                selectedTags={manualTag ? [manualTag] : []}
                onTagSelect={(id) => {
                  setManualTag(id);
                  // Keep the two tags distinct: clear secondary if it now matches primary.
                  if (manualSecondaryTag === id) setManualSecondaryTag('');
                }}
                maxSelections={1}
                onCreateTag={() => setCreateTagTarget('manual')}
              />
            </View>

            {/* Optional secondary tag (premium Multi-Task mode) — two activities at once */}
            {secondaryTagEnabled && (
              <>
                <Typography variant="subtitle-14-medium" color="primary" className="mb-2 mt-2">
                  {t('journal.secondaryTag')}
                </Typography>
                <View className="mb-4">
                  <HorizontalTagSelector
                    tags={tags.allIds.map(id => tags.byId[id]).filter(t => t && !t.deletedAt && t.id !== manualTag)}
                    selectedTags={manualSecondaryTag ? [manualSecondaryTag] : []}
                    onTagSelect={(id) => setManualSecondaryTag(prev => (prev === id ? '' : id))}
                    maxSelections={1}
                    onCreateTag={() => setCreateTagTarget('manualSecondary')}
                  />
                </View>
              </>
            )}

            {/* Notes input */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2 mt-2">
              {t('journal.noteOptional')}
            </Typography>
            <TextInput
              value={manualNotes}
              onChangeText={setManualNotes}
              placeholder={t('journal.notePlaceholder')}
              placeholderTextColor="#666"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              style={{
                backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
                minHeight: 60,
                marginBottom: 16,
              }}
            />

            {/* Photo picker */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('journal.photoOptional')}
            </Typography>
            {manualPhotoUri ? (
              <View className="mb-4">
                <Image
                  source={{ uri: manualPhotoUri }}
                  style={{ width: '100%', height: 160, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => setManualPhotoUri(null)}
                  className="mt-2 flex-row items-center justify-center rounded-xl py-2.5 active:opacity-70"
                  style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Typography variant="body-12" className="ml-1.5" style={{ color: '#DC2626' }}>
                    {t('journal.removePhoto')}
                  </Typography>
                </Pressable>
              </View>
            ) : (
              <View className="flex-row gap-x-3 mb-4">
                <Pressable
                  onPress={() => pickImage('library', setManualPhotoUri)}
                  className="flex-row items-center bg-primary/20 rounded-xl px-4 py-2.5 active:opacity-70"
                >
                  <Ionicons name="images-outline" size={16} color="#6592E9" />
                  <Typography variant="body-12" className="text-primary ml-1.5">
                    Library
                  </Typography>
                </Pressable>
                <Pressable
                  onPress={() => pickImage('camera', setManualPhotoUri)}
                  className="flex-row items-center bg-primary/20 rounded-xl px-4 py-2.5 active:opacity-70"
                >
                  <Ionicons name="camera-outline" size={16} color="#6592E9" />
                  <Typography variant="body-12" className="text-primary ml-1.5">
                    Camera
                  </Typography>
                </Pressable>
              </View>
            )}

            {manualEntryError && (
              <Typography variant="body-14" color="error" className="mb-4">
                {manualEntryError}
              </Typography>
            )}

            <View className="bg-light-border/30 dark:bg-[#2A2B42] rounded-xl p-4 mb-6">
              <View className="flex-row items-start">
                <Ionicons name="information-circle-outline" size={20} color="#6592E9" className="mr-2" />
                <Typography variant="body-12" color="secondary" className="flex-1 ml-2">
                  {t('journal.manualInfo')}
                </Typography>
              </View>
            </View>

            <View className="flex-row gap-3">
              <Pressable
                onPress={closeManualEntryModal}
                disabled={isManualSaving}
                className="flex-1 bg-light-border/30 dark:bg-gray-700 rounded-xl py-3 items-center justify-center active:opacity-80"
              >
                <Typography variant="subtitle-14-semibold" color="primary">
                  {t('common.cancel')}
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleManualEntrySave}
                disabled={isManualSaving}
                className="flex-1 bg-[#6592E9] rounded-xl py-3 items-center justify-center active:opacity-80"
                style={{ opacity: isManualSaving ? 0.6 : 1 }}
              >
                {isManualSaving ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Typography variant="subtitle-14-semibold" color="white" className="ml-2">
                      {t('journal.saving')}
                    </Typography>
                  </View>
                ) : (
                  <Typography variant="subtitle-14-semibold" color="white">
                    {t('journal.saveSession')}
                  </Typography>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
        </Pressable>
      </Modal>

      {/* TODOs — draggable peek/expand sheet, always available on the Journal tab */}
      <TodoSheet
        schedule={schedule}
        expandSignal={todoExpandSignal}
        createSignal={todoCreateSignal}
      />

      {/* Floating ghost that follows the finger while dragging a todo to schedule */}
      <TodoDragGhost schedule={schedule} />

      {/* Edit modal opened from tapping a scheduled block on the calendar */}
      <TodoEditModal
        isVisible={calendarEditVisible}
        onClose={() => setCalendarEditVisible(false)}
        todo={calendarEditTodo}
      />

      {/* Create-new-tag modal, shared across the journal's tag selectors */}
      <CreateTagModal
        visible={createTagTarget !== null}
        onClose={() => setCreateTagTarget(null)}
        onCreated={(tag) => {
          if (createTagTarget === 'manual') {
            setManualTag(tag.id);
            if (manualSecondaryTag === tag.id) setManualSecondaryTag('');
          } else if (createTagTarget === 'manualSecondary') {
            setManualSecondaryTag(tag.id);
          } else if (createTagTarget === 'editSecondary') {
            setEditSecondaryTag(tag.id);
          }
          setCreateTagTarget(null);
        }}
      />
    </View>
  );
}
