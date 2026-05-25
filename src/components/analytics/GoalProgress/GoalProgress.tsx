import React, { FC, useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, Pressable, Share, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import { Typography } from '../../ui/Typography';
import { FocusGoal } from '../../../store/types';
import { useFocus } from '../../../store';
import { useAppSettings } from '../../../store/unified-store';
import { calculateGoalProgress, getHistoricalPeriodRanges, getTargetForDate } from '../../../utils/goalProgress';
import { calculateUrgency, UrgencyLevel } from '../../../utils/goalUrgency';

interface GoalProgressProps {
  goals: FocusGoal[];
  currentPeriodProgress: Record<string, number>;
  onEditGoal?: (goalId: string) => void;
  onDeleteGoal?: (goalId: string) => void;
  onReorderGoals?: (orderedIds: string[]) => void;
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
  const exceededWidth = currentMinutes > targetMinutes
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
  onSwipeOpen?: (ref: any) => void;
  onDragStart: (index: number) => void;
  onDragMove: (translationY: number) => void;
  onDragEnd: () => void;
  shouldNudge: boolean;
};

function DraggableGoalRow({
  goal, index, tags, isDragging, dragOriginalIndex, dragTargetIndex,
  onPress, onEdit, onDelete, onSwipeOpen, onDragStart, onDragMove, onDragEnd,
  shouldNudge,
}: DraggableGoalRowProps) {
  const isBeingDragged = isDragging && dragOriginalIndex === index;
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const displacement = useSharedValue(0);
  const gestureActive = useSharedValue(false);

  const nudgeX = useSharedValue(0);
  const swipeableRef = useRef<any>(null);
  const didSwipe = useRef(false);

  // Swipe hint: nudge left briefly on first-ever mount, staggered per row
  React.useEffect(() => {
    if (!shouldNudge) return;
    const delay = 400 + index * 120;
    nudgeX.value = withDelay(
      delay,
      withSequence(
        withTiming(-30, { duration: 250, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 12, stiffness: 180 }),
      ),
    );
  }, [shouldNudge]);

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

  const renderRightActions = () => (
    <View className="flex-row items-center ml-2">
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onEdit?.(goal.id);
        }}
        className="bg-primary rounded-lg w-16 h-full items-center justify-center mr-2"
      >
        <Typography variant="body-14" color="white">
          Edit
        </Typography>
      </Pressable>
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete?.(goal.id);
        }}
        className="bg-red-500 rounded-lg w-16 h-full items-center justify-center"
      >
        <Typography variant="body-14" color="white">
          Delete
        </Typography>
      </Pressable>
    </View>
  );

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
        ]}
      >
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          overshootRight={false}
          onSwipeableWillOpen={() => {
            didSwipe.current = true;
            onSwipeOpen?.(swipeableRef.current);
          }}
          onSwipeableClose={() => {
            setTimeout(() => { didSwipe.current = false; }, 100);
          }}
        >
          <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={!goal.isRepeating}
          >
            <Reanimated.View style={pressAnimatedStyle}>
              <GoalRowItem goal={goal} tags={tags} />
            </Reanimated.View>
          </Pressable>
        </Swipeable>
      </Reanimated.View>
    </GestureDetector>
  );
}

// ---------- GoalProgress ----------

