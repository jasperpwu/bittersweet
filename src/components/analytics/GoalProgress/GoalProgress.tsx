import React, { FC, RefObject, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useIsFocused } from 'expo-router';
import { router } from 'expo-router';
import { View, Text, Pressable, Share, Platform } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import { Typography } from '../../ui/Typography';
import { useTranslation } from 'react-i18next';
import { FocusGoal } from '../../../store/types';
import { useFocus } from '../../../store';
import { useAppSettings } from '../../../store/unified-store';
import {
  calculateGoalProgress,
  calculateGoalStreak,
  getHistoricalPeriodRanges,
  getTargetForDate,
  getSessionMinutesInPeriod,
  getGoalCurrentTarget,
  getGoalOffKeys,
  getPeriodKey,
} from '../../../utils/goalProgress';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { calculateUrgency, UrgencyLevel } from '../../../utils/goalUrgency';
import { colors } from '../../../config/theme';
import { useSliderTheme } from '../../../hooks/useSliderTheme';

interface GoalProgressProps {
  goals: FocusGoal[];
  inactiveGoals?: FocusGoal[];
  currentPeriodProgress: Record<string, number>;
  onEditGoal?: (goalId: string) => void;
  onDeleteGoal?: (goalId: string) => void;
  onConcludeGoal?: (goalId: string) => void;
  onActivateGoal?: (goalId: string) => void;
  onReorderGoals?: (orderedIds: string[]) => void;
  /**
   * Spotlight targets for the Goals tab walkthrough. Each lands on whichever
   * variant of the section is actually rendered: the activate target on the
   * unactivated-goals list (or the CTA when there is none), the row target on
   * the first real goal row (or the example row shown in its place).
   */
  introActivateRef?: RefObject<View | null>;
  introGoalRowRef?: RefObject<View | null>;
  /** Walkthrough: reveal the first goal row's actions (the Badge button). */
  introSwipeOpen?: boolean;
}

interface ProcessedGoal extends FocusGoal {
  currentProgress: number;
  percentage: number;
  _effectiveTarget?: number;
}

const GOAL_THRESHOLD_PERCENT = 84;
const GOAL_OVERFLOW_PERCENT = 100 - GOAL_THRESHOLD_PERCENT;

const getGoalBarSegments = (currentMinutes: number, targetMinutes: number) => {
  if (targetMinutes <= 0) {
    return {
      progressWidth: 0,
      exceededWidth: 0,
    };
  }

  const progressWidth = Math.min(
    (currentMinutes / targetMinutes) * GOAL_THRESHOLD_PERCENT,
    GOAL_THRESHOLD_PERCENT
  );
  const exceededWidth =
    currentMinutes > targetMinutes
      ? Math.min(
          ((currentMinutes - targetMinutes) / targetMinutes) * GOAL_THRESHOLD_PERCENT,
          GOAL_OVERFLOW_PERCENT
        )
      : 0;

  return {
    progressWidth,
    exceededWidth,
  };
};

const ROW_HEIGHT = 84; // row height + mb-3 gap — must match DraggableTagRow in index.tsx
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

// ---------- Draggable Goal Row (mirrors DraggableTagRow from index.tsx) ----------

type DraggableGoalRowProps = {
  goal: ProcessedGoal;
  index: number;
  tags: { byId: Record<string, any>; allIds: string[] };
  isDragging: boolean;
  dragOriginalIndex: number;
  dragTargetIndex: number;
  onPress: () => void;
  onEdit?: (goalId: string) => void;
  onDelete?: (goalId: string) => void;
  onConclude?: (goalId: string) => void;
  onStartSession?: (goal: ProcessedGoal) => void;
  onSwipeOpen?: (ref: any) => void;
  onDragStart: (index: number) => void;
  onDragMove: (translationY: number) => void;
  onDragEnd: () => void;
  shouldNudge: boolean;
  /**
   * Walkthrough control: `true` slides the row open on its management actions so
   * the Badge button is visible while the coach mark talks about it, `false`
   * slides it back. `undefined` leaves the row alone.
   */
  introOpen?: boolean;
};

