import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  Animated,
  Easing,
  Modal,
  Image,
  Text,
  AppState,
  Alert,
  LayoutChangeEvent,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  LinearTransition,
  type SharedValue,
} from 'react-native-reanimated';
import { Typography, Button } from '../../src/components/ui';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import {
  TimeScroller,
  DurationPicker,
  RunningTodoList,
  CreateTagModal,
  EditTagSheet,
} from '../../src/components/focus';
import { TodoEditModal } from '../../src/components/journal/TodoSheet/TodoEditModal';
import {
  SwipeStartAction,
  START_ACTION_THRESHOLD,
} from '../../src/components/analytics/GoalProgress/GoalProgress';
import { useThrottledPress } from '../../src/hooks/common';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
  useFocusActions,
  useRewards,
  useAppStore,
  useBlocklist,
  useBlocklistActions,
  useBlocklistEditCost,
} from '../../src/store';
import { useAppSettings } from '../../src/store/unified-store';
import { CoachMark } from '../../src/components/ui/CoachMark/CoachMark';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { FruitCounter } from '../../src/components/rewards';
import { showToast } from '../../src/components/ui/Toast';
import { LiveActivityService } from '../../src/services/LiveActivityService';
import { WidgetService } from '../../src/services/WidgetService';
import { AnalyticsTracker } from '../../src/services/analytics';
import { SETUP_TASK_IDS } from '../../src/services/sync/SyncMapper';
import { FamilyControlsModule } from '../../src/modules/BitterSweetFamilyControls';
import { blockSelection, stopMonitoring } from 'react-native-device-activity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { STORAGE_KEYS } from '../../src/config/constants';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useTagUpgradeFlow } from '../../src/hooks/useTagUpgradeFlow';
import { SwipeableTabWrapper } from '../../src/components/ui/SwipeableTabWrapper';
import { colors } from '../../src/config/theme';

const ACTIVE_SESSION_KEY = 'active-focus-session';

const ROW_HEIGHT = 84; // row height (72px) + margin-bottom (12px from mb-3)
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

type DraggableTagRowProps = {
  tag: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
  };
  index: number;
  selectedTag: string | null;
  lastDuration: number;
  todoCount: number;
  isDragging: boolean;
  dragOriginalIndex: number;
  dragTargetIndex: number;
  isChallenge?: boolean;
  onSelect: (id: string) => void;
  onEdit: (tag: any, event: any) => void;
  onDelete: (tag: any, event: any) => void;
  onStartSession?: (tag: any) => void;
  onSwipeOpen?: (ref: any) => void;
  onDragStart: (index: number) => void;
  onDragMove: (translationY: number) => void;
  onDragEnd: () => void;
};

function DraggableTagRow({
  tag,
  index,
  selectedTag,
  lastDuration,
  todoCount,
  isDragging,
  dragOriginalIndex,
  dragTargetIndex,
  isChallenge,
  onSelect,
  onEdit,
  onDelete,
  onStartSession,
  onSwipeOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
}: DraggableTagRowProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isBeingDragged = isDragging && dragOriginalIndex === index;
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const displacement = useSharedValue(0);
  const gestureActive = useSharedValue(false);

  const swipeableRef = useRef<any>(null);
  const didSwipe = useRef(false);
  const firedRef = useRef(false);

  // Reset shared values when drag ends and array has reordered
  React.useEffect(() => {
    if (!isDragging) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      displacement.value = 0; // instant reset — array reorder handles final positions
    }
  }, [isDragging]);

  // Animate displacement for non-dragged items to make room
  React.useEffect(() => {
    if (!isDragging || isBeingDragged) {
      return;
    }

    const orig = dragOriginalIndex;
    const target = dragTargetIndex;
    let shift = 0;

    if (orig < target && index > orig && index <= target) {
      shift = -ROW_HEIGHT; // shift up to fill the gap
    } else if (orig > target && index >= target && index < orig) {
      shift = ROW_HEIGHT; // shift down to fill the gap
    }

    displacement.value = withSpring(shift, SPRING_CONFIG);
  }, [isDragging, isBeingDragged, dragOriginalIndex, dragTargetIndex, index]);

  // Synthetic challenge rows (no real local tag yet) are read-only.
  const isReadOnly = isChallenge;

  const panGesture = Gesture.Pan()
    .enabled(!isReadOnly)
    .activateAfterLongPress(250)
    .onStart(() => {
      gestureActive.value = true;
      scale.value = withSpring(1.03, SPRING_CONFIG);
      zIndex.value = 100;
      runOnJS(onDragStart)(index);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      runOnJS(onDragMove)(e.translationY);
    })
    .onEnd(() => {
      gestureActive.value = false;
      // Don't reset translateY here — let the useEffect handle it
      // after the array reorders, so the item doesn't snap back first
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      if (gestureActive.value) {
        // Gesture was cancelled (not ended normally) — reset everything
        translateY.value = withSpring(0, SPRING_CONFIG);
        gestureActive.value = false;
      }
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: isBeingDragged ? translateY.value : displacement.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const isSelected = selectedTag === tag.id;

  const handleRowPress = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onSelect(tag.id);
  };

  // Swipe left→right reveals the management actions (moved here from the right
  // so the right edge is free for the start-session gesture — same layout as the
  // goal rows in the insights tab).
  const renderLeftActions = () => (
    <View className="mr-2 flex-row items-center">
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onEdit(tag, null);
        }}
        className="ml-2 h-full w-16 items-center justify-center rounded-lg"
        style={{ backgroundColor: 'rgba(200, 200, 200, 0.3)' }}>
        <Ionicons
          name="pencil-outline"
          size={16}
          color={colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary}
        />
        <Typography variant="tiny-10" color="secondary" className="mt-0.5">
          {t('common.edit')}
        </Typography>
      </Pressable>
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete(tag, null);
        }}
        className="ml-2 h-full w-16 items-center justify-center rounded-lg bg-danger">
        <Ionicons name="trash-outline" size={16} color={colors.white} />
        <Typography variant="tiny-10" color="white" className="mt-0.5">
          {t('common.delete')}
        </Typography>
      </Pressable>
    </View>
  );

  // Swipe right→left reveals the Start panel; dragging past the threshold
  // commits (iOS-Mail-style full swipe) and starts a focus session for this tag
  // with its last-used duration — same gesture as the goal rows.
  const renderRightActions = (progress: SharedValue<number>) => (
    <SwipeStartAction progress={progress} />
  );

  // Full-swipe commit. ReanimatedSwipeable reports `direction` by the row's
  // translation sign: a left→right pull (management buttons) reports 'right'; a
  // right→left pull (Start panel) reports 'left'. Only the Start side commits on
  // full swipe — the buttons just stay revealed for tapping.
  const handleWillOpen = (direction: 'left' | 'right') => {
    didSwipe.current = true;
    onSwipeOpen?.(swipeableRef.current);
    if (direction !== 'left') return;
    if (firedRef.current) return;
    firedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Leave the row OPEN — the revealed Start panel is the "it worked"
    // confirmation. The parent closes it off-screen once the picker is hidden.
    onStartSession?.(tag);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View
        className="mb-3"
        style={[
          animatedStyle,
          isBeingDragged && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 6,
          },
        ]}>
        <Swipeable
          ref={swipeableRef}
          renderLeftActions={isReadOnly ? undefined : renderLeftActions}
          renderRightActions={renderRightActions}
          rightThreshold={START_ACTION_THRESHOLD}
          overshootFriction={8}
          onSwipeableWillOpen={handleWillOpen}
          onSwipeableClose={() => {
            firedRef.current = false;
            setTimeout(() => {
              didSwipe.current = false;
            }, 100);
          }}>
          <Pressable onPress={handleRowPress}>
            <View
              className="flex-row items-center rounded-2xl p-4 dark:bg-dark-card"
              style={{
                borderLeftWidth: 4,
                borderLeftColor: tag.color || colors.primary,
                // Opaque background so swipe-to-reveal buttons don't bleed through
                backgroundColor: colorScheme === 'dark' ? colors.dark.card : colors.light.input,
              }}>
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-lg border border-gray-500 bg-gray-600">
                <Text className="text-xl">{tag.icon || '\uD83C\uDFF7\uFE0F'}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Typography
                    variant="subtitle-16"
                    color="primary"
                    className={isSelected ? 'font-semibold' : ''}>
                    {tag.name}
                  </Typography>
                  {isChallenge && (
                    <View
                      className="ml-2 rounded-full px-2 py-0.5"
                      style={{ backgroundColor: `${colors.challenge}33` }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: colors.challenge }}>
                        {t('home.badgeChallenge')}
                      </Text>
                    </View>
                  )}
                </View>
                <Typography
                  variant="body-12"
                  color={isSelected ? 'primary' : 'secondary'}
                  className="mt-1">
                  {lastDuration === 0 ? '\u221E' : t('home.minutesShort', { count: lastDuration })}
                </Typography>
              </View>
              {todoCount > 0 && (
                <View
                  className="ml-3 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: 'rgba(101, 146, 233, 0.18)' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                    {t('home.todoCountPill', { count: todoCount })}
                  </Text>
                </View>
              )}
              {isSelected && (
                <View
                  className="ml-3 h-6 w-6 items-center justify-center rounded-full"
                  style={{ backgroundColor: tag.color || colors.primary }}>
                  <Ionicons name="checkmark" size={15} color={colors.white} />
                </View>
              )}
            </View>
          </Pressable>
        </Swipeable>
      </Reanimated.View>
    </GestureDetector>
  );
}

type PersistedSession = {
  startTime: number; // Unix ms
  endTime: number; // Unix ms
  targetDuration: number; // minutes
  tagId: string;
  tagLabel?: string; // pre-built "icon name" label for Live Activity idle state
  isInfinite: boolean;
  liveActivityId?: string; // iOS Live Activity ID to stop after app restart
  notificationId?: string; // scheduled completion notification
};