export const GoalProgress: FC<GoalProgressProps> = ({
  goals,
  currentPeriodProgress: _currentPeriodProgress,
  onEditGoal,
  onDeleteGoal,
  onReorderGoals,
}) => {
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [shouldNudge, setShouldNudge] = useState(false);

  // Check if swipe nudge hint has been shown before
  const NUDGE_STORAGE_KEY = 'goal-swipe-nudge-shown';
  useEffect(() => {
    AsyncStorage.getItem(NUDGE_STORAGE_KEY).then(value => {
      if (!value) {
        setShouldNudge(true);
        AsyncStorage.setItem(NUDGE_STORAGE_KEY, 'true');
      }
    });
  }, []);

  // Drag-to-reorder state — mirrors index.tsx tag drag pattern exactly
  const [isDragging, setIsDragging] = useState(false);
  const [dragOriginalIdx, setDragOriginalIdx] = useState(-1);
  const [dragTargetIdx, setDragTargetIdx] = useState(-1);
  const dragOriginalIdxRef = useRef(-1);
  const dragTargetIdxRef = useRef(-1);

  // Track open swipeable refs to close others
  const openSwipeableRef = useRef<any>(null);

  // Get tags and sessions from store for real data
  const { tags, sessions } = useFocus();
  const { preferences } = useAppSettings();
  const restDays = preferences.restDays ?? [0, 6];
  const weekStartDay = preferences.weekStartDay ?? 0;

  // Extract sessions array from normalized state
  const safeSessions = (sessions && sessions.allIds && sessions.byId)
    ? sessions.allIds.map(id => sessions.byId[id]).filter(Boolean)
    : [];

  // Create tag map for name/ID conversion
  const tagMap = useMemo(() =>
    (tags && tags.allIds && tags.byId ? tags.allIds : []).reduce((map, id) => {
      if (tags && tags.byId) {
        const tag = tags.byId[id];
        if (tag) {
          map[id] = { id: tag.id, name: tag.name };
        }
      }
      return map;
    }, {} as Record<string, { id: string; name: string }>),
    [tags]
  );

  // Calculate fresh goal progress from current session data
  const freshGoalProgress = useMemo(() =>
    calculateGoalProgress(goals || [], safeSessions, tagMap, weekStartDay),
    [goals, safeSessions, tagMap, weekStartDay]
  );

  // Process goals to calculate progress (flat list, preserving allIds order)
  const processedGoals: ProcessedGoal[] = useMemo(() => (goals || []).map(goal => {
    const currentProgress = freshGoalProgress[goal.id] || 0;
    const effectiveTarget = getTargetForDate(goal, new Date(), restDays);
    const percentage = effectiveTarget > 0
      ? (currentProgress / effectiveTarget) * 100
      : 0;
    return { ...goal, currentProgress, percentage, _effectiveTarget: effectiveTarget };
  }), [goals, freshGoalProgress, restDays]);

  const handleGoalPress = useCallback((goal: ProcessedGoal) => {
    if (goal.isRepeating) {
      setExpandedGoalId(prev => prev === goal.id ? null : goal.id);
    }
  }, []);

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

  const handleDragMove = useCallback((translationY: number) => {
    const origIdx = dragOriginalIdxRef.current;
    const total = processedGoals.length;
    const offset = Math.round(translationY / ROW_HEIGHT);
    const newTarget = Math.max(0, Math.min(total - 1, origIdx + offset));

    if (newTarget !== dragTargetIdxRef.current) {
      dragTargetIdxRef.current = newTarget;
      setDragTargetIdx(newTarget);
    }
  }, [processedGoals.length]);

  const handleDragEnd = useCallback(() => {
    const orig = dragOriginalIdxRef.current;
    const target = dragTargetIdxRef.current;

    if (orig !== target && orig >= 0 && target >= 0 && onReorderGoals) {
      const ids = processedGoals.map(g => g.id);
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

  // Show placeholder when no goals exist (after all hooks)
  if (!goals || goals.length === 0) {
    return <GoalEmptyPlaceholder />;
  }

  return (
    <View className="px-5 mb-6">
      <View className="gap-y-3">
        {processedGoals.map((goal, index) => {
          const isExpanded = goal.isRepeating && expandedGoalId === goal.id;
          return (
            <View key={goal.id}>
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
                  onSwipeOpen={handleSwipeOpen}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  shouldNudge={shouldNudge}
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
    </View>
  );
};

// ---------- Row-Based Goal Item ----------

interface GoalRowItemProps {
  goal: ProcessedGoal;
  tags: { byId: Record<string, any>; allIds: string[] };
}

// Excel-style lightest conditional formatting colors for the progress bar track
const TRACK_COLORS: Record<UrgencyLevel | 'healthy', string> = {
  healthy: '#C6EFCE', // Excel lightest green
  low: '#C6EFCE',     // Excel lightest green
  medium: '#FF9536',  // strong amber/orange
  high: '#D9364B',    // strong urgent red
};

const GoalRowItem: FC<GoalRowItemProps> = ({ goal, tags }) => {
  const effectiveTarget = goal._effectiveTarget ?? goal.targetMinutes;
  const urgency = useMemo(
    () => calculateUrgency(goal, goal.currentProgress, effectiveTarget),
    [goal, effectiveTarget],
  );

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const tagIds = (goal as any).tagIds || [];
  const { progressWidth, exceededWidth } = getGoalBarSegments(goal.currentProgress, effectiveTarget);

  const periodLabel = goal.period.charAt(0).toUpperCase() + goal.period.slice(1);

  // Urgency-driven track color for the unfilled portion of the progress bar
  const isHealthy = !urgency.isBehindPace || urgency.level === 'low';
  const trackColor = isHealthy ? TRACK_COLORS.healthy : TRACK_COLORS[urgency.level];

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
    <View className="bg-dark-bg border border-dark-border rounded-xl px-4 py-3">
      <View className="flex-row items-center">
        {/* Compact progress indicator */}
        <View className="mr-3 items-center justify-center w-10 h-10 rounded-full bg-dark-border">
          <Typography
            variant="body-12"
            className="text-white font-poppins-semibold"
          >
            {Math.round(goal.percentage)}%
          </Typography>
        </View>

        {/* Goal info */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Typography
              variant="body-14"
              className="text-white font-poppins-semibold"
            >
              {goal.name}
            </Typography>
            {goal.isRepeating && (
              <Typography variant="tiny-10" className="text-primary ml-2">
                🔁
              </Typography>
            )}
          </View>

          <View className="flex-row items-center mt-0.5">
            <Typography variant="body-12" className="text-white font-poppins-medium">
              {formatTime(goal.currentProgress)} / {formatTime(effectiveTarget)}
            </Typography>
          </View>
        </View>

        {/* Period Badge */}
        <View className="rounded-full px-3 py-1" style={{ backgroundColor: '#3B82F6' }}>
          <Typography variant="body-12" className="text-white font-poppins-medium">
            {periodLabel}
          </Typography>
        </View>
      </View>

      {/* Tag Pills */}
      {tagIds.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-2">
          {tagIds.map((tagId: string) => {
            const tag = tags.byId[tagId];
            if (!tag) return null;
            return (
              <View
                key={tagId}
                className="flex-row items-center rounded-full px-2.5 py-1"
                style={{ backgroundColor: tag.color || '#6592E9' }}
              >
                <Typography variant="tiny-10" className="mr-1">
                  {tag.icon}
                </Typography>
                <Typography variant="tiny-10" className="text-white font-poppins-medium">
                  {tag.name}
                </Typography>
              </View>
            );
          })}
        </View>
      )}

      {/* Progress bar */}
      <View className="mt-2 h-2 rounded-full bg-dark-border overflow-hidden relative">
        <View
          className={`h-full ${goal.percentage >= 100 ? '' : 'bg-primary'}`}
          style={{ width: `${progressWidth}%`, ...(goal.percentage >= 100 && { backgroundColor: TRACK_COLORS.healthy }) }}
        />
        {exceededWidth > 0 && (
          <View
            className="h-full bg-orange-500 absolute top-0"
            style={{
              left: `${GOAL_THRESHOLD_PERCENT}%`,
              width: `${exceededWidth}%`,
            }}
          />
        )}
        <View
          className="absolute top-0 bottom-0 bg-white"
          style={{
            left: `${GOAL_THRESHOLD_PERCENT}%`,
            width: 2,
            opacity: 0.9,
          }}
        />
      </View>

      {/* Urgency hint line — only covers the unfilled portion, with forward shimmer */}
      {goal.percentage < 100 && (
        <View
          style={{
            marginLeft: `${progressWidth}%`,
            marginTop: -5,
            height: 6,
            overflow: 'hidden',
            borderTopRightRadius: 999,
            borderBottomRightRadius: 999,
          }}
        >
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

const GoalConsistencyCalendar: FC<GoalConsistencyCalendarProps> = ({ goal, sessions, tagMap: _tagMap, onCollapse, restDays, weekStartDay }) => {
  const captureAreaRef = useRef<View>(null);

  const handleShare = async () => {
    try {
      const uri = await captureRef(captureAreaRef, {
        format: 'png',
        quality: 1,
      });

      await Share.share(
        Platform.OS === 'ios'
          ? { url: uri }
          : { message: `Check out my focus streak for "${goal.name}"!`, url: uri }
      );
    } catch (_e) {
      // User cancelled or share failed silently
    }
  };

  const periodCounts: Record<string, number> = { daily: 30, weekly: 12, monthly: 12 };
  const count = periodCounts[goal.period] || 12;
  const ranges = getHistoricalPeriodRanges(goal.period, count, new Date(), weekStartDay);

  // Compute hit/miss for each range
  const results = ranges.map(range => {
    const rangeSessions = sessions.filter(s => {
      const d = new Date(s.startTime);
      return d >= range.periodStart && d <= range.periodEnd;
    });

    // Filter by goal's tags
    const goalTagIds = (goal as any).tagIds || [];
    const relevant = goalTagIds.length === 0
      ? rangeSessions
      : rangeSessions.filter(s => goalTagIds.includes((s as any).tagId));

    const totalMinutes = relevant.reduce((sum, s) => sum + s.duration, 0);
    // Use historical target for this period's date
    const periodTarget = getTargetForDate(goal, range.periodStart, restDays);
    const hit = totalMinutes >= periodTarget;
    const fillPercent = periodTarget > 0
      ? Math.min(totalMinutes / periodTarget, 1) * 100
      : 0;
    return { ...range, hit, totalMinutes, fillPercent };
  });

  const hitCount = results.filter(r => r.hit).length;
  const totalMinutesAll = results.reduce((sum, r) => sum + r.totalMinutes, 0);

  const formatTotalHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  // Goal header for the screenshot capture
  const goalHeader = (
    <View className="mb-3">
      <Typography variant="subtitle-16" className="text-white">
        {goal.name}
      </Typography>
    </View>
  );

  // Footer row with total hours + share button
  const footerRow = (
    <View className="mt-3 pt-3 border-t border-dark-border flex-row items-center justify-between">
      <View className="flex-1">
        {(goal as any).showTotalHours && (
          <Typography variant="body-14" className="text-white font-poppins-semibold">
            ⏱️ {formatTotalHours(totalMinutesAll)} total
          </Typography>
        )}
      </View>
      <Pressable onPress={handleShare} className="active:opacity-70 p-1">
        <Ionicons name="share-outline" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  if (goal.period === 'daily') {
    const firstDay = results[0]?.periodStart.getDay() ?? 0;
    const paddedResults = [...Array(firstDay).fill(null), ...results];

    return (
      <Pressable className="mt-2" onPress={onCollapse}>
        <View ref={captureAreaRef} collapsable={false} className="bg-dark-bg border border-dark-border rounded-xl p-4">
          {goalHeader}
          <View className="flex-row items-center justify-between mb-3">
            <Typography variant="body-12" color="secondary">
              Last 30 days
            </Typography>
            <Typography variant="body-12" color="primary">
              {hitCount}/{count} hit
            </Typography>
          </View>
          {/* Day headers */}
          <View className="flex-row mb-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <View key={i} className="flex-1 items-center">
                <Typography variant="tiny-10" color="secondary">{d}</Typography>
              </View>
            ))}
          </View>
          {/* Grid */}
          <View className="flex-row flex-wrap">
            {paddedResults.map((r, i) => (
              <View key={i} className="items-center justify-center" style={{ width: '14.28%', aspectRatio: 1 }}>
                {r ? (
                  r.hit ? (
                    <View className="w-5 h-5 rounded-sm" style={{ backgroundColor: TRACK_COLORS.healthy }} />
                  ) : (
                    <View className="w-5 h-5 rounded-sm bg-dark-border overflow-hidden">
                      <View
                        className="absolute bottom-0 left-0 right-0 bg-primary"
                        style={{ height: `${r.fillPercent}%` }}
                      />
                    </View>
                  )
                ) : (
                  <View className="w-5 h-5" />
                )}
              </View>
            ))}
          </View>
          {footerRow}
        </View>
      </Pressable>
    );
  }

  if (goal.period === 'monthly') {
    const topRow = results.slice(0, 6);
    const bottomRow = results.slice(6);

    const formatMinutes = (m: number) => {
      const h = Math.floor(m / 60);
      return h > 0 ? `${h}h` : `${m}m`;
    };

    return (
      <Pressable className="mt-2" onPress={onCollapse}>
        <View ref={captureAreaRef} collapsable={false} className="bg-dark-bg border border-dark-border rounded-xl p-4">
          {goalHeader}
          <View className="flex-row items-center justify-between mb-3">
            <Typography variant="body-12" color="secondary">
              Last 12 months
            </Typography>
            <Typography variant="body-12" color="primary">
              {hitCount}/{count} hit
            </Typography>
          </View>
          {[topRow, bottomRow].map((row, rowIdx) => (
            <View key={rowIdx} className={`flex-row justify-between ${rowIdx === 0 ? 'mb-2' : ''}`}>
              {row.map((r, i) => (
                <View key={i} className="items-center" style={{ flex: 1 }}>
                  {r.hit ? (
                    <View
                      className="rounded-sm mb-1"
                      style={{ width: 28, height: 28, backgroundColor: TRACK_COLORS.healthy }}
                    />
                  ) : (
                    <View
                      className="rounded-sm mb-1 bg-dark-border overflow-hidden"
                      style={{ width: 28, height: 28 }}
                    >
                      <View
                        className="absolute bottom-0 left-0 right-0 bg-primary"
                        style={{ height: `${r.fillPercent}%` }}
                      />
                    </View>
                  )}
                  <Typography variant="tiny-10" color="secondary" className="text-center">
                    {r.label}
                  </Typography>
                  <Typography variant="tiny-10" color={r.hit ? 'primary' : 'secondary'} className="text-center">
                    {formatMinutes(r.totalMinutes)}
                  </Typography>
                </View>
              ))}
            </View>
          ))}
          {footerRow}
        </View>
      </Pressable>
    );
  }

  // Weekly — horizontal row of blocks
  return (
    <Pressable className="mt-2" onPress={onCollapse}>
      <View ref={captureAreaRef} collapsable={false} className="bg-dark-bg border border-dark-border rounded-xl p-4">
        {goalHeader}
        <View className="flex-row items-center justify-between mb-3">
          <Typography variant="body-12" color="secondary">
            Last {count} weeks
          </Typography>
          <Typography variant="body-12" color="primary">
            {hitCount}/{count} hit
          </Typography>
        </View>
        <View className="flex-row justify-between">
          {results.map((r, i) => (
            <View key={i} className="items-center" style={{ flex: 1 }}>
              {r.hit ? (
                <View className="w-5 h-5 rounded-sm mb-1" style={{ backgroundColor: TRACK_COLORS.healthy }} />
              ) : (
                <View className="w-5 h-5 rounded-sm mb-1 bg-dark-border overflow-hidden">
                  <View
                    className="absolute bottom-0 left-0 right-0 bg-primary"
                    style={{ height: `${r.fillPercent}%` }}
                  />
                </View>
              )}
              <Typography variant="tiny-10" color="secondary" className="text-center">
                {r.label}
              </Typography>
            </View>
          ))}
        </View>
        {footerRow}
      </View>
    </Pressable>
  );
};

// ---------- Empty State Placeholder ----------

const GoalEmptyPlaceholder: FC = () => {
  const targetHours = 40;
  const placeholderMonths = [
    { label: 'Jun', hours: 42, hit: true },
    { label: 'Jul', hours: 38, hit: true },
    { label: 'Aug', hours: 15, hit: false },
    { label: 'Sep', hours: 46, hit: true },
    { label: 'Oct', hours: 30, hit: true },
    { label: 'Nov', hours: 12, hit: false },
    { label: 'Dec', hours: 35, hit: true },
    { label: 'Jan', hours: 40, hit: true },
    { label: 'Feb', hours: 28, hit: false },
    { label: 'Mar', hours: 44, hit: true },
    { label: 'Apr', hours: 50, hit: true },
    { label: 'May', hours: 22, hit: false },
  ].map(m => ({ ...m, fillPercent: Math.min(m.hours / targetHours, 1) * 100 }));

  const topRow = placeholderMonths.slice(0, 6);
  const bottomRow = placeholderMonths.slice(6);

  return (
    <View className="px-5 mb-6">
      {/* Call to action */}
      <View className="items-center mb-4">
        <Typography variant="body-14" className="text-white text-center">
          Tap the top right 🎯 to create new goals
        </Typography>
        <Typography variant="body-12" className="text-gray-200 text-center mt-1">
          Here&apos;s what a goal looks like
        </Typography>
      </View>

      {/* Placeholder Goal Row */}
      <View className="bg-dark-bg border border-dark-border rounded-xl px-4 py-3 mb-3 opacity-60">
        <View className="flex-row items-center">
          <View className="mr-3 items-center justify-center w-10 h-10 rounded-full bg-dark-border">
            <Typography variant="body-12" className="text-white font-poppins-semibold">
              72%
            </Typography>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center">
              <Typography variant="body-14" className="text-white font-poppins-semibold">
                Study Goal
              </Typography>
              <Typography variant="tiny-10" className="text-primary ml-2">
                🔁
              </Typography>
            </View>
            <View className="flex-row items-center mt-0.5">
              <Typography variant="body-12" className="text-white font-poppins-medium">
                28h 48m / 40h 0m
              </Typography>
            </View>
          </View>
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: '#3B82F6' }}>
            <Typography variant="body-12" className="text-white font-poppins-medium">
              Monthly
            </Typography>
          </View>
        </View>

        {/* Tag Pills */}
        <View className="flex-row flex-wrap gap-1.5 mt-2">
          <View
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: '#6592E9' }}
          >
            <Typography variant="tiny-10" className="mr-1">
              📚
            </Typography>
            <Typography variant="tiny-10" className="text-white font-poppins-medium">
              Study
            </Typography>
          </View>
        </View>

        {/* Progress bar */}
        <View className="mt-2 h-2 rounded-full bg-dark-border overflow-hidden relative">
          <View
            className="h-full bg-primary"
            style={{ width: `${72 * (GOAL_THRESHOLD_PERCENT / 100)}%` }}
          />
          <View
            className="absolute top-0 bottom-0 bg-white"
            style={{
              left: `${GOAL_THRESHOLD_PERCENT}%`,
              width: 2,
              opacity: 0.9,
            }}
          />
        </View>
      </View>

      {/* Placeholder Monthly Calendar */}
      <View className="bg-dark-bg border border-dark-border rounded-xl p-4 mb-4 opacity-60">
        <View className="flex-row items-center justify-between mb-3">
          <Typography variant="body-12" className="text-gray-200">
            Last 12 months
          </Typography>
          <Typography variant="body-12" className="text-[#6592E9]">
            8/12 hit
          </Typography>
        </View>
        {[topRow, bottomRow].map((row, rowIdx) => (
          <View key={rowIdx} className={`flex-row justify-between ${rowIdx === 0 ? 'mb-2' : ''}`}>
            {row.map((m, i) => (
              <View key={i} className="items-center" style={{ flex: 1 }}>
                {m.hit ? (
                  <View
                    className="rounded-sm mb-1"
                    style={{ width: 28, height: 28, backgroundColor: TRACK_COLORS.healthy }}
                  />
                ) : (
                  <View
                    className="rounded-sm mb-1 bg-dark-border overflow-hidden"
                    style={{ width: 28, height: 28 }}
                  >
                    <View
                      className="absolute bottom-0 left-0 right-0 bg-primary"
                      style={{ height: `${m.fillPercent}%` }}
                    />
                  </View>
                )}
                <Typography variant="tiny-10" className="text-gray-300 text-center">
                  {m.label}
                </Typography>
                <Typography variant="tiny-10" className={`text-center ${m.hit ? 'text-[#6592E9]' : 'text-gray-400'}`}>
                  {m.hours}h
                </Typography>
              </View>
            ))}
          </View>
        ))}
        <View className="mt-3 pt-3 border-t border-dark-border items-center">
          <Typography variant="body-14" className="text-white font-poppins-semibold">
            ⏱️ 402h total
          </Typography>
        </View>
      </View>

    </View>
  );
};