function DraggableGoalRow({
  goal,
  index,
  tags,
  isDragging,
  dragOriginalIndex,
  dragTargetIndex,
  onPress,
  onEdit,
  onDelete,
  onConclude,
  onStartSession,
  onSwipeOpen,
  onDragStart,
  onDragMove,
  onDragEnd,
  shouldNudge,
  introOpen,
}: DraggableGoalRowProps) {
  const { t } = useTranslation();
  const isBeingDragged = isDragging && dragOriginalIndex === index;
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const displacement = useSharedValue(0);
  const gestureActive = useSharedValue(false);

  const nudgeX = useSharedValue(0);
  const swipeableRef = useRef<any>(null);
  const didSwipe = useRef(false);
  const firedRef = useRef(false);

  // Swipe hint: nudge left briefly on first-ever mount, staggered per row
  React.useEffect(() => {
    if (!shouldNudge) return;
    const delay = 400 + index * 120;
    nudgeX.value = withDelay(
      delay,
      withSequence(
        withTiming(-30, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 12, stiffness: 180 })
      )
    );
  }, [shouldNudge]);

  // Show, then put back, the management actions during the goals walkthrough.
  // openLeft() reports as a 'right' swipe (translation sign), so handleWillOpen
  // treats it as a plain reveal and never fires the start-session commit.
  React.useEffect(() => {
    if (introOpen === undefined) return;
    if (introOpen) swipeableRef.current?.openLeft();
    else swipeableRef.current?.close();
  }, [introOpen]);

  // Reset shared values when drag ends and array has reordered
  React.useEffect(() => {
    if (!isDragging) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      displacement.value = 0;
    }
  }, [isDragging]);

  // Animate displacement for non-dragged items to make room
  React.useEffect(() => {
    if (!isDragging || isBeingDragged) return;

    const orig = dragOriginalIndex;
    const target = dragTargetIndex;
    let shift = 0;

    if (orig < target && index > orig && index <= target) {
      shift = -ROW_HEIGHT;
    } else if (orig > target && index >= target && index < orig) {
      shift = ROW_HEIGHT;
    }

    displacement.value = withSpring(shift, SPRING_CONFIG);
  }, [isDragging, isBeingDragged, dragOriginalIndex, dragTargetIndex, index]);

  const panGesture = Gesture.Pan()
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
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      if (gestureActive.value) {
        translateY.value = withSpring(0, SPRING_CONFIG);
        gestureActive.value = false;
      }
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: nudgeX.value },
      { translateY: isBeingDragged ? translateY.value : displacement.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  // Swipe left→right reveals the management actions (moved here from the right so
  // the right edge is free for the start-session gesture).
  const renderLeftActions = () => (
    <View className="mr-2 flex-row items-center">
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onEdit?.(goal.id);
        }}
        className="ml-2 h-full w-16 items-center justify-center rounded-lg bg-primary">
        <Typography variant="body-14" color="white">
          {t('common.edit')}
        </Typography>
      </Pressable>
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onConclude?.(goal.id);
        }}
        className="ml-2 h-full w-16 items-center justify-center rounded-lg"
        style={{ backgroundColor: '#F59E0B' }}>
        <Typography variant="body-14" color="white">
          {t('goalProgress.badge')}
        </Typography>
      </Pressable>
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete?.(goal.id);
        }}
        className="ml-2 h-full w-16 items-center justify-center rounded-lg bg-red-500">
        <Typography variant="body-14" color="white">
          {t('goalProgress.pause')}
        </Typography>
      </Pressable>
    </View>
  );

  // Swipe right→left reveals the Start panel; dragging past the threshold commits
  // (iOS-Mail-style full swipe) and starts a focus session for the goal's tag,
  // pre-filled with the goal's remaining minutes.
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
    // Leave the row OPEN — the revealed Start panel is the "it worked" confirmation.
    // Closing/resetting it here reads as a snap-back right before the tab switch,
    // which feels like the swipe failed. The parent closes it off-screen on blur.
    onStartSession?.(goal);
  };

  const pressScale = useSharedValue(1);

  const handlePress = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onPress();
  };

  const handlePressIn = () => {
    pressScale.value = withTiming(1.015, { duration: 200, easing: Easing.out(Easing.cubic) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const pressAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View
        style={[
          animatedStyle,
          isBeingDragged && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
          },
        ]}>
        <Swipeable
          ref={swipeableRef}
          renderLeftActions={renderLeftActions}
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
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={
              !goal.isRepeating || ((goal as any).activePeriod || (goal as any).period) === 'none'
            }>
            <Reanimated.View style={pressAnimatedStyle}>
              <GoalRowItem goal={goal} tags={tags} />
            </Reanimated.View>
          </Pressable>
        </Swipeable>
      </Reanimated.View>
    </GestureDetector>
  );
}

// ---------- Start-Session Swipe Action ----------

// Drag past this distance (px) and the Start commits on release. Kept low so a
// short, relaxed swipe triggers it — a faster flick commits even sooner via the
// swipe velocity that ReanimatedSwipeable factors into the release position.
export const START_ACTION_THRESHOLD = 44;

// Right-side swipe panel for a list row (goal rows here, tag rows on the home
// tab) — mirrors the TodoSheet's ActionPanel so the reveal stays buttery: the
// colored panel fills the swiped gap via flexbox (no per-frame width animation),
// and only the icon fades + scales in with the swipe `progress`. The actual
// start is committed by the row's full-swipe handler.
export const SwipeStartAction: FC<{ progress: SharedValue<number> }> = ({ progress }) => {
  const { t } = useTranslation();
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <View
      className="ml-2 flex-1 items-end justify-center rounded-lg"
      style={{ backgroundColor: COMPLETED_FILL, paddingHorizontal: 22 }}>
      <Reanimated.View style={iconStyle} className="items-center">
        <Ionicons name="play" size={22} color={colors.white} />
        <Typography variant="tiny-10" color="white">
          {t('goalProgress.start')}
        </Typography>
      </Reanimated.View>
    </View>
  );
};

// ---------- GoalProgress ----------