export default function FocusScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const { height: screenHeight } = useWindowDimensions();
  // Get tags from store
  // Narrow subscription: this screen reads only these focus fields. Selecting
  // the whole `state.focus` slice (via useFocus) re-rendered this 3k-line screen
  // on unrelated focus writes. useShallow keeps it re-rendering only when one of
  // these specific fields actually changes.
  const { tags, sessions, lastSelectedTagId, lastDurationByTagId, goals, todos } = useAppStore(
    useShallow((s) => ({
      tags: s.focus.tags,
      sessions: s.focus.sessions,
      lastSelectedTagId: s.focus.lastSelectedTagId,
      lastDurationByTagId: s.focus.lastDurationByTagId,
      goals: s.focus.goals,
      todos: s.focus.todos,
    }))
  );
  const {
    deleteTag,
    badgeTag,
    reorderTags,
    startSession,
    completeSession,
    createCompletedSession,
    setLastSelectedTagId,
    setLastDurationForTag,
  } = useFocusActions();
  const rewards = useRewards();
  // Unclaimed setup-task rewards waiting in the fruit store (same filter as fruit-store.tsx).
  const hasUnclaimedRewards = SETUP_TASK_IDS.some(
    (id) => rewards.tasks?.[id]?.everSetup && !rewards.tasks?.[id]?.claimed
  );
  // Bought gift still missing its photo — the "capture the moment" pending
  // action in the fruit store (shown to both gift parties).
  const groveGifts = useAppStore((s) => s.grove.gifts);
  const hasPendingGiftAction = groveGifts.some((g) => g.purchasedAt && !g.photoUrl);
  const { settings: blocklistSettings, activeSessions } = useBlocklist();
  const { checkAuthorizationStatus, requestAuthorization } = useBlocklistActions();
  const currentSession = useAppStore((s) => s.focus.currentSession);
  const blocklistEditCost = useBlocklistEditCost();
  const { triggerHaptic } = useDeviceIntegration();
  const { preferences, updatePreferences } = useAppSettings();
  const timerPickerStyle = preferences.focus.timerPickerStyle ?? 'scroller';
  const { canCreateTag } = useSubscriptionGate();
  const { triggerUpgrade: triggerTagUpgrade, upgradeModals: tagUpgradeModals } =
    useTagUpgradeFlow();
  const challenges = useAppStore((s) => s.grove.challenges);
  const availableTags = tags.allIds
    .map((id) => tags.byId[id])
    .filter(Boolean)
    .filter((t) => !t.deletedAt);

  // Count open (incomplete, non-deleted) todos per tag for the picker pill.
  const openTodoCountByTagId = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of todos.allIds) {
      const todo = todos.byId[id];
      if (!todo || todo.deletedAt || todo.completed) continue;
      counts[todo.tagId] = (counts[todo.tagId] ?? 0) + 1;
    }
    return counts;
  }, [todos]);

  // Build challenge-only tags from active challenges (both incoming and outgoing)
  const challengeTags = React.useMemo(() => {
    const userTagIds = new Set(availableTags.map((t) => t.id));
    const seen = new Set<string>();
    return challenges
      .filter((c) => c.status === 'active' || c.status === 'pending')
      .filter((c) => {
        if (userTagIds.has(c.tagId)) return false; // user already has this tag
        if (seen.has(c.tagId)) return false; // dedup by tagId
        seen.add(c.tagId);
        return true;
      })
      .map((c) => ({
        id: c.tagId,
        name: c.tagName,
        icon: c.tagIcon,
        color: '#E9A065',
        isChallenge: true as const,
      }));
  }, [challenges, availableTags]);

  const [selectedTime, setSelectedTime] = useState(15); // minutes; 0 => ∞
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Restore last selected tag or fall back to first available tag
  useEffect(() => {
    if (availableTags.length > 0 && !selectedTag) {
      // Soft-deleted tags stay in byId (with deletedAt) but aren't selectable, so
      // check the same condition availableTags uses — a restored/synced id can
      // point at a tag that was deleted on another device.
      const lastTagExists =
        lastSelectedTagId &&
        tags.byId[lastSelectedTagId] &&
        !tags.byId[lastSelectedTagId].deletedAt;
      const restoredTagId = lastTagExists ? lastSelectedTagId : availableTags[0].id;
      setSelectedTag(restoredTagId);
      // Restore last used duration for this tag (default 15 min)
      setSelectedTime(lastDurationByTagId[restoredTagId] ?? 15);
    }
  }, [availableTags, selectedTag]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  // Edit-tag flow: the EditTagSheet (stacked on the picker) owns the form; the
  // home screen only tracks which tag is open.
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  // Drag-to-reorder state. The reorder works off `availableTags` — the exact list
  // that gets rendered — so a row's index always matches the array being spliced
  // (same as the goal rows in GoalProgress). Never reintroduce a parallel order
  // array built from `tags.allIds`: soft-deleted tags stay in allIds but are
  // filtered out of the render, so the two drift apart by one slot per deleted
  // tag and the drop lands on the wrong element.
  const [isDragging, setIsDragging] = useState(false);
  const [dragOriginalIdx, setDragOriginalIdx] = useState(-1);
  const [dragTargetIdx, setDragTargetIdx] = useState(-1);
  const dragOriginalIdxRef = useRef(-1);
  const dragTargetIdxRef = useRef(-1);
  const visibleTagIdsRef = useRef<string[]>([]);
  visibleTagIdsRef.current = availableTags.map((t) => t.id);
  const deletedTagIdsRef = useRef<string[]>([]);
  deletedTagIdsRef.current = tags.allIds.filter((id) => tags.byId[id]?.deletedAt);

  // Tag swipe coach mark
  const firstTagRef = useRef<View>(null);
  const [showTagSwipeCoachMark, setShowTagSwipeCoachMark] = useState(false);

  // Swipe-to-reveal: track open swipeable to close others
  const openSwipeableRef = useRef<any>(null);
  const handleSwipeOpen = useCallback((ref: any) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  }, []);

  // A committed Start swipe intentionally leaves its row open (Start panel
  // showing) while the picker closes — closing it there would read as a
  // snap-back. The BottomSheet's Modal stays mounted when hidden, so reset the
  // row here once the picker is off-screen or it would still be open on reopen.
  useEffect(() => {
    if (!showTagModal && openSwipeableRef.current) {
      openSwipeableRef.current.close?.();
      openSwipeableRef.current = null;
    }
  }, [showTagModal]);

  useEffect(() => {
    if (showTagModal) {
      // Show tag swipe coach mark after a short delay
      if (availableTags.length >= 2 && !preferences.hasSeenTagSwipeHint) {
        setTimeout(() => setShowTagSwipeCoachMark(true), 500);
      }
    } else {
      setShowTagSwipeCoachMark(false);
    }
  }, [showTagModal]);

  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDragOriginalIdx(index);
    setDragTargetIdx(index);
    dragOriginalIdxRef.current = index;
    dragTargetIdxRef.current = index;
  }, []);

  const handleDragMove = useCallback((translationY: number) => {
    const origIdx = dragOriginalIdxRef.current;
    // Challenge rows are appended after the real tags and can't be reordered, so
    // the drop target is clamped to the real-tag range.
    const total = visibleTagIdsRef.current.length;
    const offset = Math.round(translationY / ROW_HEIGHT);
    const newTarget = Math.max(0, Math.min(total - 1, origIdx + offset));

    if (newTarget !== dragTargetIdxRef.current) {
      dragTargetIdxRef.current = newTarget;
      setDragTargetIdx(newTarget);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    const orig = dragOriginalIdxRef.current;
    const target = dragTargetIdxRef.current;

    if (orig !== target && orig >= 0 && target >= 0) {
      const newOrder = [...visibleTagIdsRef.current];
      const [moved] = newOrder.splice(orig, 1);
      if (moved) {
        newOrder.splice(target, 0, moved);
        // Soft-deleted tags aren't rendered, but they must stay in allIds or their
        // deletion never syncs — park them after the visible order.
        reorderTags([...newOrder, ...deletedTagIdsRef.current]);
      }
    }

    setIsDragging(false);
    setDragOriginalIdx(-1);
    setDragTargetIdx(-1);
    dragOriginalIdxRef.current = -1;
    dragTargetIdxRef.current = -1;
  }, [reorderTags]);

  const orderedTags = [...availableTags, ...challengeTags];

  // Blocklist tip modal
  const [showBlocklistTip, setShowBlocklistTip] = useState(false);
  const [showEditCostModal, setShowEditCostModal] = useState(false);
  // Pre-permission guide shown the very first time (before the system Screen Time prompt)
  const [showScreenTimeGuide, setShowScreenTimeGuide] = useState(false);
  const blocklistTipAcknowledgedRef = useRef<boolean | null>(null);

  // Session + timer state
  const [isSessionActive, setIsSessionActive] = useState(false); // true during transition or running
  const [isRunning, setIsRunning] = useState(false);
  // Gates the under-timer TODO list. Tracked separately from isSessionActive so it
  // can hide the instant a stop begins (in teardown) instead of lingering through
  // the ~340ms stop animation, after which isSessionActive finally flips false.
  const [todoListVisible, setTodoListVisible] = useState(false);
  // Create-todo sheet opened from the "Add a TODO" action under the running list.
  const [showAddTodoModal, setShowAddTodoModal] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [unlockRemainingSeconds, setUnlockRemainingSeconds] = useState(0);
  const [isBonusTime, setIsBonusTime] = useState(false);
  const [bonusSeconds, setBonusSeconds] = useState(0);
  // Refs to capture session state at stop time (before state resets) for saveSessionAndNavigate
  const stoppedInBonusRef = useRef(false);
  const stoppedBonusSecondsRef = useRef(0);
  const stoppedSessionStartTimeRef = useRef<number | null>(null);
  const stoppedSessionTargetDurationRef = useRef<number | null>(null);
  const liveActivityIdRef = useRef<string | undefined>(undefined);
  const sessionEndTimeRef = useRef<number | null>(null); // Unix ms when session should end
  const sessionStartTimeRef = useRef<number | null>(null); // Unix ms when session started
  const sessionTargetDurationRef = useRef<number | null>(null); // target duration in minutes, immune to state races
  const scheduledNotificationRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionCancelledRef = useRef(false);
  // Refs to keep current values accessible in the AppState handler (which has [] deps)
  const selectedTimeRef = useRef(selectedTime);
  const selectedTagRef = useRef(selectedTag);
  selectedTimeRef.current = selectedTime;
  selectedTagRef.current = selectedTag;

  // Animation refs
  const scrollerOpacity = useRef(new Animated.Value(1)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(0.94)).current;
  const timerTranslateY = useRef(new Animated.Value(6)).current;
  const tagsOpacity = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;

  // Blocklist helpers
  const getBlockedCount = () => {
    const totalApps =
      blocklistSettings.blockedApps.applicationTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    const totalCategories =
      blocklistSettings.blockedApps.categoryTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    const totalDomains =
      blocklistSettings.blockedApps.webDomainTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    return Number(totalApps) + Number(totalCategories) + Number(totalDomains);
  };
  const blockedCount = getBlockedCount();
  const activeUnlockSession =
    activeSessions.allIds
      .map((id) => activeSessions.byId[id])
      .filter((session) => session?.isActive)
      .sort((a, b) => {
        const aEnd =
          a.endTime instanceof Date ? a.endTime.getTime() : new Date(a.endTime).getTime();
        const bEnd =
          b.endTime instanceof Date ? b.endTime.getTime() : new Date(b.endTime).getTime();
        return bEnd - aEnd;
      })[0] || null;
  const activeUnlockEndTimeMs = activeUnlockSession
    ? activeUnlockSession.endTime instanceof Date
      ? activeUnlockSession.endTime.getTime()
      : new Date(activeUnlockSession.endTime).getTime()
    : null;
  const isUnlockActive = !!activeUnlockSession && !isSessionActive;

  // Trigger the native Screen Time permission prompt, then open the picker.
  const requestAuthAndOpenPicker = async () => {
    const granted = await requestAuthorization();
    if (granted) {
      await checkAuthorizationStatus();
      router.push('/(modals)/app-selection');
    } else {
      Alert.alert(t('home.authRequiredTitle'), t('home.authRequiredBody'), [
        { text: t('common.ok') },
      ]);
    }
  };

  const proceedToBlockList = async () => {
    const authorized = await checkAuthorizationStatus();
    if (authorized) {
      router.push('/(modals)/app-selection');
      return;
    }

    // Permission not yet granted. If it has never been asked (notDetermined),
    // the native "Access Screen Time" prompt is about to appear — show a guide
    // first so the user knows to tap "Continue" (not "Don't Allow").
    const status = useAppStore.getState().blocklist.authorizationStatus;
    if (status === 0) {
      setShowScreenTimeGuide(true);
      return;
    }

    await requestAuthAndOpenPicker();
  };

  // NOTE: The reinstall/revoke re-auth reconcile (a blocklist restored from cloud
  // while Screen Time authorization is gone) now lives in `app/_layout.tsx`, where
  // it requests the native permission directly and is sequenced BEFORE the Apple
  // Health reconnect so the two system prompts never stack. See
  // reconcileBlockingThenHealth() there.

  const handleBlockList = async () => {
    triggerHaptic('light');

    if (currentSession.session !== null) {
      Alert.alert(t('home.blocklistLockedTitle'), t('home.blocklistLockedBody'), [
        { text: t('common.ok') },
      ]);
      return;
    }

    // Check if tip has been acknowledged
    if (blocklistTipAcknowledgedRef.current === null) {
      const acknowledged = await AsyncStorage.getItem(STORAGE_KEYS.blocklistTipAcknowledged);
      blocklistTipAcknowledgedRef.current = acknowledged === 'true';
    }

    // Skip tip if user already has a blocklist (e.g. restored from cloud after sign-in)
    const store = useAppStore.getState();
    if (!blocklistTipAcknowledgedRef.current && store.blocklist.currentSelectionId === null) {
      setShowBlocklistTip(true);
      return;
    }

    // If blocklist already set up, show edit cost modal before proceeding
    if (store.blocklist.currentSelectionId !== null) {
      setShowEditCostModal(true);
      return;
    }

    await proceedToBlockList();
  };

  const handleBlocklistTipUnderstood = async () => {
    setShowBlocklistTip(false);
    blocklistTipAcknowledgedRef.current = true;
    await AsyncStorage.setItem(STORAGE_KEYS.blocklistTipAcknowledged, 'true');

    // If blocklist already set up, show edit cost modal before proceeding
    const store = useAppStore.getState();
    if (store.blocklist.currentSelectionId !== null) {
      setShowEditCostModal(true);
      return;
    }

    await proceedToBlockList();
  };

  const handleTagSelect = (tagId: string) => {
    Haptics.selectionAsync();
    setSelectedTag(tagId);
    setLastSelectedTagId(tagId);
    // Sync to small widget so it shows the newly selected tag
    WidgetService.syncSelectedTagId(tagId);
    // Restore last used duration for this tag (default 15 min)
    const duration = lastDurationByTagId[tagId] ?? 15;
    setSelectedTime(duration);
    // Update any idle Live Activity with the newly selected tag/duration
    if (!isRunning) {
      const tag = tags.byId[tagId] || challengeTags.find((ct) => ct.id === tagId);
      const tagLabel = tag ? `${tag.icon || '🎯'} ${tag.name}` : 'Focus';
      LiveActivityService.showIdleFocusActivity(tagLabel, tagId, duration);
    }
    setShowTagModal(false);
  };

  const handleEditTag = (tag: any, event: any) => {
    event?.stopPropagation();
    // The EditTagSheet stacks on top of the picker, which stays open behind it.
    setEditingTagId(tag.id);
    setShowEditTagModal(true);
  };

  const tagHasActiveGoal = (tagId: string) =>
    goals.allIds.some((gid) => {
      const goal = goals.byId[gid];
      return goal && goal.tagId === tagId && goal.isActive;
    });

  // A tag is locked from deletion while it is tied to a non-terminal challenge
  // (pending or active — i.e. ongoing or upcoming). `challenge.tagId` resolves to
  // the current user's own participant tag, so this guards both the challenger and
  // the challengee. Terminal challenges (completed/failed/cancelled/declined) don't block.
  const tagHasOngoingChallenge = (tagId: string) =>
    challenges.some((c) => c.tagId === tagId && (c.status === 'active' || c.status === 'pending'));

  // Returns a human-readable reason the tag can't be deleted, or null if it can.
  const tagDeletionBlockReason = (tag: { id: string; name: string } | null): string | null => {
    if (!tag) return null;
    const hasGoal = tagHasActiveGoal(tag.id);
    const hasChallenge = tagHasOngoingChallenge(tag.id);
    if (hasGoal && hasChallenge) {
      return t('home.deleteBlockBoth', { name: tag.name });
    }
    if (hasGoal) {
      return t('home.deleteBlockGoal', { name: tag.name });
    }
    if (hasChallenge) {
      return t('home.deleteBlockChallenge', { name: tag.name });
    }
    return null;
  };

  const handleDeleteTag = (tag: any, event: any) => {
    event?.stopPropagation(); // Prevent tag selection when tapping delete
    const blockReason = tagDeletionBlockReason(tag);
    if (blockReason) {
      Alert.alert(t('home.cannotDeleteTag'), blockReason, [{ text: t('common.ok') }]);
      return;
    }
    // A tag with no sessions has nothing to summarize, so the badge option only
    // appears once there is history worth keeping a record of.
    const hasHistory = sessions.allIds.some((sid) => {
      const s = sessions.byId[sid];
      return s && (s.tagId === tag.id || s.secondaryTagId === tag.id);
    });
    const name = tag?.name ? `"${tag.name}"` : t('home.deleteThisTag');
    Alert.alert(
      t('home.deleteTag'),
      hasHistory
        ? t('home.deleteConfirmWithBadge', { name })
        : t('home.deleteConfirm', { name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        ...(hasHistory
          ? [
              {
                text: t('home.badgeAndDelete'),
                onPress: () => {
                  badgeTag(tag.id);
                  performDeleteTag(tag);
                },
              },
            ]
          : []),
        {
          text: t('common.delete'),
          style: 'destructive' as const,
          onPress: () => performDeleteTag(tag),
        },
      ]
    );
    // The picker sheet stays open behind the native alert.
  };

  const performDeleteTag = (tag: any) => {
    deleteTag(tag.id);
    // If the deleted tag was selected, reset selection to the next available tag.
    if (selectedTag === tag.id) {
      const remainingTags = availableTags.filter((tg) => tg.id !== tag.id);
      const fallbackId = remainingTags.length > 0 ? remainingTags[0].id : null;
      setSelectedTag(fallbackId);
      setLastSelectedTagId(fallbackId);
      WidgetService.syncSelectedTagId(fallbackId);
    }
  };

  const stopUnlockSession = (
    sessionId: string,
    refundUnusedTime: boolean,
    endedAtMs: number = Date.now()
  ) => {
    const store = useAppStore.getState();
    const session = store.blocklist.activeSessions.byId[sessionId];
    if (!session?.isActive) return;

    // Re-block immediately. (Native StopUnlockIntent already does this for Live
    // Activity ends; this is idempotent and covers in-app ends.)
    if (store.blocklist.currentSelectionId) {
      blockSelection({ activitySelectionId: store.blocklist.currentSelectionId });
      try {
        stopMonitoring([`reblock-${store.blocklist.currentSelectionId}`]);
      } catch {
        /* ignore */
      }
    }

    // endUnlock refunds the unused minutes based on the actual end time. Pass the
    // real end moment — Date.now() for an in-app end, or the native stop marker's
    // timestamp for a Live Activity end — so reopening the app after the unlock
    // window elapsed doesn't zero out the refund.
    store.blocklist.endUnlock(
      sessionId,
      refundUnusedTime ? 'manual' : 'expired',
      refundUnusedTime ? endedAtMs : undefined
    );

    // Clear unlock state on home screen widget
    WidgetService.syncUnlockSessionState(null);
  };

  const handleStopUnlock = () => {
    if (!activeUnlockSession) return;
    triggerHaptic('light');
    stopUnlockSession(activeUnlockSession.id, true);
    showToast(t('home.unlockStopped'), 'neutral');
  };

  const startTimer = async () => {
    // Signal focusing status to friends
    useAppStore.getState().grove.setFocusing(true);

    // Analytics: the single in-app "session started" choke point. It lives here
    // rather than in focus.startSession because that store method is dead — the
    // live timer never creates a session up front, it only writes one on
    // completion (createCompletedSession). Pairs with focus_session_completed to
    // give the started→completed rate.
    //
    // Caveat: sessions started from the widget / Live Activity never pass through
    // here (they're adopted on foreground as already-complete), so `source` marks
    // this as the in-app path and the rate must be read on source='app' only.
    AnalyticsTracker.track('focus_session_started', {
      source: 'app',
      duration_minutes: selectedTime === -1 ? 1 : selectedTime === -2 ? 30 : selectedTime,
      is_infinite: selectedTime === 0,
      tag_id: selectedTag ?? undefined,
      has_blocklist: useAppStore.getState().blocklist.currentSelectionId != null,
    });

    // End any active unlock sessions — re-block apps and refund remaining time
    const store = useAppStore.getState();
    const { activeSessions } = store.blocklist;
    activeSessions.allIds.forEach((id) => {
      const session = activeSessions.byId[id];
      if (!session?.isActive) return;
      stopUnlockSession(id, true);
      console.log('🔒 Ended unlock session for focus start:', id);
    });

    // Dev-only test timers: -1 = 5s (counts as 1 min), -2 = 10s (counts as 30 min)
    const isDevTimer = selectedTime === -1 || selectedTime === -2;
    const devSeconds = selectedTime === -1 ? 5 : 10;
    const devCountsAsMinutes = selectedTime === -1 ? 1 : 30;
    const timerSeconds = isDevTimer ? devSeconds : selectedTime * 60;
    const infinite = selectedTime === 0;
    setIsInfinite(infinite);
    setIsRunning(true);

    const now = Date.now();
    sessionStartTimeRef.current = now;
    sessionTargetDurationRef.current = isDevTimer ? devCountsAsMinutes : selectedTime;

    if (infinite) {
      setElapsedSeconds(0);
    } else {
      setRemainingSeconds(timerSeconds);
    }

    // Start Live Activity for the focus timer (service will reuse existing
    // activity if one is still around, ensuring at most one is shown)
    let liveActivityId: string | undefined;

    // Store tag info for later idle state (when session ends, LA transitions to idle)
    const selectedTagObj = selectedTag
      ? tags.byId[selectedTag] || challengeTags.find((ct) => ct.id === selectedTag)
      : undefined;
    const selectedTagLabel = selectedTagObj
      ? `${selectedTagObj.icon || '🎯'} ${selectedTagObj.name}`
      : 'Focus';
    LiveActivityService.setLastTag(
      selectedTag || undefined,
      selectedTagLabel,
      isDevTimer ? devCountsAsMinutes : selectedTime
    );

    if (infinite) {
      // Infinite mode: no end time — use a count-up live activity
      sessionEndTimeRef.current = null;
      const activityId = await LiveActivityService.startFocusTimerInfinite(
        new Date(),
        selectedTagLabel
      );
      if (activityId) {
        liveActivityId = activityId;
        liveActivityIdRef.current = activityId;
        console.log('🎬 Live Activity started for infinite focus session:', activityId);
      } else {
        console.log('⚠️ Live Activity was not created (may not be available on this device)');
      }
    } else {
      const endTime = new Date(Date.now() + timerSeconds * 1000);
      sessionEndTimeRef.current = endTime.getTime();
      const activityId = await LiveActivityService.startFocusTimer(
        endTime,
        isDevTimer ? devCountsAsMinutes : selectedTime,
        selectedTagLabel
      );
      if (activityId) {
        liveActivityId = activityId;
        liveActivityIdRef.current = activityId;
        console.log('🎬 Live Activity started for focus session:', activityId);
      } else {
        console.log('⚠️ Live Activity was not created (may not be available on this device)');
      }
    }

    // Schedule a notification with sound for when the timer ends
    if (selectedTime > 0 || isDevTimer) {
      // Cancel any existing scheduled notification
      if (scheduledNotificationRef.current) {
        Notifications.cancelScheduledNotificationAsync(scheduledNotificationRef.current);
      }
      Notifications.scheduleNotificationAsync({
        content: {
          title: t('home.sessionCompleteTitle'),
          body: isDevTimer
            ? `Your ${devSeconds}s dev test session is done!`
            : t('home.sessionCompleteBody', {
                minutes: selectedTime,
                tag: selectedTag ? tags.byId[selectedTag]?.name || 'focus' : 'focus',
              }),
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: timerSeconds,
        },
      }).then((id) => {
        scheduledNotificationRef.current = id;
        // Sync to shared UserDefaults so native StopSessionIntent can cancel it
        WidgetService.syncScheduledNotificationId(id);
        // Update persisted session with notification ID so it can be cancelled after app restart
        AsyncStorage.getItem(ACTIVE_SESSION_KEY).then((raw) => {
          if (raw) {
            const persisted = JSON.parse(raw);
            persisted.notificationId = id;
            AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(persisted));
          }
        });
      });
    }

    // Update shield to block unlocking during focus session
    const currentBalance = useAppStore.getState().rewards.balance;
    FamilyControlsModule.updateShieldBalance(currentBalance, true).catch((error) => {
      console.error('Failed to update shield for focus session start:', error);
    });

    // Persist active session so it survives app kills
    const persistNow = Date.now();
    AsyncStorage.setItem(
      ACTIVE_SESSION_KEY,
      JSON.stringify({
        startTime: persistNow,
        endTime: infinite ? 0 : persistNow + timerSeconds * 1000,
        targetDuration: isDevTimer ? devCountsAsMinutes : selectedTime,
        tagId: selectedTag || 'Focus',
        tagLabel: selectedTagLabel,
        isInfinite: infinite,
        liveActivityId,
      } satisfies PersistedSession)
    );

    // Sync widget with active session state
    const tagInfo = selectedTag ? tags.byId[selectedTag] : null;
    WidgetService.syncSessionState({
      isActive: true,
      tagId: selectedTag || '',
      tagName: tagInfo?.name || 'Focus',
      tagIcon: tagInfo?.icon || '🎯',
      tagColor: tagInfo?.color || '#8B4513',
      startTime: persistNow,
      endTime: infinite ? 0 : persistNow + timerSeconds * 1000,
      isInfinite: infinite,
    });

    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => {
      if (infinite) {
        setElapsedSeconds((prev) => prev + 1);
      } else {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            // Timer reached 0 — enter bonus time mode instead of stopping
            if (timerRef.current) clearInterval(timerRef.current as any);
            timerRef.current = null;
            // Session reached its goal — celebrate the moment.
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsBonusTime(true);
            setBonusSeconds(0);

            // Start a new interval that counts UP for bonus time
            timerRef.current = setInterval(() => {
              setBonusSeconds((b) => b + 1);
            }, 1000);

            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
  };

  const stopCompletely = () => {
    // Clear focusing status
    useAppStore.getState().grove.setFocusing(false);

    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;
    sessionStartTimeRef.current = null;
    sessionTargetDurationRef.current = null;
    setIsRunning(false);
    setIsSessionActive(false);
    setTodoListVisible(false);
    setIsBonusTime(false);
    setBonusSeconds(0);
    AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

    // Restore normal shield (allow unlocking again)
    const currentBalance = useAppStore.getState().rewards.balance;
    FamilyControlsModule.updateShieldBalance(currentBalance, false).catch((error) => {
      console.error('Failed to restore shield after focus session stop:', error);
    });

    // Clear widget session state
    WidgetService.syncSessionState(null);
  };

  // Shared teardown logic for stopping a focus session.
  // Clears timer, resets running state, removes persisted session,
  // restores shield, clears widget state, cancels notification,
  // and returns the Live Activity ID so the caller can stop it.
  const teardownSession = () => {
    // Clear focusing status
    useAppStore.getState().grove.setFocusing(false);

    // Clear timer
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;

    // Reset running state
    setIsRunning(false);
    setIsBonusTime(false);
    setBonusSeconds(0);
    // Hide the TODO list immediately, before the stop animation runs.
    setTodoListVisible(false);

    // Clear persisted session
    AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

    // Restore normal shield (allow unlocking again)
    const currentBalance = useAppStore.getState().rewards.balance;
    FamilyControlsModule.updateShieldBalance(currentBalance, false).catch((error) => {
      console.error('Failed to restore shield after focus session stop:', error);
    });

    // Clear widget session state
    WidgetService.syncSessionState(null);

    // Clear session refs and capture Live Activity ID for caller
    sessionEndTimeRef.current = null;
    sessionStartTimeRef.current = null;
    sessionTargetDurationRef.current = null;
    const activityId = liveActivityIdRef.current;
    liveActivityIdRef.current = undefined;

    // Cancel the scheduled completion notification
    if (scheduledNotificationRef.current) {
      Notifications.cancelScheduledNotificationAsync(scheduledNotificationRef.current);
      scheduledNotificationRef.current = null;
    }
    // Clear from shared UserDefaults (native may have already cancelled it)
    WidgetService.syncScheduledNotificationId(null);

    return activityId;
  };

  const stopWithAnimation = () => {
    const wasBonusTime = isBonusTime;
    // Capture session info for saveSessionAndNavigate (called later from animation callback)
    stoppedInBonusRef.current = isBonusTime;
    stoppedBonusSecondsRef.current = bonusSeconds;
    stoppedSessionStartTimeRef.current = sessionStartTimeRef.current;
    stoppedSessionTargetDurationRef.current = sessionTargetDurationRef.current;

    teardownSession();
    LiveActivityService.stopFocusTimer(wasBonusTime ? 'completed' : 'cancelled');

    Animated.parallel([
      Animated.timing(timerOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(timerScale, {
        toValue: 0.96,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(timerTranslateY, {
        toValue: 6,
        duration: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(scrollerOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(tagsOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsSessionActive(false);
        // Go straight to session summary
        saveSessionAndNavigate();
      });
    });
  };

  // Sync timer when app returns to foreground (JS timers are suspended in background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const now = Date.now();

        // Timed session: recalculate remaining time from the stored end time
        if (sessionEndTimeRef.current) {
          if (now >= sessionEndTimeRef.current) {
            // Session expired while in background — enter bonus time mode
            if (timerRef.current) clearInterval(timerRef.current as any);
            timerRef.current = null;
            setRemainingSeconds(0);

            const bonus = Math.floor((now - sessionEndTimeRef.current) / 1000);
            setIsBonusTime(true);
            setBonusSeconds(bonus);

            // Start bonus count-up interval
            timerRef.current = setInterval(() => {
              setBonusSeconds((b) => b + 1);
            }, 1000);
          } else {
            // Session still running — sync remaining seconds with real clock
            // Use Math.floor to match SwiftUI's Text(date, style: .timer) truncation
            const remaining = Math.max(0, Math.floor((sessionEndTimeRef.current - now) / 1000));
            setRemainingSeconds(remaining);
          }
        }

        // Infinite session: recalculate elapsed time from the stored start time
        if (sessionStartTimeRef.current) {
          const elapsed = Math.floor((now - sessionStartTimeRef.current) / 1000);
          setElapsedSeconds(elapsed);
        }

        // Adopt widget start/stop + recover session in one sequential flow
        adoptAndRecoverSession();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (unlockTimerRef.current) {
      clearInterval(unlockTimerRef.current as any);
      unlockTimerRef.current = null;
    }

    if (!activeUnlockSession?.isActive || !activeUnlockEndTimeMs) {
      setUnlockRemainingSeconds(0);
      return;
    }

    const syncUnlockRemaining = () => {
      const remaining = Math.max(0, Math.ceil((activeUnlockEndTimeMs - Date.now()) / 1000));
      setUnlockRemainingSeconds(remaining);

      if (remaining === 0 && unlockTimerRef.current) {
        clearInterval(unlockTimerRef.current as any);
        unlockTimerRef.current = null;
        useAppStore.getState().blocklist.checkActiveUnlocks();
      }
    };

    syncUnlockRemaining();
    unlockTimerRef.current = setInterval(syncUnlockRemaining, 1000);

    return () => {
      if (unlockTimerRef.current) {
        clearInterval(unlockTimerRef.current as any);
        unlockTimerRef.current = null;
      }
    };
  }, [activeUnlockSession?.id, activeUnlockSession?.isActive, activeUnlockEndTimeMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
      if (unlockTimerRef.current) clearInterval(unlockTimerRef.current as any);
      // Clean up Live Activity when component unmounts
      if (liveActivityIdRef.current) {
        liveActivityIdRef.current = undefined;
        sessionEndTimeRef.current = null;
        sessionStartTimeRef.current = null;
        LiveActivityService.stopFocusTimer('cancelled');
      }
      // Cancel scheduled notification on unmount
      if (scheduledNotificationRef.current) {
        Notifications.cancelScheduledNotificationAsync(scheduledNotificationRef.current);
        scheduledNotificationRef.current = null;
      }
    };
  }, []);

  // Adopt any widget-started/stopped session, then recover from AsyncStorage.
  // Called on mount (cold start) and on foreground (warm start).
  // Runs adoption (write) before recovery (read) to eliminate the race condition.
  const adoptAndRecoverSession = async () => {
    try {
      // --- Widget adoption phase ---

      // 0. Check if widget stopped an unlock session (StopUnlockIntent)
      const unlockStopAction = WidgetService.checkWidgetUnlockStopAction();
      if (unlockStopAction) {
        const store = useAppStore.getState();
        const { activeSessions } = store.blocklist;

        // Find and stop any active unlock sessions. Pass the marker's timestamp
        // (when StopUnlockIntent actually ran) so the refund reflects the time
        // left at end, not at this foreground.
        activeSessions.allIds.forEach((id) => {
          const session = activeSessions.byId[id];
          if (session?.isActive) {
            stopUnlockSession(id, true, unlockStopAction.timestamp);
          }
        });
      }

      // 1. Check if widget stopped a session while app was backgrounded/killed
      const stopAction = WidgetService.checkWidgetStopAction();
      if (stopAction) {
        // Check if a NEWER session was started after this stop action.
        // Flow: start A → stop A → start B → user opens app.
        // The stop belongs to session A; session B is the current one.
        const widgetSession = WidgetService.readWidgetStartedSession();
        const hasNewerStart = widgetSession && widgetSession.startTime > stopAction.timestamp;

        // Use the stopped session's info to record it as completed.
        // Only consume widgetStartedSession if it belongs to the stopped session.
        const activeRaw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        const stoppedSession = hasNewerStart ? null : widgetSession;
        if (stoppedSession) WidgetService.clearWidgetStartedSession();
        const sessionInfo = activeRaw
          ? JSON.parse(activeRaw)
          : stoppedSession
            ? {
                startTime: stoppedSession.startTime,
                targetDuration: stoppedSession.duration,
                tagId: stoppedSession.tagId,
              }
            : null;

        if (sessionInfo) {
          const store = useAppStore.getState();
          const actualEndTime = stopAction.timestamp;
          const durationMs = actualEndTime - sessionInfo.startTime;
          // Floor to match the in-app finish path (Math.floor(elapsed/60)) and the
          // native stop write (Int truncation). All three must agree so the merged
          // focus_sessions row (same id) is deterministic regardless of write order.
          const durationMinutes = Math.floor(durationMs / 60000);

          if (durationMinutes > 0) {
            // For infinite sessions (targetDuration === 0), set targetDuration
            // to the actual duration so fruit calculation works correctly.
            // Mirrors the logic in saveSessionAndNavigate().
            const isInfiniteSession = sessionInfo.targetDuration === 0 || sessionInfo.isInfinite;
            const effectiveTargetDuration = isInfiniteSession
              ? Math.max(1, durationMinutes)
              : sessionInfo.targetDuration;

            const adopted = store.focus.createCompletedSession({
              // Reuse the id the native stop already recorded under, so this
              // local write merges with the native Supabase row instead of
              // duplicating it.
              id: stopAction.sessionId,
              startTime: new Date(sessionInfo.startTime),
              endTime: new Date(actualEndTime),
              duration: durationMinutes,
              targetDuration: effectiveTargetDuration,
              tagId: sessionInfo.tagId,
            });

            // The summary modal (where rating normally happens) never opens for
            // externally-stopped sessions, so rate from historical Core Motion
            // here. Fire-and-forget: adoption must not block on motion reads.
            store.focus.autoRateSessionFromMotion(adopted.id).catch(() => {});
          }

          await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
        }

        // If a newer session is pending, don't reset — fall through to adopt it.
        // Otherwise, clean up and return.
        if (!hasNewerStart) {
          // Check if the UI was showing an active session before teardown clears refs
          const wasUIActive = !!(sessionStartTimeRef.current || sessionEndTimeRef.current);

          // Use shared teardown: clears timer, resets running state, removes
          // persisted session, restores shield, clears widget state, cancels notification
          teardownSession();

          // Reset additional UI-only state that teardownSession doesn't cover
          if (wasUIActive) {
            console.log('📱 [Widget] Session stopped externally, resetting UI');
            setIsSessionActive(false);
            setRemainingSeconds(0);
            setElapsedSeconds(0);
            setIsInfinite(false);

            scrollerOpacity.setValue(1);
            tagsOpacity.setValue(1);
            headerOpacity.setValue(1);
            timerOpacity.setValue(0);
            timerScale.setValue(0.94);
            timerTranslateY.setValue(6);
          }
          return; // stop action handled — no session to recover
        }
        // hasNewerStart: fall through to adopt the newer session below
      }

      // 2. Check if widget started a session
      // Use read-only check first; only clear after successful AsyncStorage write.
      // This prevents data loss if the adoption is interrupted (e.g. by a race
      // condition when the intent fires during a long-press context menu).
      const startedSession = WidgetService.readWidgetStartedSession();
      if (startedSession) {
        console.log('📱 [Widget] Adopting widget-started session:', startedSession.tagId);

        const existingSession = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        if (!existingSession) {
          // Write to AsyncStorage so the recovery phase below picks it up.
          // If the timer already expired, recovery will enter bonus-time mode.
          const tagIcon = startedSession.tagIcon || '🎯';
          const persistedSession: PersistedSession = {
            startTime: startedSession.startTime,
            endTime: startedSession.isInfinite ? 0 : startedSession.endTime,
            targetDuration: startedSession.duration,
            tagId: startedSession.tagId,
            tagLabel: `${tagIcon} ${startedSession.tagName}`,
            isInfinite: startedSession.isInfinite,
            liveActivityId: startedSession.liveActivityId,
          };
          await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(persistedSession));
          // Only clear after successful write so the data survives crashes/races
          WidgetService.clearWidgetStartedSession();
          console.log(
            '📱 [Widget] Wrote active-focus-session for recovery, liveActivityId:',
            startedSession.liveActivityId
          );
        } else {
          WidgetService.clearWidgetStartedSession();
        }
      }

      // --- Recovery phase ---
    } catch (error) {
      console.error('📱 [Widget] Failed to adopt widget session:', error);
    }

    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) {
      // No active session. Any idle focus Live Activity still on screen needs
      // no re-adoption: session start queries ActivityKit directly and reuses
      // or replaces whatever is there (startOrUpdateActivity).
      return;
    }
    try {
      const persisted: PersistedSession = JSON.parse(raw);
      const now = Date.now();

      // Restore notification ID so it can be cancelled if the user stops the session
      if (persisted.notificationId) {
        scheduledNotificationRef.current = persisted.notificationId;
      }
      if (persisted.liveActivityId) {
        liveActivityIdRef.current = persisted.liveActivityId;
      }

      // Restore shield to focus-session mode (block unlocking)
      const currentBalance = useAppStore.getState().rewards.balance;
      FamilyControlsModule.updateShieldBalance(currentBalance, true).catch((error) => {
        console.error('Failed to update shield for recovered focus session:', error);
      });

      // Sync widget with recovered session state
      // Use persisted tagLabel (saved at session start) to avoid store hydration
      // race — tags.byId may be empty if Zustand hasn't rehydrated yet.
      const recoveredTag = useAppStore.getState().focus.tags.byId[persisted.tagId];
      const recoveredTagLabel =
        persisted.tagLabel ||
        (recoveredTag ? `${recoveredTag.icon || '🎯'} ${recoveredTag.name}` : 'Focus');
      WidgetService.syncSessionState({
        isActive: true,
        tagId: persisted.tagId || '',
        tagName: recoveredTag?.name || 'Focus',
        tagIcon: recoveredTag?.icon || '🎯',
        tagColor: recoveredTag?.color || '#8B4513',
        startTime: persisted.startTime,
        endTime: persisted.isInfinite ? 0 : persisted.endTime,
        isInfinite: persisted.isInfinite,
      });

      // Restore in-memory tag info so stopFocusTimer can build the correct
      // idle state (these static fields are lost on app termination)
      LiveActivityService.setLastTag(persisted.tagId, recoveredTagLabel, persisted.targetDuration);

      // Session is being recovered/adopted — signal focusing status
      useAppStore.getState().grove.setFocusing(true);

      if (persisted.isInfinite) {
        // Infinite session was running when app was killed — restore it
        const elapsed = Math.floor((now - persisted.startTime) / 1000);

        setSelectedTime(0);
        setSelectedTag(persisted.tagId);
        setElapsedSeconds(elapsed);
        setIsInfinite(true);
        setIsRunning(true);
        setIsSessionActive(true);
        setTodoListVisible(true);
        sessionStartTimeRef.current = persisted.startTime;
        sessionTargetDurationRef.current = persisted.targetDuration;

        // Switch visuals to timer mode immediately
        scrollerOpacity.setValue(0);
        tagsOpacity.setValue(0);
        headerOpacity.setValue(0);
        timerOpacity.setValue(1);
        timerScale.setValue(1);
        timerTranslateY.setValue(0);

        if (!persisted.liveActivityId) {
          // Older persisted sessions did not store the activity ID.
          const recoveredTagObj = useAppStore.getState().focus.tags.byId[persisted.tagId];
          const recoveredTagLabel = recoveredTagObj
            ? `${recoveredTagObj.icon || '🎯'} ${recoveredTagObj.name}`
            : 'Focus';
          const activityId = await LiveActivityService.startFocusTimerInfinite(
            new Date(persisted.startTime),
            recoveredTagLabel
          );
          if (activityId) {
            liveActivityIdRef.current = activityId;
          }
        }

        // Start elapsed count-up interval
        if (timerRef.current) clearInterval(timerRef.current as any);
        timerRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);
        return;
      }

      if (now >= persisted.endTime) {
        // Session expired while app was killed — resume in bonus time mode
        setSelectedTime(persisted.targetDuration);
        setSelectedTag(persisted.tagId);
        setRemainingSeconds(0);
        setIsInfinite(false);
        setIsRunning(true);
        setIsSessionActive(true);
        setTodoListVisible(true);
        sessionStartTimeRef.current = persisted.startTime;
        sessionEndTimeRef.current = persisted.endTime;
        sessionTargetDurationRef.current = persisted.targetDuration;

        const bonus = Math.floor((now - persisted.endTime) / 1000);
        setIsBonusTime(true);
        setBonusSeconds(bonus);

        // Switch visuals to timer mode immediately
        scrollerOpacity.setValue(0);
        tagsOpacity.setValue(0);
        headerOpacity.setValue(0);
        timerOpacity.setValue(1);
        timerScale.setValue(1);
        timerTranslateY.setValue(0);

        // Start bonus count-up interval
        if (timerRef.current) clearInterval(timerRef.current as any);
        timerRef.current = setInterval(() => {
          setBonusSeconds((b) => b + 1);
        }, 1000);
      } else {
        // Session still running — resume the timer
        const remainingMs = persisted.endTime - now;
        // Use Math.floor to match SwiftUI's Text(date, style: .timer) truncation
        const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));

        setSelectedTime(persisted.targetDuration);
        setSelectedTag(persisted.tagId);
        setRemainingSeconds(remainingSec);
        setIsInfinite(false);
        setIsRunning(true);
        setIsSessionActive(true);
        setTodoListVisible(true);
        sessionStartTimeRef.current = persisted.startTime;
        sessionEndTimeRef.current = persisted.endTime;
        sessionTargetDurationRef.current = persisted.targetDuration;

        // Switch visuals to timer mode immediately (no animation needed on recovery)
        scrollerOpacity.setValue(0);
        tagsOpacity.setValue(0);
        headerOpacity.setValue(0);
        timerOpacity.setValue(1);
        timerScale.setValue(1);
        timerTranslateY.setValue(0);

        // Start the countdown interval
        if (timerRef.current) clearInterval(timerRef.current as any);
        timerRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              // Enter bonus time mode
              if (timerRef.current) clearInterval(timerRef.current as any);
              timerRef.current = null;
              setIsBonusTime(true);
              setBonusSeconds(0);

              timerRef.current = setInterval(() => {
                setBonusSeconds((b) => b + 1);
              }, 1000);

              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e) {
      // Corrupted data — just clear it
      AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  };

  // Adopt widget session + recover from AsyncStorage on mount (cold start)
  useEffect(() => {
    adoptAndRecoverSession();
  }, []);

  const handleStartFocus = () => {
    if (isUnlockActive) {
      handleStopUnlock();
      return;
    }

    // If running or transitioning, treat as Stop/Cancel with animation
    if (isRunning || isSessionActive) {
      stopWithAnimation();
      return;
    }

    // If no tags exist, open the tag picker plus the new-tag modal so that
    // creating the first tag lands the user back in the (now non-empty) list.
    if (availableTags.length === 0) {
      setShowTagModal(true);
      setShowNewTagModal(true);
      return;
    }

    // If no tag selected (shouldn't happen with default), select first
    if (!selectedTag) {
      if (availableTags.length > 0) {
        setSelectedTag(availableTags[0].id);
      }
      return;
    }

    // Start flow: switch button to Stop immediately
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSessionActive(true);
    transitionCancelledRef.current = false;

    // Set the display value before the timer fades in
    if (selectedTime === 0) {
      setElapsedSeconds(0);
    } else {
      setRemainingSeconds(selectedTime * 60);
    }

    // Prepare timer visuals for entrance
    timerOpacity.setValue(0);
    timerScale.setValue(0.94);
    timerTranslateY.setValue(6);

    // Fade out scroller, tags, and the blocklist icon.
    Animated.parallel([
      Animated.timing(scrollerOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(tagsOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (transitionCancelledRef.current) return;
      // Start the countdown immediately as the timer fades in, not after the spring settles
      startTimer();
      Animated.parallel([
        Animated.timing(timerOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(timerScale, {
          toValue: 1,
          stiffness: 220,
          damping: 20,
          mass: 0.6,
          useNativeDriver: true,
        }),
        Animated.spring(timerTranslateY, {
          toValue: 0,
          stiffness: 220,
          damping: 20,
          mass: 0.6,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Mount the TODO list only after the entrance settles, so its heavy
        // Reanimated rows don't jank the countdown/picker transition. Guard the
        // start→quick-stop race: sessionStartTimeRef is null once a stop has torn
        // the session down, so we don't re-show the list after it was hidden.
        // Reanimated drives the appearance: the list fades in (entering) and the
        // timer container glides up via its LinearTransition layout animation.
        // (LayoutAnimation is a no-op under the New Architecture — which is why the
        // earlier duration/easing tweaks had no visible effect.)
        if (sessionStartTimeRef.current) setTodoListVisible(true);
      });
    });
  };

  // Guard the Start/Stop toggle against fast double-taps. Without this, a second
  // tap lands after the first has flipped `isSessionActive`, so it falls into the
  // Stop branch and immediately cancels the session it just started.
  const handleStartFocusGuarded = useThrottledPress(handleStartFocus);

  // --- Auto-start a focus session for a Journal TODO (swipe-left → start) ---
  // The TODO sheet navigates here with { startTagId, startDuration, autostart, ts }.
  // We can't reuse the store start path directly because the real start flow lives
  // in this component (animations + native monitoring), so we prime the same tag +
  // duration state the user would pick, then fire the existing start handler once
  // the state has settled.
  const focusParams = useLocalSearchParams<{
    startTagId?: string;
    startDuration?: string;
    autostart?: string;
    ts?: string;
    openBlocklist?: string;
  }>();
  const pendingStartRef = useRef<{ tagId: string; duration: number } | null>(null);
  // Bumped each time a start is requested so the commit effect below runs even when
  // setSelectedTag/setSelectedTime are no-ops (home already had that tag/duration) —
  // otherwise the effect's deps wouldn't change and the start would silently never fire.
  const [autostartNonce, setAutostartNonce] = useState(0);

  useEffect(() => {
    if (focusParams.autostart === '1' && focusParams.startTagId) {
      // Bail before touching selectedTag/selectedTime when a session is already live.
      // Mutating those mid-session would retag the ongoing session (it's finalized with
      // `selectedTag` on stop), so we abort with a toast instead of silently corrupting it.
      if (isRunning || isSessionActive) {
        showToast(t('home.sessionAlreadyRunning'), 'neutral');
        router.setParams({
          startTagId: undefined,
          startDuration: undefined,
          autostart: undefined,
          ts: undefined,
        });
        return;
      }
      const dur = Number(focusParams.startDuration) || 15;
      pendingStartRef.current = { tagId: String(focusParams.startTagId), duration: dur };
      setSelectedTag(String(focusParams.startTagId));
      setSelectedTime(dur);
      setAutostartNonce((n) => n + 1);
      // Clear the params so returning to this tab later doesn't re-trigger a start.
      router.setParams({
        startTagId: undefined,
        startDuration: undefined,
        autostart: undefined,
        ts: undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParams.ts]);

  // Runs on the render that commits the primed tag/duration (same batched update as
  // the nonce bump), so handleStartFocus closes over the right values.
  useEffect(() => {
    const pending = pendingStartRef.current;
    if (!pending) return;
    pendingStartRef.current = null;
    // Can't start over a live/transitioning session — that would toggle Stop instead.
    if (isRunning || isSessionActive) return;
    handleStartFocusGuarded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostartNonce]);

  // Arrivals that want the blocklist (the "Silence the distractions" re-engagement
  // nudge, the coach's block_apps action) land here rather than pushing
  // /(modals)/app-selection directly: the picker is Apple's FamilyActivityPicker,
  // which renders empty without Family Controls authorization, and that whole gate
  // — Screen Time guide, permission prompt, first-time tip — lives in
  // handleBlockList. The param carries a timestamp so each arrival is distinct.
  useEffect(() => {
    if (!focusParams.openBlocklist) return;
    router.setParams({ openBlocklist: undefined });
    handleBlockList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParams.openBlocklist]);

  // Full right→left swipe on a tag row in the picker: prime the tag + its
  // last-used duration, close the picker, and fire the same autostart path the
  // Journal TODO / goal-row swipes use.
  const handleStartSessionFromTag = useCallback(
    (tag: { id: string }) => {
      if (isRunning || isSessionActive) {
        showToast(t('home.sessionAlreadyRunning'), 'neutral');
        return;
      }
      const duration = lastDurationByTagId[tag.id] ?? 15;
      pendingStartRef.current = { tagId: tag.id, duration };
      setSelectedTag(tag.id);
      setLastSelectedTagId(tag.id);
      WidgetService.syncSelectedTagId(tag.id);
      setSelectedTime(duration);
      setShowTagModal(false);
      setAutostartNonce((n) => n + 1);
    },
    [isRunning, isSessionActive, lastDurationByTagId, setLastSelectedTagId, t]
  );

  const handleTimeChange = (time: number) => {
    setSelectedTime(time);
    if (selectedTag) {
      setLastDurationForTag(selectedTag, time);
      // Sync updated duration to widget immediately
      const updatedDurations = { ...lastDurationByTagId, [selectedTag]: time };
      // Compute most recent session time per tag
      const lastUsedByTag: Record<string, number> = {};
      for (const sid of sessions.allIds) {
        const s = sessions.byId[sid];
        if (!s) continue;
        const t =
          s.startTime instanceof Date ? s.startTime.getTime() : new Date(s.startTime).getTime();
        if (!lastUsedByTag[s.tagId] || t > lastUsedByTag[s.tagId]) {
          lastUsedByTag[s.tagId] = t;
        }
      }
      const tagList = tags.allIds
        .map((id) => tags.byId[id])
        .filter((tag) => tag && !tag.deletedAt)
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          icon: tag.icon || '🎯',
          color: tag.color || '#8B4513',
          lastDuration: updatedDurations[tag.id] ?? 15,
          lastUsedAt: lastUsedByTag[tag.id] ?? 0,
        }));
      WidgetService.syncTagList(tagList);
      // Update any idle Live Activity with the new duration
      if (!isRunning) {
        const tagObj = tags.byId[selectedTag];
        const tagLabel = tagObj ? `${tagObj.icon || '🎯'} ${tagObj.name}` : 'Focus';
        LiveActivityService.showIdleFocusActivity(tagLabel, selectedTag, time);
      }
    }
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const displayTime = isBonusTime
    ? `+${formatTime(bonusSeconds)}`
    : isInfinite
      ? formatTime(elapsedSeconds)
      : formatTime(remainingSeconds);
  const timerDisplayTime = isUnlockActive ? formatTime(unlockRemainingSeconds) : displayTime;
  const timerTextColor =
    isBonusTime && !isUnlockActive
      ? colors.success
      : colorScheme === 'dark'
        ? colors.dark.textPrimary
        : colors.light.screenTextPrimary;

  const selectedTagObj = selectedTag
    ? tags.byId[selectedTag] || challengeTags.find((ct) => ct.id === selectedTag) || null
    : null;
  const selectedTagName = selectedTagObj?.name || null;

  const saveSessionAndNavigate = (notes?: string, includeBonusTime: boolean = true) => {
    const wasBonus = stoppedInBonusRef.current;
    const savedBonusSeconds = stoppedBonusSecondsRef.current;
    const sessionStart = stoppedSessionStartTimeRef.current;
    // Use captured ref for target duration — immune to state overwrites and being cleared early
    const targetDuration =
      stoppedSessionTargetDurationRef.current ?? sessionTargetDurationRef.current ?? selectedTime;
    const isDevTimer = targetDuration === -1;
    const baseMinutes = isDevTimer ? 1 : targetDuration;
    const baseSeconds = isDevTimer ? 5 : targetDuration * 60;

    // Use wall-clock time from refs (immune to state race conditions after rehydration)
    const now = Date.now();
    const totalElapsedSeconds = sessionStart ? Math.floor((now - sessionStart) / 1000) : 0;

    let actualDuration: number;
    let totalSeconds: number;

    if (wasBonus) {
      // Session completed its target duration and entered bonus time
      const bonusMinutes = Math.floor(savedBonusSeconds / 60);
      actualDuration = baseMinutes + (includeBonusTime ? bonusMinutes : 0);
      totalSeconds = baseSeconds + (includeBonusTime ? savedBonusSeconds : 0);
    } else if (sessionStart) {
      // Session stopped before completion — use wall-clock elapsed time
      actualDuration = Math.floor(totalElapsedSeconds / 60);
      totalSeconds = totalElapsedSeconds;
    } else {
      // Fallback: derive from state (original logic, for safety)
      actualDuration = isInfinite
        ? Math.floor(elapsedSeconds / 60)
        : Math.floor((baseSeconds - remainingSeconds) / 60);
      totalSeconds = isInfinite ? elapsedSeconds : baseSeconds - remainingSeconds;
    }

    // Only create session if duration is meaningful (1+ minutes or dev timer)
    // Stopping within the first minute cancels the session
    const hasMinimumDuration = actualDuration >= 1 || isDevTimer;

    if (hasMinimumDuration) {
      const startTime = sessionStart ? new Date(sessionStart) : new Date(now - totalSeconds * 1000);
      const endTime = new Date(now);

      const session = createCompletedSession({
        startTime,
        endTime,
        duration: Math.max(1, actualDuration),
        targetDuration: isInfinite ? Math.max(1, actualDuration) : baseMinutes,
        tagId: selectedTag!,
        notes: notes || undefined,
      });

      // Navigate to session complete modal
      router.push({ pathname: '/(modals)/session-complete', params: { sessionId: session.id } });
    } else {
      showToast(t('home.sessionCancelled'), 'neutral');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      <SwipeableTabWrapper currentTab="index">
        {/* Header: Blocklist Icon (Left) + Fruit Counter (Right) */}
        <View className="absolute left-0 right-0 top-4 z-50 flex-row items-center justify-between px-8">
          <Animated.View
            style={{ opacity: isUnlockActive ? 0 : headerOpacity }}
            pointerEvents={isSessionActive || isUnlockActive ? 'none' : 'auto'}>
            <Pressable
              onPress={handleBlockList}
              className="flex-row items-center active:opacity-70"
              hitSlop={8}>
              <Ionicons
                name="ban-outline"
                size={22}
                color={
                  colorScheme === 'dark'
                    ? colors.dark.textSecondary
                    : colors.light.screenTextSecondary
                }
              />
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textSecondary
                      : colors.light.screenTextSecondary,
                  fontSize: 13,
                  fontWeight: '500',
                  marginLeft: 6,
                }}>
                {t('home.blockList')}
              </Text>
              {blockedCount > 0 && (
                <View className="ml-1.5 min-w-[20px] items-center rounded-full bg-primary px-1.5 py-0.5">
                  <Text style={{ color: colors.white, fontSize: 11, fontWeight: '600' }}>
                    {blockedCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
          <Animated.View
            style={{ opacity: isUnlockActive ? 0 : 1 }}
            pointerEvents={isUnlockActive ? 'none' : 'auto'}>
            <FruitCounter
              fruitCount={rewards.balance}
              size="small"
              showBadge={hasUnclaimedRewards || hasPendingGiftAction}
              onPress={() => {
                AnalyticsTracker.track('store_opened');
                router.push('/fruit-store');
              }}
            />
          </Animated.View>
        </View>

        <View className="flex-1 items-center justify-center px-4">
          {/* Time Selector or Running Timer - stacked and crossfaded.
              LinearTransition makes this container glide up/down smoothly when the
              TODO list below it mounts/unmounts and reflows the centred column.
              Only enabled while a session is active/ending — otherwise the layout
              that settles right after cold mount (store hydration, font measuring,
              selectedTag restore) would animate as an unwanted vertical jump. */}
          <Reanimated.View
            layout={isSessionActive || todoListVisible ? LinearTransition.duration(550) : undefined}
            style={{
              height: 300,
              width: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible',
            }}>
            <Animated.View
              style={{
                position: 'absolute',
                opacity: isUnlockActive ? 0 : scrollerOpacity,
                width: '100%',
                zIndex: 0,
              }}
              pointerEvents={isRunning || isUnlockActive ? 'none' : 'auto'}>
              {timerPickerStyle === 'wheel' ? (
                <DurationPicker selectedTime={selectedTime} onTimeChange={handleTimeChange} />
              ) : (
                <TimeScroller selectedTime={selectedTime} onTimeChange={handleTimeChange} />
              )}
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute',
                opacity: isUnlockActive ? 1 : timerOpacity,
                transform: [
                  { scale: isUnlockActive ? 1 : timerScale },
                  { translateY: isUnlockActive ? 0 : timerTranslateY },
                ],
                zIndex: 100,
                alignItems: 'center',
              }}>
              {/* Gate on isSessionActive (set synchronously at start) rather than
                isRunning — isRunning's re-render lands behind startTimer()'s heavy
                synchronous native work, so gating on it makes the tag/hint appear
                ~1s after the natively-animated countdown number. */}
              {isSessionActive && !isBonusTime && !isUnlockActive && (
                <View style={{ alignItems: 'center', marginBottom: 4, paddingHorizontal: 16 }}>
                  {selectedTagName && (
                    <Text
                      style={{
                        color:
                          colorScheme === 'dark'
                            ? colors.dark.textPrimary
                            : colors.light.screenTextPrimary,
                        fontSize: 24,
                        lineHeight: 28,
                        fontFamily: 'Poppins-SemiBold',
                        textAlign: 'center',
                        marginBottom: 4,
                      }}>
                      {selectedTagObj?.icon ? `${selectedTagObj.icon} ` : ''}
                      {selectedTagName}
                    </Text>
                  )}
                  <Text
                    style={{
                      color:
                        colorScheme === 'dark'
                          ? colors.dark.textSecondary
                          : colors.light.screenTextSecondary,
                      fontSize: 12,
                      lineHeight: 18,
                      fontFamily: 'Poppins-Regular',
                      textAlign: 'center',
                    }}>
                    {t('home.growHint')}
                  </Text>
                </View>
              )}
              {isBonusTime && !isUnlockActive && (
                <View style={{ alignItems: 'center', marginBottom: 4, paddingHorizontal: 16 }}>
                  <Text
                    style={{
                      color: colors.success,
                      fontSize: 20,
                      lineHeight: 26,
                      fontFamily: 'Poppins-SemiBold',
                      textAlign: 'center',
                    }}>
                    {t('home.overTime')}
                  </Text>
                </View>
              )}
              <Animated.Text
                style={{
                  fontSize: 96,
                  lineHeight: 120,
                  color: timerTextColor,
                  fontFamily: 'Poppins-Bold',
                  textAlign: 'center',
                }}>
                {timerDisplayTime}
              </Animated.Text>
            </Animated.View>
          </Reanimated.View>

          {/* Focus Button (kept mounted, fade only) — swapped for the running
              tag's TODO list once a session is active. */}
          <View
            style={{ width: '100%', marginBottom: 64, minHeight: 96, justifyContent: 'center' }}>
            {todoListVisible && !isUnlockActive && selectedTag ? (
              <RunningTodoList
                tagId={selectedTag}
                accentColor={selectedTagObj?.color}
                onAddTodo={() => setShowAddTodoModal(true)}
              />
            ) : (
              <Animated.View
                style={{ opacity: isUnlockActive ? 0 : tagsOpacity }}
                pointerEvents={isRunning || isUnlockActive ? 'none' : 'auto'}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowTagModal(true);
                  }}
                  className="flex-row items-center justify-between rounded-2xl bg-light-border/30 px-6 py-4 active:opacity-80 dark:bg-dark-card">
                  <View className="flex-row items-center">
                    <Typography variant="subtitle-16" color="primary">
                      {availableTags.length === 0
                        ? t('home.createNewTag')
                        : selectedTagName || t('home.selectTag')}
                    </Typography>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={
                      colorScheme === 'dark'
                        ? colors.dark.textPrimary
                        : colors.light.screenTextPrimary
                    }
                  />
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>

        {/* Start/Stop Button - Fixed at bottom */}
        <View className="px-4 pb-8">
          <Pressable
            onPress={handleStartFocusGuarded}
            className="items-center rounded-2xl bg-white py-4 active:opacity-80 dark:bg-white"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}>
            <Typography
              variant="subtitle-16"
              className="font-semibold"
              style={{
                color:
                  colorScheme === 'dark' ? colors.dark.background : colors.light.screenTextPrimary,
              }}>
              {isUnlockActive
                ? t('home.stopUnlocked')
                : isSessionActive
                  ? t('home.stopFocus')
                  : availableTags.length === 0
                    ? t('home.createTagFirst')
                    : t('home.startFocus')}
            </Typography>
          </Pressable>
          {isUnlockActive && (
            <Typography variant="body-12" color="secondary" className="mt-3 text-center">
              {t('home.unusedTimeReturned')}
            </Typography>
          )}
        </View>

        {/* Tag picker — slide-up sheet (grab handle + drag-to-dismiss). Share
            overlay + coach mark ride the sheet's overlay slot so they cover the
            full screen without a second native modal. */}
        <BottomSheet
          isVisible={showTagModal}
          onClose={() => setShowTagModal(false)}
          scrollable
          // Freeze the sheet's own scroll + pull-to-dismiss while a row is being
          // long-press dragged, or those gestures fight the reorder drag (they
          // claim the same downward pull) and the row never moves.
          scrollEnabled={!isDragging}
          height={Math.max(
            360,
            Math.min(screenHeight * 0.85, 240 + orderedTags.length * ROW_HEIGHT)
          )}
          footer={
            <View className="flex-row gap-3 border-t border-light-border px-6 pb-2 pt-3 dark:border-dark-border">
              <Button
                variant="primary"
                size="large"
                className="flex-1 rounded-2xl py-4"
                onPress={() => {
                  if (!canCreateTag) {
                    // Keep the picker open — the paywall is nested in its overlay
                    // (below) so iOS presents it on top; closing the picker here
                    // would make the paywall a sibling of a dismissing modal and
                    // it would fail to present (dead, untappable overlay).
                    triggerTagUpgrade();
                    return;
                  }
                  setShowNewTagModal(true);
                }}>
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  {t('home.newTag')}
                </Typography>
              </Button>
            </View>
          }
          overlay={
            <>
              {/* Tag Swipe Coach Mark */}
              <CoachMark
                targetRef={firstTagRef as React.RefObject<View>}
                title={t('home.coachTitle')}
                message={t('home.coachMessage')}
                visible={showTagSwipeCoachMark && !preferences.hasSeenTagSwipeHint}
                onDismiss={() => {
                  setShowTagSwipeCoachMark(false);
                  updatePreferences({ hasSeenTagSwipeHint: true });
                }}
              />

              {/* Edit Tag — stacked sheet. Nested inside the picker's Modal (not
                  a sibling) so iOS actually presents it on top; sibling modals
                  over an already-presented modal fail silently. */}
              <EditTagSheet
                visible={showEditTagModal}
                tagId={editingTagId}
                onClose={() => {
                  setShowEditTagModal(false);
                  setEditingTagId(null);
                }}
              />

              {/* New Tag Creation — shared modal, also nested on the picker. */}
              <CreateTagModal
                visible={showNewTagModal}
                onClose={() => setShowNewTagModal(false)}
                onUpgradeNeeded={triggerTagUpgrade}
                onCreated={(newTag) => {
                  setSelectedTag(newTag.id);
                  setLastSelectedTagId(newTag.id);
                  WidgetService.syncSelectedTagId(newTag.id);
                }}
              />

              {/* Tag-limit paywall — nested here (not at screen root) so it
                  presents on top of the still-open picker; a root sibling would
                  fail to present over the picker's Modal. Prompt → sheet is
                  sequenced inside the hook to avoid the same present failure. */}
              {tagUpgradeModals}
            </>
          }>
          {/* Header */}
          <View className="mb-4">
            <Typography variant="headline-20" color="primary">
              {t('home.selectFocus')}
            </Typography>
          </View>

          {/* Tags list */}
          {orderedTags.length === 0 && (
            <View className="items-center px-2 py-6">
              <Typography variant="body-14" color="secondary" className="text-center leading-5">
                {t('home.emptyTagsHint')}
              </Typography>
            </View>
          )}
          {orderedTags.map((tag, index) => (
            <View key={tag.id} ref={index === 0 ? firstTagRef : undefined} collapsable={false}>
              <DraggableTagRow
                tag={tag}
                index={index}
                selectedTag={selectedTag}
                lastDuration={lastDurationByTagId[tag.id] ?? 15}
                todoCount={openTodoCountByTagId[tag.id] ?? 0}
                isDragging={isDragging}
                dragOriginalIndex={dragOriginalIdx}
                dragTargetIndex={dragTargetIdx}
                isChallenge={'isChallenge' in tag && tag.isChallenge === true}
                onSelect={handleTagSelect}
                onEdit={handleEditTag}
                onDelete={handleDeleteTag}
                onStartSession={handleStartSessionFromTag}
                onSwipeOpen={handleSwipeOpen}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
              />
            </View>
          ))}
        </BottomSheet>

        {/* Blocklist Tip Modal */}
        <Modal
          visible={showBlocklistTip}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBlocklistTip(false)}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/50 px-6"
            onPress={() => setShowBlocklistTip(false)}>
            <Pressable
              onPress={() => {}}
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-light-bg p-6 dark:bg-dark-bg">
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textPrimary
                      : colors.light.screenTextPrimary,
                  fontSize: 17,
                  fontWeight: '600',
                  marginBottom: 12,
                }}>
                {t('home.blockList')}
              </Text>
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textSecondary
                      : colors.light.screenTextSecondary,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 24,
                }}>
                {t('home.blocklistTipBody')}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                <Pressable
                  onPress={() => setShowBlocklistTip(false)}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                  <Text
                    style={{
                      color:
                        colorScheme === 'dark'
                          ? colors.dark.textSecondary
                          : colors.light.screenTextSecondary,
                      fontSize: 15,
                      fontWeight: '500',
                    }}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleBlocklistTipUnderstood}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: colors.primary,
                  }}>
                  <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>
                    {t('home.understood')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Screen Time Permission Guide (shown before the native prompt) */}
        <Modal
          visible={showScreenTimeGuide}
          transparent
          animationType="fade"
          onRequestClose={() => setShowScreenTimeGuide(false)}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/50 px-6"
            onPress={() => setShowScreenTimeGuide(false)}>
            <Pressable
              onPress={() => {}}
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-light-bg p-6 dark:bg-dark-bg">
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textPrimary
                      : colors.light.screenTextPrimary,
                  fontSize: 17,
                  fontWeight: '600',
                  marginBottom: 8,
                }}>
                {t('home.screenTimeGuideTitle')}
              </Text>
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textSecondary
                      : colors.light.screenTextSecondary,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 16,
                }}>
                {t('home.screenTimeGuideBody')}
              </Text>

              {/* Screenshot of the native prompt with a callout pointing at Continue */}
              <Image
                source={
                  colorScheme === 'dark'
                    ? require('../../assets/screen-time-request-dark.jpg')
                    : require('../../assets/screen-time-request.jpg')
                }
                style={{
                  width: '100%',
                  height: 200,
                  borderRadius: 12,
                }}
                resizeMode="contain"
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  marginLeft: '10%',
                  marginTop: 4,
                  marginBottom: 20,
                }}>
                <Ionicons name="arrow-up" size={18} color={colors.primary} />
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: '600',
                    marginLeft: 6,
                  }}>
                  {t('home.screenTimeGuideHint')}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                <Pressable
                  onPress={() => setShowScreenTimeGuide(false)}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                  <Text
                    style={{
                      color:
                        colorScheme === 'dark'
                          ? colors.dark.textSecondary
                          : colors.light.screenTextSecondary,
                      fontSize: 15,
                      fontWeight: '500',
                    }}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setShowScreenTimeGuide(false);
                    await requestAuthAndOpenPicker();
                  }}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: colors.primary,
                  }}>
                  <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>
                    {t('home.screenTimeGuideConfirm')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Edit Cost Confirmation Modal */}
        <Modal
          visible={showEditCostModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEditCostModal(false)}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/50 px-6"
            onPress={() => setShowEditCostModal(false)}>
            <Pressable
              onPress={() => {}}
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-light-bg p-6 dark:bg-dark-bg">
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textPrimary
                      : colors.light.screenTextPrimary,
                  fontSize: 17,
                  fontWeight: '600',
                  marginBottom: 12,
                }}>
                {t('home.editBlockList')}
              </Text>
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textSecondary
                      : colors.light.screenTextSecondary,
                  fontSize: 14,
                  lineHeight: 20,
                  marginBottom: 15,
                }}>
                {t('home.editCostBody')}
              </Text>
              <Text
                style={{
                  color:
                    colorScheme === 'dark'
                      ? colors.dark.textPrimary
                      : colors.light.screenTextPrimary,
                  fontSize: 15,
                  fontWeight: '500',
                  marginBottom: 15,
                }}>
                {t('home.editCostAmount', { cost: blocklistEditCost.cost })}
              </Text>
              {!blocklistEditCost.canAfford && (
                <Text style={{ color: colors.danger, fontSize: 13, marginBottom: 24 }}>
                  {t('home.notEnoughFruits')}
                </Text>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                <Pressable
                  onPress={() => setShowEditCostModal(false)}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                  <Text
                    style={{
                      color:
                        colorScheme === 'dark'
                          ? colors.dark.textSecondary
                          : colors.light.screenTextSecondary,
                      fontSize: 15,
                      fontWeight: '500',
                    }}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setShowEditCostModal(false);
                    await proceedToBlockList();
                  }}
                  disabled={!blocklistEditCost.canAfford}
                  style={{
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: colors.primary,
                    opacity: blocklistEditCost.canAfford ? 1 : 0.5,
                  }}>
                  <Text style={{ color: colors.white, fontSize: 15, fontWeight: '600' }}>
                    {t('common.confirm')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Create-todo sheet for the "Add a TODO" action under the running list */}
        <TodoEditModal
          isVisible={showAddTodoModal}
          onClose={() => setShowAddTodoModal(false)}
          todo={null}
          initialTagId={selectedTag}
        />
      </SwipeableTabWrapper>
    </SafeAreaView>
  );
}
