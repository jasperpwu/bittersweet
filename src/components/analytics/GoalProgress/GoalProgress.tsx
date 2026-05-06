import React, { FC, useEffect, useState, useMemo } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Typography } from '../../ui/Typography';
import { FocusGoal } from '../../../store/types';
import { useFocus } from '../../../store';
import { calculateGoalProgress, getHistoricalPeriodRanges } from '../../../utils/goalProgress';

interface GoalProgressProps {
  goals: FocusGoal[];
  currentPeriodProgress: Record<string, number>; // goalId -> minutes completed
}

interface ProcessedGoal extends FocusGoal {
  currentProgress: number;
  percentage: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const GoalProgress: FC<GoalProgressProps> = ({
  goals,
  currentPeriodProgress
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('all');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  // Get tags and sessions from store for real data
  const { tags, sessions } = useFocus();

  // Extract sessions array from normalized state
  const safeSessions = (sessions && sessions.allIds && sessions.byId)
    ? sessions.allIds.map(id => sessions.byId[id]).filter(Boolean)
    : [];

  // Create tag map for name/ID conversion
  const tagMap = useMemo(() =>
    (tags && tags.allNames && tags.byName ? tags.allNames : []).reduce((map, name) => {
      if (tags && tags.byName) {
        const tag = tags.byName[name];
        if (tag) {
          map[name] = { id: name, name: tag.name };
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

  // Early return after all hooks are called
  if (!goals || goals.length === 0) return null;

  // Process goals to calculate progress
  const processedGoals: ProcessedGoal[] = goals.map(goal => {
    // Use freshly calculated progress from actual sessions
    const currentProgress = freshGoalProgress[goal.id] || 0;
    const percentage = Math.min((currentProgress / goal.targetMinutes) * 100, 100);

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

  return (
    <View className="px-5 mb-6">
      {/* Header with Filter */}
      <View className="flex-row items-center justify-between mb-4">
        <Typography variant="subtitle-16" color="white">
          Goals
        </Typography>
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
                <Pressable
                  onPress={() => handleGoalPress(goal)}
                  disabled={!goal.isRepeating}
                >
                  <GoalProgressItem goal={goal} tags={tags} />
                </Pressable>
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

// ---------- Consistency Calendar ----------

interface GoalConsistencyCalendarProps {
  goal: ProcessedGoal;
  sessions: any[];
  tagMap: Record<string, { id: string; name: string }>;
}

const GoalConsistencyCalendar: FC<GoalConsistencyCalendarProps> = ({ goal, sessions, tagMap }) => {
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
    const goalTagNames = (goal as any).tagNames || [];
    const relevant = goalTagNames.length === 0
      ? rangeSessions
      : rangeSessions.filter(s => goalTagNames.includes((s as any).tagName));

    const totalMinutes = relevant.reduce((sum, s) => sum + s.duration, 0);
    const hit = totalMinutes >= goal.targetMinutes;
    return { ...range, hit, totalMinutes };
  });

  const hitCount = results.filter(r => r.hit).length;

  if (goal.period === 'daily') {
    // Month calendar grid — 7 columns (Sun–Sat)
    // Pad the first row so days align to their weekday
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
                <View
                  className={`w-5 h-5 rounded-sm ${r.hit ? 'bg-green-500' : 'bg-dark-border'}`}
                />
              ) : (
                <View className="w-5 h-5" />
              )}
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (goal.period === 'monthly') {
    // Monthly — two rows of 6 blocks, taller with labels
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
                <View
                  className={`rounded-sm mb-1 ${r.hit ? 'bg-green-500' : 'bg-dark-border'}`}
                  style={{ width: 28, height: 28 }}
                />
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
            <View
              className={`w-5 h-5 rounded-sm mb-1 ${r.hit ? 'bg-green-500' : 'bg-dark-border'}`}
            />
            <Typography variant="tiny-10" color="secondary" className="text-center">
              {r.label}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
};

// ---------- Goal Progress Item ----------

interface GoalProgressItemProps {
  goal: ProcessedGoal;
  tags: { byName: Record<string, any>; allNames: string[] };
}

const GoalProgressItem: FC<GoalProgressItemProps> = ({ goal, tags }) => {
  const animatedProgress = useSharedValue(0);
  const size = 60;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withTiming(goal.percentage / 100, {
      duration: 1000,
    });
  }, [goal.percentage]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = interpolate(
      animatedProgress.value,
      [0, 1],
      [circumference, 0]
    );

    return {
      strokeDashoffset,
    };
  });

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTagNames = (tagNames: string[]): string => {
    return tagNames
      .map(name => tags.byName[name]?.name || name)
      .join(', ');
  };

  return (
    <View className="bg-dark-bg border border-dark-border rounded-xl p-4">
      <View className="flex-row items-center">
        {/* Circular Progress */}
        <View className="relative mr-4">
          <Svg width={size} height={size} className="transform -rotate-90">
            <Defs>
              <LinearGradient id={`progressGradient-${goal.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#6592E9" />
                <Stop offset="100%" stopColor="#6592E9" />
              </LinearGradient>
            </Defs>

            {/* Background Circle */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Progress Circle */}
            <AnimatedCircle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#6592E9"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeLinecap="round"
              animatedProps={animatedProps}
            />
          </Svg>

          {/* Center Content */}
          <View className="absolute inset-0 items-center justify-center">
            <Typography
              variant="body-12"
              className="text-white font-poppins-semibold"
            >
              {Math.round(goal.percentage)}%
            </Typography>
          </View>
        </View>

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
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

          <Typography
            variant="body-12"
            className="text-gray-300 mb-1"
          >
            {formatTime(goal.currentProgress)} / {formatTime(goal.targetMinutes)}
          </Typography>

          {((goal as any).tagNames || []).length > 0 && (
            <Typography
              variant="tiny-10"
              className="text-gray-400"
            >
              {getTagNames((goal as any).tagNames || [])}
            </Typography>
          )}
        </View>

        {/* Status */}
        <View className="items-end">
          {goal.percentage >= 100 ? (
            <Typography variant="body-12" className="text-green-400">
              ✓ Complete
            </Typography>
          ) : (
            <Typography variant="body-12" className="text-gray-400">
              {formatTime(goal.targetMinutes - goal.currentProgress)} left
            </Typography>
          )}
        </View>
      </View>
    </View>
  );
};
