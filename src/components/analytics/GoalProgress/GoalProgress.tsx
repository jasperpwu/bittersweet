import { FC, useRef, useState, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Typography } from '../../ui/Typography';
import { FocusGoal } from '../../../store/types';
import { useFocus } from '../../../store';
import { calculateGoalProgress, getHistoricalPeriodRanges } from '../../../utils/goalProgress';

interface GoalProgressProps {
  goals: FocusGoal[];
  currentPeriodProgress: Record<string, number>;
  onEditGoal?: (goalId: string) => void;
  onDeleteGoal?: (goalId: string) => void;
}

interface ProcessedGoal extends FocusGoal {
  currentProgress: number;
  percentage: number;
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

export const GoalProgress: FC<GoalProgressProps> = ({
  goals,
  currentPeriodProgress: _currentPeriodProgress,
  onEditGoal,
  onDeleteGoal,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // Track open swipeable refs to close others
  const openSwipeableRef = useRef<any>(null);

  // Get tags and sessions from store for real data
  const { tags, sessions } = useFocus();

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
    calculateGoalProgress(goals || [], safeSessions, tagMap),
    [goals, safeSessions, tagMap]
  );

  // Show placeholder when no goals exist
  if (!goals || goals.length === 0) {
    return <GoalEmptyPlaceholder />;
  }

  // Process goals to calculate progress
  const processedGoals: ProcessedGoal[] = goals.map(goal => {
    const currentProgress = freshGoalProgress[goal.id] || 0;
    const percentage = goal.targetMinutes > 0
      ? (currentProgress / goal.targetMinutes) * 100
      : 0;

    return {
      ...goal,
      currentProgress,
      percentage,
    };
  });

  // Filter goals by selected period
  const filteredGoals = selectedPeriod === 'all'
    ? processedGoals
    : processedGoals.filter(goal => goal.period === selectedPeriod);

  // Group goals by period for display
  const goalsByPeriod = filteredGoals.reduce((acc, goal) => {
    if (!acc[goal.period]) acc[goal.period] = [];
    acc[goal.period].push(goal);
    return acc;
  }, {} as Record<string, ProcessedGoal[]>);

  const handleGoalPress = (goal: ProcessedGoal) => {
    if (goal.isRepeating) {
      setExpandedGoalId(prev => prev === goal.id ? null : goal.id);
    }
  };

  const handleSwipeOpen = (ref: any) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  };