export const GoalProgress: FC<GoalProgressProps> = ({
  goals,
  inactiveGoals,
  currentPeriodProgress: _currentPeriodProgress,
  onEditGoal,
  onDeleteGoal,
  onConcludeGoal,
  onActivateGoal,
  onReorderGoals,
  introActivateRef,
  introGoalRowRef,
  introSwipeOpen,
}) => {
  const { t } = useTranslation();
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // Swipe nudge hint — use unified preferences
  const { preferences, updatePreferences } = useAppSettings();
  const shouldNudge = !preferences.hasSeenGoalSwipeHint && goals.length > 0;

  // Mark as seen after nudge animation plays
  useEffect(() => {
    if (shouldNudge) {
      // Mark seen after the nudge animation has played
      const timer = setTimeout(() => {
        updatePreferences({ hasSeenGoalSwipeHint: true });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldNudge]);

  // Drag-to-reorder state — mirrors index.tsx tag drag pattern exactly
  const [isDragging, setIsDragging] = useState(false);
  const [dragOriginalIdx, setDragOriginalIdx] = useState(-1);
  const [dragTargetIdx, setDragTargetIdx] = useState(-1);
  const dragOriginalIdxRef = useRef(-1);
  const dragTargetIdxRef = useRef(-1);

  // Track open swipeable refs to close others
  const openSwipeableRef = useRef<any>(null);

  // A committed Start swipe intentionally leaves its row open (Start panel showing)
  // as it navigates away — closing it there would read as a snap-back. Close it here
  // once the screen loses focus, so it's reset off-screen (close() also fires
  // onSwipeableClose, which clears the row's fired-guard for next time).
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused && openSwipeableRef.current) {
      openSwipeableRef.current.close?.();
      openSwipeableRef.current = null;
    }
  }, [isFocused]);

  // Get tags and sessions from store for real data
  const { tags, sessions, lastDurationByTagId } = useFocus();
  // Both of these feed useMemo dependency lists below (goal progress, and the
  // streak walk inside GoalConsistencyCalendar). Built inline they were fresh
  // references on every render, so every downstream memo missed and recomputed —
  // including the streak, which is now unbounded and the most expensive of them.
  const restDays = useMemo(() => preferences.restDays ?? [0, 6], [preferences.restDays]);
  const weekStartDay = 1; // Always Monday

  // Extract sessions array from normalized state
  const safeSessions = useMemo(
    () =>
      sessions && sessions.allIds && sessions.byId
        ? sessions.allIds.map((id) => sessions.byId[id]).filter(Boolean)
        : [],
    [sessions]
  );

  // Create tag map for name/ID conversion
  const tagMap = useMemo(
    () =>
      (tags && tags.allIds && tags.byId ? tags.allIds : []).reduce(
        (map, id) => {
          if (tags && tags.byId) {
            const tag = tags.byId[id];
            if (tag) {
              map[id] = { id: tag.id, name: tag.name };
            }
          }
          return map;
        },
        {} as Record<string, { id: string; name: string }>
      ),
    [tags]
  );

  // Calculate fresh goal progress from current session data
  const freshGoalProgress = useMemo(
    () => calculateGoalProgress(goals || [], safeSessions, tagMap, weekStartDay),
    [goals, safeSessions, tagMap, weekStartDay]
  );

  // Process goals to calculate progress (flat list, preserving allIds order)
  const processedGoals: ProcessedGoal[] = useMemo(
    () =>
      (goals || []).map((goal) => {
        const currentProgress = freshGoalProgress[goal.id] || 0;
        const effectiveTarget = getTargetForDate(goal, new Date(), restDays);
        const percentage = effectiveTarget > 0 ? (currentProgress / effectiveTarget) * 100 : 0;
        return { ...goal, currentProgress, percentage, _effectiveTarget: effectiveTarget };
      }),
    [goals, freshGoalProgress, restDays]
  );

  const handleGoalPress = useCallback((goal: ProcessedGoal) => {
    // No-period (cumulative) goals have no consistency calendar to expand into.
    const goalPeriod = (goal as any).activePeriod || (goal as any).period || 'daily';
    if (goal.isRepeating && goalPeriod !== 'none') {
      setExpandedGoalId((prev) => (prev === goal.id ? null : goal.id));
    }
  }, []);

  // Start a focus session for the goal's tag, pre-filled with the goal's remaining
  // minutes. Reuses the home tab's autostart path (same as the Journal TODO swipe).
  const handleStartSession = useCallback(
    (goal: ProcessedGoal) => {
      const tagId = (goal as any).tagId;
      if (!tagId) return;
      const target = goal._effectiveTarget ?? getGoalCurrentTarget(goal);
      const remaining = Math.round(target - goal.currentProgress);
      // Goal already met (or no target) → fall back to the tag's last-used duration.
      const duration = remaining >= 1 ? remaining : (lastDurationByTagId?.[tagId] ?? 15);
      // navigate() switches to the already-mounted focus tab instantly. push() would
      // add a new stack entry and run a full push transition + re-render of the heavy
      // focus screen, which is the ~1s "lingers on insights" delay before the jump.
      router.navigate({
        pathname: '/(tabs)',
        params: {
          startTagId: tagId,
          startDuration: String(duration),
          autostart: '1',
          ts: String(Date.now()),
        },
      });
    },
    [lastDurationByTagId]
  );

  const handleSwipeOpen = useCallback((ref: any) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDragOriginalIdx(index);
    setDragTargetIdx(index);
    dragOriginalIdxRef.current = index;
    dragTargetIdxRef.current = index;
  }, []);

  const handleDragMove = useCallback(
    (translationY: number) => {
      const origIdx = dragOriginalIdxRef.current;
      const total = processedGoals.length;
      const offset = Math.round(translationY / ROW_HEIGHT);
      const newTarget = Math.max(0, Math.min(total - 1, origIdx + offset));

      if (newTarget !== dragTargetIdxRef.current) {
        dragTargetIdxRef.current = newTarget;
        setDragTargetIdx(newTarget);
      }
    },
    [processedGoals.length]
  );

  const handleDragEnd = useCallback(() => {
    const orig = dragOriginalIdxRef.current;
    const target = dragTargetIdxRef.current;

    if (orig !== target && orig >= 0 && target >= 0 && onReorderGoals) {
      const ids = processedGoals.map((g) => g.id);
      const [moved] = ids.splice(orig, 1);
      ids.splice(target, 0, moved);
      onReorderGoals(ids);
    }

    setIsDragging(false);
    setDragOriginalIdx(-1);
    setDragTargetIdx(-1);
    dragOriginalIdxRef.current = -1;
    dragTargetIdxRef.current = -1;
  }, [processedGoals, onReorderGoals]);

  // Show placeholder when no active goals and no inactive goals
  const hasActiveGoals = goals && goals.length > 0;
  const hasInactiveGoals = inactiveGoals && inactiveGoals.length > 0;

  return (
    <View className="mb-6 px-5">
      {/* CTA when no active goals */}
      {!hasActiveGoals && (
        <GoalCTAHeader introRef={hasInactiveGoals ? undefined : introActivateRef} />
      )}

      {/* Active Goals */}
      {hasActiveGoals && (
        <View className="gap-y-3">
          {processedGoals.map((goal, index) => {
            const goalPeriod = (goal as any).activePeriod || (goal as any).period || 'daily';
            const isExpanded =
              goal.isRepeating && goalPeriod !== 'none' && expandedGoalId === goal.id;
            return (
              <View
                key={goal.id}
                ref={index === 0 ? introGoalRowRef : undefined}
                collapsable={false}>
                {!isExpanded && (
                  <DraggableGoalRow
                    goal={goal}
                    index={index}
                    tags={tags}
                    isDragging={isDragging}
                    dragOriginalIndex={dragOriginalIdx}
                    dragTargetIndex={dragTargetIdx}
                    onPress={() => handleGoalPress(goal)}
                    onEdit={onEditGoal}
                    onDelete={onDeleteGoal}
                    onConclude={onConcludeGoal}
                    onStartSession={handleStartSession}
                    onSwipeOpen={handleSwipeOpen}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                    shouldNudge={shouldNudge}
                    introOpen={index === 0 ? introSwipeOpen : undefined}
                  />
                )}
                {isExpanded && (
                  <GoalConsistencyCalendar
                    goal={goal}
                    sessions={safeSessions}
                    tagMap={tagMap}
                    onCollapse={() => setExpandedGoalId(null)}
                    restDays={restDays}
                    weekStartDay={weekStartDay}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Inactive Goals Section */}
      {hasInactiveGoals && (
        <View className={hasActiveGoals ? 'mt-6' : ''}>
          {/* Divider only distinguishes inactive from active — skip it when there are no active goals */}
          {hasActiveGoals && (
            <View className="mb-3 flex-row items-center">
              <View className="h-px flex-1 bg-light-border dark:bg-dark-border" />
              <Typography variant="body-12" color="secondary" className="mx-3">
                {t('goalProgress.notActivated')}
              </Typography>
              <View className="h-px flex-1 bg-light-border dark:bg-dark-border" />
            </View>
          )}
          <View ref={introActivateRef} collapsable={false} className="gap-y-2">
            {inactiveGoals!.map((goal) => {
              const tag = tags.byId[goal.tagId];
              if (!tag) return null;
              const derivedName = `${tag.icon} ${tag.name}`;
              return (
                <View
                  key={goal.id}
                  className="flex-row items-center rounded-xl border border-light-border bg-light-bg px-4 py-3 dark:border-dark-border dark:bg-dark-bg">
                  <Typography
                    variant="body-14"
                    className="flex-1 text-light-text-primary dark:text-white">
                    {derivedName}
                  </Typography>
                  <Pressable
                    onPress={() => onActivateGoal?.(goal.id)}
                    className="rounded-lg bg-primary px-4 py-2 active:opacity-70">
                    <Typography variant="body-12" color="white">
                      {t('goalProgress.activate')}
                    </Typography>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Example placeholder when no active goals — sits below the unactivated goals */}
      {!hasActiveGoals && <GoalPlaceholderExample introRowRef={introGoalRowRef} />}
    </View>
  );
};

// ---------- Row-Based Goal Item ----------

interface GoalRowItemProps {
  goal: ProcessedGoal;
  tags: { byId: Record<string, any>; allIds: string[] };
}

// Filled progress bar color once a goal is complete — a softer, less-saturated
// sage green (a muted take on the brand `success` green) that reads comfortably
// on the warm cream light-mode bg without the harshness of a vivid green.
const COMPLETED_FILL = '#79B591';

// Urgency colors for the progress bar's hint-line shimmer. The healthy/low
// (on-pace) states use the same brand `success` green as COMPLETED_FILL so the
// animation reads comfortably on the cream light-mode bg; medium/high stay
// strong amber/red to signal falling behind.
const TRACK_COLORS: Record<UrgencyLevel | 'healthy', string> = {
  healthy: COMPLETED_FILL, // brand success green
  low: COMPLETED_FILL, // brand success green
  medium: '#FF9536', // strong amber/orange
  high: '#D9364B', // strong urgent red
};

// Row height for the daily 7-column grid: the 20px cell plus a little breathing
// room. Deliberately not a square (`aspectRatio: 1`), which at 1/7th of the card
// width made rows ~45px tall and left a big empty band under the grid.
const DAY_CELL_ROW_HEIGHT = 32;

// Duolingo-style streak cell: a filled green circle with a white checkmark when
// the period's target was hit; otherwise a circular track with a bottom-up
// partial fill showing how close the period came.
const StreakCell: FC<{ hit: boolean; fillPercent: number; size: number; off?: boolean }> = ({
  hit,
  fillPercent,
  size,
  off,
}) => {
  // Off-marked (paid skip): a solid coral cell with a white dash — same
  // solid-fill treatment as the green hit cell, so it stays obvious on both
  // light and dark backgrounds while reading as "intentionally skipped".
  if (off) {
    return (
      <View
        className="items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: colors.error }}>
        <Ionicons name="remove" size={Math.round(size * 0.62)} color={colors.white} />
      </View>
    );
  }
  if (hit) {
    return (
      <View
        className="items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: COMPLETED_FILL }}>
        <Ionicons name="checkmark-sharp" size={Math.round(size * 0.62)} color={colors.white} />
      </View>
    );
  }
  return (
    <View
      className="overflow-hidden rounded-full bg-light-border dark:bg-dark-border"
      style={{ width: size, height: size }}>
      <View
        className="absolute bottom-0 left-0 right-0 bg-primary"
        style={{ height: `${fillPercent}%` }}
      />
    </View>
  );
};

const GoalRowItem: FC<GoalRowItemProps> = ({ goal, tags }) => {
  const { t } = useTranslation();
  const effectiveTarget = goal._effectiveTarget ?? getGoalCurrentTarget(goal);
  const urgency = useMemo(
    () => calculateUrgency(goal, goal.currentProgress, effectiveTarget),
    [goal, effectiveTarget]
  );

  const formatTime = (minutes: number): string => {
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const goalTagId = (goal as any).tagId;
  const { progressWidth, exceededWidth } = getGoalBarSegments(
    goal.currentProgress,
    effectiveTarget
  );

  const goalPeriod = (goal as any).activePeriod || (goal as any).period || 'daily';
  // No-period (cumulative) goals don't show a period pill.
  const showPeriodBadge = goalPeriod !== 'none';
  const periodLabelMap: Record<string, string> = {
    daily: t('goalProgress.periodDaily'),
    weekly: t('goalProgress.periodWeekly'),
    monthly: t('goalProgress.periodMonthly'),
  };
  const periodLabel = periodLabelMap[goalPeriod] ?? goalPeriod;

  // Goal display name
  const tag = goalTagId ? tags.byId[goalTagId] : null;
  const displayName =
    (goal as any).customName ||
    (tag
      ? t('insights.goalSuffix', { icon: tag.icon, name: tag.name })
      : (goal as any).name || t('goalProgress.goalFallback'));

  // Urgency-driven track color for the unfilled portion of the progress bar
  const isHealthy = !urgency.isBehindPace || urgency.level === 'low';
  const trackColor = isHealthy ? TRACK_COLORS.healthy : TRACK_COLORS[urgency.level];

  // Fruit-store slider theme: its emoji (soccer ball) rides the tip of the
  // progress fill. Bar colors stay as-is — only the tip marker is themed.
  const sliderTheme = useSliderTheme();
  // progressWidth caps at the threshold (84%) once exceeded, so the tip is
  // always progress + overflow, never past 100.
  const ballTipPercent = Math.min(progressWidth + exceededWidth, 100);

  // Shimmer sweep animation — runs once each time the tab is focused
  const isFocused = useIsFocused();
  const shimmerX = useSharedValue(-40);

  useEffect(() => {
    if (isFocused) {
      shimmerX.value = -40;
      shimmerX.value = withTiming(400, { duration: 2000, easing: Easing.inOut(Easing.ease) });
    }
  }, [isFocused]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View className="rounded-xl border border-light-border bg-light-bg px-4 py-3 dark:border-dark-border dark:bg-dark-bg">
      <View className="flex-row items-center">
        {/* Compact progress indicator — checkmark once the target is hit */}
        <View
          className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${
            goal.percentage >= 100 ? '' : 'bg-light-border dark:bg-dark-border'
          }`}
          style={goal.percentage >= 100 ? { backgroundColor: COMPLETED_FILL } : undefined}>
          {goal.percentage >= 100 ? (
            <Ionicons name="checkmark-sharp" size={22} color={colors.white} />
          ) : (
            <Typography
              variant="body-12"
              className="font-poppins-semibold text-light-text-primary dark:text-white">
              {Math.round(goal.percentage)}%
            </Typography>
          )}
        </View>

        {/* Goal info */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Typography
              variant="body-14"
              className="font-poppins-semibold text-light-text-primary dark:text-white">
              {displayName}
            </Typography>
          </View>

          <View className="mt-0.5 flex-row items-center">
            <Typography
              variant="body-12"
              className="font-poppins-medium text-light-text-primary dark:text-white">
              {formatTime(goal.currentProgress)} / {formatTime(effectiveTarget)}
            </Typography>
          </View>
        </View>

        {/* Period Badge — hidden for no-period (cumulative) goals */}
        {showPeriodBadge && (
          <View className="rounded-full bg-primary px-3 py-1">
            <Typography variant="body-12" className="font-poppins-medium text-white">
              {periodLabel}
            </Typography>
          </View>
        )}
      </View>

      {/* Tag Pill — only show if customName is set (to clarify which tag) */}
      {(goal as any).customName && tag && (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          <View
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: tag.color || colors.primary }}>
            <Typography variant="tiny-10" className="mr-1">
              {tag.icon}
            </Typography>
            <Typography variant="tiny-10" className="font-poppins-medium text-white">
              {tag.name}
            </Typography>
          </View>
        </View>
      )}

      {/* Progress bar — wrapper is relative so the themed tip marker can
          overflow the clipped track. The urgency hint line and the ball tip are
          BOTH absolute children here (not later siblings) so the ball, rendered
          last, paints on top of the hint line — otherwise the red/amber line
          overlays the soccer ball as the goal falls behind. */}
      <View className="relative mt-2">
        <View className="relative h-2 overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
          <View
            className={`h-full ${goal.percentage >= 100 ? '' : 'bg-primary'}`}
            style={{
              width: `${progressWidth}%`,
              ...(goal.percentage >= 100 && { backgroundColor: COMPLETED_FILL }),
            }}
          />
          {exceededWidth > 0 && (
            <View
              className="absolute top-0 h-full bg-orange-500"
              style={{
                left: `${GOAL_THRESHOLD_PERCENT}%`,
                width: `${exceededWidth}%`,
              }}
            />
          )}
          <View
            className="absolute bottom-0 top-0 bg-white"
            style={{
              left: `${GOAL_THRESHOLD_PERCENT}%`,
              width: 2,
              opacity: 0.9,
            }}
          />
        </View>

        {/* Urgency hint line — only covers the unfilled portion, with forward
            shimmer. Absolutely positioned over the lower half of the track
            (top: 3 ≈ the old 8px-track + -5 margin) so it can't push layout. */}
        {goal.percentage < 100 && (
          <View
            style={{
              position: 'absolute',
              left: `${progressWidth}%`,
              right: 0,
              top: 3,
              height: 6,
              overflow: 'hidden',
              borderTopRightRadius: 999,
              borderBottomRightRadius: 999,
            }}>
            {/* Static base line */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 2,
                height: 2,
                backgroundColor: trackColor,
                opacity: 0.5,
                borderTopRightRadius: 999,
                borderBottomRightRadius: 999,
              }}
            />
            {/* Sweeping highlight */}
            <Reanimated.View
              style={[
                {
                  position: 'absolute',
                  top: 1,
                  width: 40,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: trackColor,
                  shadowColor: trackColor,
                  shadowOpacity: 1,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 10,
                },
                shimmerStyle,
              ]}
            />
          </View>
        )}

        {/* Soccer-ball tip (fruit-store slider theme) — sits on the end of the fill.
            Rendered LAST so it's the top-most layer of the bar (above the urgency
            hint line). Mirrors the Slider thumb: a fixed-size box (explicit width
            AND height, so neither the parent's remaining space nor the 8px track
            height can squeeze/clip the emoji) centered on the track via 50% +
            half-size offsets, with lineHeight pinned so the glyph isn't clipped. */}
        {sliderTheme && (
          <View
            pointerEvents="none"
            className="absolute items-center justify-center"
            style={{
              left: `${ballTipPercent}%`,
              top: '50%',
              width: 18,
              height: 18,
              marginLeft: -9,
              marginTop: -9,
            }}>
            <Text allowFontScaling={false} style={{ fontSize: 13, lineHeight: 18 }}>
              {sliderTheme.thumbEmoji}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

// ---------- Consistency Calendar ----------

interface GoalConsistencyCalendarProps {
  goal: ProcessedGoal;
  sessions: any[];
  tagMap: Record<string, { id: string; name: string }>;
  onCollapse: () => void;
  restDays: number[];
  weekStartDay: number;
}

const GoalConsistencyCalendar: FC<GoalConsistencyCalendarProps> = ({
  goal,
  sessions,
  tagMap: _tagMap,
  onCollapse,
  restDays,
  weekStartDay,
}) => {
  const { t, i18n } = useTranslation();
  const captureAreaRef = useRef<View>(null);
  const streakCardRef = useRef<View>(null);
  const [showStreakModal, setShowStreakModal] = useState(false);
  const { tags: calendarTags } = useFocus();
  const calendarTag = (goal as any).tagId ? calendarTags.byId[(goal as any).tagId] : null;
  const calendarGoalName =
    (goal as any).customName ||
    (calendarTag
      ? t('insights.goalSuffix', { icon: calendarTag.icon, name: calendarTag.name })
      : (goal as any).name || t('goalProgress.goalFallback'));

  // Shares the glorified streak card (not the raw calendar) — captures the
  // off-screen-styled card view opened in the streak modal.
  const handleShareStreak = async () => {
    try {
      const uri = await captureRef(streakCardRef, { format: 'png', quality: 1 });
      await Share.share(
        Platform.OS === 'ios'
          ? { url: uri }
          : {
              message: t('goalProgress.shareMessage', {
                name:
                  (goal as any).customName ||
                  (goal as any).name ||
                  t('goalProgress.shareGoalFallback'),
              }),
              url: uri,
            }
      );
    } catch (_e) {
      // User cancelled or share failed silently
    }
  };

  const goalPeriod = (goal as any).activePeriod || (goal as any).period || 'daily';
  const periodCounts: Record<string, number> = { daily: 30, weekly: 12, monthly: 12 };
  const count = periodCounts[goalPeriod] || 12;
  const ranges = getHistoricalPeriodRanges(goalPeriod, count, new Date(), weekStartDay);

  // Off-marked slots (paid streak-skips) render distinctly and drop out of the
  // hit/total tally — the streak treats them as if they never existed.
  const offKeys = getGoalOffKeys(
    goal as any,
    goalPeriod === 'monthly' || goalPeriod === 'weekly' ? goalPeriod : 'daily'
  );

  // Compute hit/miss for each range
  const results = ranges.map((range) => {
    // A session counts toward the goal if either its primary OR secondary tag
    // matches — dual-tagged sessions credit both, matching calculateGoalProgress.
    const goalTagId = (goal as any).tagId;
    const relevant = goalTagId
      ? sessions.filter(
          (s) => (s as any).tagId === goalTagId || (s as any).secondaryTagId === goalTagId
        )
      : sessions;

    // Split session time at period boundaries for cross-day sessions
    const totalMinutes = relevant.reduce((sum, s) => {
      return sum + getSessionMinutesInPeriod(s, range.periodStart, range.periodEnd);
    }, 0);
    // Use historical target for this period's date
    const periodTarget = getTargetForDate(goal, range.periodStart, restDays);
    const off = offKeys.has(getPeriodKey(range.periodStart));
    const hit = totalMinutes >= periodTarget;
    const fillPercent = periodTarget > 0 ? Math.min(totalMinutes / periodTarget, 1) * 100 : 0;
    return { ...range, hit, off, totalMinutes, fillPercent };
  });

  // Off slots are excluded from both the numerator and denominator of the ratio.
  const offCount = results.filter((r) => r.off).length;
  const hitCount = results.filter((r) => r.hit && !r.off).length;
  const ratioCount = count - offCount;
  const totalMinutesAll = results.reduce((sum, r) => sum + r.totalMinutes, 0);

  const formatTotalHours = (minutes: number): string => {
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  // Goal header for the screenshot capture
  const goalHeader = (
    <View className="mb-3">
      <Typography
        variant="subtitle-16"
        className="text-light-text-primary dark:text-dark-text-primary">
        {calendarGoalName}
      </Typography>
    </View>
  );

  // Current streak for this goal (off-marked slots already skipped inside).
  // Memoized: the walk is now unbounded, so it scales with streak length rather
  // than a fixed 365-period cap — it must not re-run on unrelated re-renders
  // (this component re-renders on every modal/share toggle).
  const streak = useMemo(
    () => calculateGoalStreak(goal, sessions, restDays, weekStartDay),
    [goal, sessions, restDays, weekStartDay]
  );
  const goalEmoji = '🎯';
  const streakUnit = goalPeriod === 'weekly' ? 'week' : goalPeriod === 'monthly' ? 'month' : 'day';
  const streakLabel = t(`streakShare.label_${streakUnit}`);
  const shareDate = new Date().toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Footer row with total hours + a streak badge (opens the shareable card).
  const footerRow = (
    <View className="mt-3 flex-row items-center justify-between border-t border-light-border pt-3 dark:border-dark-border">
      <View className="flex-1">
        {(goal as any).showTotalHours && (
          <Typography
            variant="body-14"
            className="font-poppins-semibold text-light-text-primary dark:text-dark-text-primary">
            {t('goalProgress.totalTime', { time: formatTotalHours(totalMinutesAll) })}
          </Typography>
        )}
      </View>
      <View className="flex-row items-center">
        <Pressable
          onPress={() => setShowStreakModal(true)}
          className="flex-row items-center rounded-full bg-primary/15 px-3 py-1 active:opacity-70">
          <Text style={{ fontSize: 13 }}>{goalEmoji}</Text>
          <Typography variant="subtitle-14-semibold" color="primary" className="ml-1">
            {streak}
          </Typography>
        </Pressable>
        <Pressable
          onPress={() => setShowStreakModal(true)}
          hitSlop={8}
          className="ml-2 p-1 active:opacity-70">
          <Ionicons name="share-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );

  // Glorified, shareable streak card shown in a modal. The card view itself is
  // captured (react-native-view-shot) for the share sheet.
  const streakModal = (
    <Modal isVisible={showStreakModal} onClose={() => setShowStreakModal(false)}>
      <View className="items-center">
        <View
          ref={streakCardRef}
          collapsable={false}
          className="w-full items-center overflow-hidden rounded-3xl bg-primary p-8"
          style={{ backgroundColor: colors.primary }}>
          {/* Decorative translucent circles for a bit of art */}
          <View
            className="absolute rounded-full bg-white/10"
            style={{ width: 160, height: 160, top: -50, right: -40 }}
          />
          <View
            className="absolute rounded-full bg-white/10"
            style={{ width: 110, height: 110, bottom: -30, left: -30 }}
          />

          {/* Goal emoji beside the number (not stacked on top — that looked like a candle) */}
          <View className="flex-row items-center" style={{ marginBottom: 2 }}>
            <Text style={{ fontSize: 40, marginRight: 10 }}>{goalEmoji}</Text>
            <Text
              className="font-poppins-bold"
              style={{ fontSize: 72, lineHeight: 80, color: colors.white }}>
              {streak}
            </Text>
          </View>
          <Text
            className="font-poppins-semibold"
            style={{
              fontSize: 15,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: colors.white,
              opacity: 0.9,
            }}>
            {streakLabel}
          </Text>

          <View className="my-5 h-px w-16 bg-white/40" />

          <Text
            className="text-center font-poppins-semibold"
            style={{ fontSize: 18, color: colors.white }}>
            {calendarGoalName}
          </Text>
          <Text
            className="mt-1 text-center"
            style={{ fontSize: 12, color: colors.white, opacity: 0.85 }}>
            {t('streakShare.reachedOn', { date: shareDate })}
          </Text>

          <Text
            className="mt-6 font-poppins-semibold"
            style={{ fontSize: 12, letterSpacing: 1, color: colors.white, opacity: 0.8 }}>
            Bittersweet
          </Text>
        </View>

        <View className="mt-6">
          <Button onPress={handleShareStreak} size="medium">
            {t('streakShare.share')}
          </Button>
        </View>
      </View>
    </Modal>
  );

  if (goalPeriod === 'daily') {
    const firstDay = results[0]?.periodStart.getDay() ?? 0;
    const paddedResults = [...Array(firstDay).fill(null), ...results];

    return (
      <>
        <Pressable className="mt-2" onPress={onCollapse}>
          <View
            ref={captureAreaRef}
            collapsable={false}
            className="rounded-xl border border-light-border bg-light-bg p-4 dark:border-dark-border dark:bg-dark-bg">
            {goalHeader}
            <View className="mb-3 flex-row items-center justify-between">
              <Typography variant="body-12" color="secondary">
                {t('goalProgress.last30days')}
              </Typography>
              <Typography variant="body-12" color="primary">
                {t('goalProgress.hitCount', { hit: hitCount, count: ratioCount })}
              </Typography>
            </View>
            {/* Day headers */}
            <View className="mb-1 flex-row">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <View key={i} className="flex-1 items-center">
                  <Typography variant="tiny-10" color="secondary">
                    {d}
                  </Typography>
                </View>
              ))}
            </View>
            {/* Grid — rows are sized to the 20px cell, not to a full square
                (aspectRatio: 1 made each row ~45px tall, so the last, always
                partial row left a large blank band under the grid). */}
            <View className="flex-row flex-wrap">
              {paddedResults.map((r, i) => (
                <View
                  key={i}
                  className="items-center justify-center"
                  style={{ width: '14.28%', height: DAY_CELL_ROW_HEIGHT }}>
                  {r ? (
                    <StreakCell hit={r.hit} off={r.off} fillPercent={r.fillPercent} size={20} />
                  ) : (
                    <View className="h-5 w-5" />
                  )}
                </View>
              ))}
            </View>
            {footerRow}
          </View>
        </Pressable>
        {streakModal}
      </>
    );
  }

  if (goalPeriod === 'monthly') {
    const topRow = results.slice(0, 6);
    const bottomRow = results.slice(6);

    const formatMinutes = (m: number) => {
      const rounded = Math.round(m);
      const h = Math.floor(rounded / 60);
      return h > 0 ? `${h}h` : `${rounded}m`;
    };

    return (
      <>
        <Pressable className="mt-2" onPress={onCollapse}>
          <View
            ref={captureAreaRef}
            collapsable={false}
            className="rounded-xl border border-light-border bg-light-bg p-4 dark:border-dark-border dark:bg-dark-bg">
            {goalHeader}
            <View className="mb-3 flex-row items-center justify-between">
              <Typography variant="body-12" color="secondary">
                {t('goalProgress.last12months')}
              </Typography>
              <Typography variant="body-12" color="primary">
                {t('goalProgress.hitCount', { hit: hitCount, count: ratioCount })}
              </Typography>
            </View>
            {[topRow, bottomRow].map((row, rowIdx) => (
              <View
                key={rowIdx}
                className={`flex-row justify-between ${rowIdx === 0 ? 'mb-2' : ''}`}>
                {row.map((r, i) => (
                  <View key={i} className="items-center" style={{ flex: 1 }}>
                    <View className="mb-1">
                      <StreakCell hit={r.hit} off={r.off} fillPercent={r.fillPercent} size={28} />
                    </View>
                    <Typography variant="tiny-10" color="secondary" className="text-center">
                      {r.label}
                    </Typography>
                    <Typography
                      variant="tiny-10"
                      color={r.hit ? 'primary' : 'secondary'}
                      className="text-center">
                      {formatMinutes(r.totalMinutes)}
                    </Typography>
                  </View>
                ))}
              </View>
            ))}
            {footerRow}
          </View>
        </Pressable>
        {streakModal}
      </>
    );
  }

  // Weekly — horizontal row of blocks
  return (
    <>
      <Pressable className="mt-2" onPress={onCollapse}>
        <View
          ref={captureAreaRef}
          collapsable={false}
          className="rounded-xl border border-light-border bg-light-bg p-4 dark:border-dark-border dark:bg-dark-bg">
          {goalHeader}
          <View className="mb-3 flex-row items-center justify-between">
            <Typography variant="body-12" color="secondary">
              {t('goalProgress.lastWeeks', { count })}
            </Typography>
            <Typography variant="body-12" color="primary">
              {t('goalProgress.hitCount', { hit: hitCount, count: ratioCount })}
            </Typography>
          </View>
          <View className="flex-row justify-between">
            {results.map((r, i) => (
              <View key={i} className="items-center" style={{ flex: 1 }}>
                <View className="mb-1">
                  <StreakCell hit={r.hit} off={r.off} fillPercent={r.fillPercent} size={20} />
                </View>
                <Typography variant="tiny-10" color="secondary" className="text-center">
                  {r.label}
                </Typography>
              </View>
            ))}
          </View>
          {footerRow}
        </View>
      </Pressable>
      {streakModal}
    </>
  );
};

// ---------- Empty State Placeholder ----------

const GoalCTAHeader: FC<{ introRef?: RefObject<View | null> }> = ({ introRef }) => {
  const { t } = useTranslation();
  return (
    <View ref={introRef} collapsable={false} className="mb-4 items-center">
      <Typography
        variant="headline-18"
        className="text-center text-light-text-primary dark:text-white">
        {t('goalProgress.activateGoals')}
      </Typography>
    </View>
  );
};

const GoalPlaceholderExample: FC<{ introRowRef?: RefObject<View | null> }> = ({ introRowRef }) => {
  const { t } = useTranslation();
  const targetHours = 10;
  const placeholderWeeks = [
    { hours: 11, hit: true },
    { hours: 10, hit: true },
    { hours: 8, hit: false },
    { hours: 12, hit: true },
    { hours: 9, hit: false },
    { hours: 10, hit: true },
    { hours: 11, hit: true },
    { hours: 10, hit: true },
    { hours: 7, hit: false },
    { hours: 11, hit: true },
    { hours: 12, hit: true },
    { hours: 5, hit: false },
  ].map((w) => ({ ...w, fillPercent: Math.min(w.hours / targetHours, 1) * 100 }));

  return (
    <View className="mt-6">
      {/* Subtitle introducing the example */}
      <View className="mb-4">
        <Typography variant="body-12" color="secondary">
          {t('goalProgress.whatGoalLooksLike')}
        </Typography>
      </View>

      {/* Placeholder Goal Row */}
      <View
        ref={introRowRef}
        collapsable={false}
        className="mb-3 rounded-xl border border-light-border bg-light-bg px-4 py-3 opacity-60 dark:border-dark-border dark:bg-dark-bg">
        <View className="flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-light-border dark:bg-dark-border">
            <Typography
              variant="body-12"
              className="font-poppins-semibold text-light-text-primary dark:text-white">
              72%
            </Typography>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Typography
                variant="body-14"
                className="font-poppins-semibold text-light-text-primary dark:text-white">
                {t('goalProgress.exampleGoalName')}
              </Typography>
            </View>
            <View className="mt-0.5 flex-row items-center">
              <Typography
                variant="body-12"
                className="font-poppins-medium text-light-text-primary dark:text-white">
                7h 12m / 10h 0m
              </Typography>
            </View>
          </View>
          <View className="rounded-full bg-primary px-3 py-1">
            <Typography variant="body-12" className="font-poppins-medium text-white">
              {t('goalProgress.periodWeekly')}
            </Typography>
          </View>
        </View>

        {/* Tag Pills */}
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          <View
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: colors.primary }}>
            <Typography variant="tiny-10" className="mr-1">
              📚
            </Typography>
            <Typography variant="tiny-10" className="font-poppins-medium text-white">
              {t('goalProgress.exampleTag')}
            </Typography>
          </View>
        </View>

        {/* Progress bar */}
        <View className="relative mt-2 h-2 overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
          <View
            className="h-full bg-primary"
            style={{ width: `${72 * (GOAL_THRESHOLD_PERCENT / 100)}%` }}
          />
          <View
            className="absolute bottom-0 top-0 bg-white"
            style={{
              left: `${GOAL_THRESHOLD_PERCENT}%`,
              width: 2,
              opacity: 0.9,
            }}
          />
        </View>
      </View>

      {/* Placeholder Weekly Calendar */}
      <View className="mb-4 rounded-xl border border-light-border bg-light-bg p-4 opacity-60 dark:border-dark-border dark:bg-dark-bg">
        <View className="mb-3 flex-row items-center justify-between">
          <Typography variant="body-12" color="secondary">
            {t('goalProgress.lastWeeks', { count: 12 })}
          </Typography>
          <Typography variant="body-12" color="primary">
            {t('goalProgress.hitCount', { hit: 8, count: 12 })}
          </Typography>
        </View>
        <View className="flex-row justify-between">
          {placeholderWeeks.map((w, i) => (
            <View key={i} className="items-center" style={{ flex: 1 }}>
              <StreakCell hit={w.hit} fillPercent={w.fillPercent} size={20} />
            </View>
          ))}
        </View>
        <View className="mt-3 items-center border-t border-light-border pt-3 dark:border-dark-border">
          <Typography
            variant="body-14"
            className="font-poppins-semibold text-light-text-primary dark:text-dark-text-primary">
            {t('goalProgress.totalTime', { time: '116h' })}
          </Typography>
        </View>
      </View>
    </View>
  );
};