  return (
    <View className="px-5 mb-6">
      {/* Period Filter */}
      <View className="flex-row items-center justify-end mb-4">
        <View className="flex-row space-x-2">
          {(['all', 'daily', 'weekly', 'monthly'] as const).map((period) => (
            <Pressable
              key={period}
              onPress={() => setSelectedPeriod(period)}
              className={`px-3 py-2 rounded-lg ${
                selectedPeriod === period ? 'bg-primary' : 'bg-dark-border'
              }`}
            >
              <Typography
                variant="body-12"
                color="white"
                className="text-white"
              >
                {period === 'all' ? 'All' : period.charAt(0).toUpperCase() + period.slice(1)}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Goals Display */}
      {Object.entries(goalsByPeriod).map(([period, periodGoals]) => (
        <View key={period} className="mb-4">
          <View className="space-y-3">
            {periodGoals.map((goal) => (
              <View key={goal.id}>
                <GoalRowSwipeable
                  goal={goal}
                  tags={tags}
                  onPress={() => handleGoalPress(goal)}
                  onEdit={onEditGoal}
                  onDelete={onDeleteGoal}
                  onSwipeOpen={handleSwipeOpen}
                />
                {goal.isRepeating && expandedGoalId === goal.id && (
                  <GoalConsistencyCalendar
                    goal={goal}
                    sessions={safeSessions}
                    tagMap={tagMap}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

// ---------- Swipeable Row ----------

interface GoalRowSwipeableProps {
  goal: ProcessedGoal;
  tags: { byId: Record<string, any>; allIds: string[] };
  onPress: () => void;
  onEdit?: (goalId: string) => void;
  onDelete?: (goalId: string) => void;
  onSwipeOpen?: (ref: any) => void;
}

const GoalRowSwipeable: FC<GoalRowSwipeableProps> = ({
  goal,
  tags,
  onPress,
  onEdit,
  onDelete,
  onSwipeOpen,
}) => {
  const swipeableRef = useRef<any>(null);
  const didSwipe = useRef(false);

  const renderRightActions = () => (
    <View className="flex-row items-center ml-2">
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onEdit?.(goal.id);
        }}
        className="bg-primary rounded-lg px-4 h-full justify-center mr-2"
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
        className="bg-red-500 rounded-lg px-4 h-full justify-center"
      >
        <Typography variant="body-14" color="white">
          Delete
        </Typography>
      </Pressable>
    </View>
  );

  const handlePress = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onPress();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      onSwipeableWillOpen={() => {
        didSwipe.current = true;
        onSwipeOpen?.(swipeableRef.current);
      }}
      onSwipeableClose={() => {
        // Reset after close animation completes
        setTimeout(() => { didSwipe.current = false; }, 100);
      }}
    >
      <Pressable onPress={handlePress} disabled={!goal.isRepeating}>
        <GoalRowItem goal={goal} tags={tags} />
      </Pressable>
    </Swipeable>
  );
};

// ---------- Row-Based Goal Item ----------

interface GoalRowItemProps {
  goal: ProcessedGoal;
  tags: { byId: Record<string, any>; allIds: string[] };
}

const GoalRowItem: FC<GoalRowItemProps> = ({ goal, tags }) => {
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTagNames = (tagIds: string[]): string => {
    return tagIds
      .map(id => tags.byId[id]?.name || id)
      .join(', ');
  };

  const tagIds = (goal as any).tagIds || [];
  const hasExceededGoal = goal.currentProgress > goal.targetMinutes;
  const exceededMinutes = Math.max(goal.currentProgress - goal.targetMinutes, 0);
  const { progressWidth, exceededWidth } = getGoalBarSegments(goal.currentProgress, goal.targetMinutes);

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
              {formatTime(goal.currentProgress)} / {formatTime(goal.targetMinutes)}
            </Typography>
            {tagIds.length > 0 && (
              <Typography variant="tiny-10" className="text-gray-400 ml-2">
                {getTagNames(tagIds)}
              </Typography>
            )}
          </View>
        </View>

        {/* Status */}
        <View className="items-end">
          {goal.percentage >= 100 ? (
            <Typography
              variant="body-12"
              className={hasExceededGoal ? 'text-orange-400' : 'text-green-400'}
            >
              {hasExceededGoal ? `+${formatTime(exceededMinutes)}` : '✓'}
            </Typography>
          ) : (
            <Typography variant="body-12" className="text-gray-400">
              {formatTime(goal.targetMinutes - goal.currentProgress)} left
            </Typography>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View className="mt-2 h-2 rounded-full bg-dark-border overflow-hidden relative">
        <View
          className="h-full bg-primary"
          style={{ width: `${progressWidth}%` }}
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
    </View>
  );
};

// ---------- Consistency Calendar ----------

interface GoalConsistencyCalendarProps {
  goal: ProcessedGoal;
  sessions: any[];
  tagMap: Record<string, { id: string; name: string }>;
}

const GoalConsistencyCalendar: FC<GoalConsistencyCalendarProps> = ({ goal, sessions, tagMap: _tagMap }) => {
  const periodCounts: Record<string, number> = { daily: 30, weekly: 12, monthly: 12 };
  const count = periodCounts[goal.period] || 12;
  const ranges = getHistoricalPeriodRanges(goal.period, count);

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
    const hit = totalMinutes >= goal.targetMinutes;
    const fillPercent = goal.targetMinutes > 0
      ? Math.min(totalMinutes / goal.targetMinutes, 1) * 100
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

  if (goal.period === 'daily') {
    const firstDay = results[0]?.periodStart.getDay() ?? 0;
    const paddedResults = [...Array(firstDay).fill(null), ...results];

    return (
      <View className="bg-dark-bg border border-dark-border rounded-xl p-4 mt-2">
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
                  <View className="w-5 h-5 rounded-sm bg-green-500" />
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
        {(goal as any).showTotalHours && (
          <View className="mt-3 pt-3 border-t border-dark-border items-center">
            <Typography variant="body-14" className="text-white font-poppins-semibold">
              ⏱️ {formatTotalHours(totalMinutesAll)} total
            </Typography>
          </View>
        )}
      </View>
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
      <View className="bg-dark-bg border border-dark-border rounded-xl p-4 mt-2">
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
                    className="rounded-sm mb-1 bg-green-500"
                    style={{ width: 28, height: 28 }}
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
        {(goal as any).showTotalHours && (
          <View className="mt-3 pt-3 border-t border-dark-border items-center">
            <Typography variant="body-14" className="text-white font-poppins-semibold">
              ⏱️ {formatTotalHours(totalMinutesAll)} total
            </Typography>
          </View>
        )}
      </View>
    );
  }

  // Weekly — horizontal row of blocks
  return (
    <View className="bg-dark-bg border border-dark-border rounded-xl p-4 mt-2">
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
              <View className="w-5 h-5 rounded-sm mb-1 bg-green-500" />
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
      {(goal as any).showTotalHours && (
        <View className="mt-3 pt-3 border-t border-dark-border items-center">
          <Typography variant="body-14" className="text-white font-poppins-semibold">
            ⏱️ {formatTotalHours(totalMinutesAll)} total
          </Typography>
        </View>
      )}
    </View>
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
            <Typography variant="body-14" className="text-white font-poppins-semibold mb-0.5">
              Monthly Study Goal
            </Typography>
            <Typography variant="body-12" className="text-white font-poppins-medium">
              28h 48m / 40h 0m
            </Typography>
          </View>
          <Typography variant="body-12" className="text-gray-300">
            11h 12m left
          </Typography>
        </View>
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
                    className="rounded-sm mb-1 bg-green-500"
                    style={{ width: 28, height: 28 }}
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
