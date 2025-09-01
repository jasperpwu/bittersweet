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
import { calculateGoalProgress } from '../../../utils/goalProgress';

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
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'yearly' | 'all'>('all');
  
  // Get tags and sessions from store for real data
  const { tags, sessions } = useFocus();

  if (goals.length === 0) return null;

  // Extract sessions array from normalized state
  const safeSessions = sessions ? sessions.allIds.map(id => sessions.byId[id]).filter(Boolean) : [];

  // Create tag map for name/ID conversion
  const tagMap = useMemo(() => 
    tags.allIds.reduce((map, id) => {
      const tag = tags.byId[id];
      if (tag) {
        map[id] = { id: tag.id, name: tag.name };
      }
      return map;
    }, {} as Record<string, { id: string; name: string }>),
    [tags]
  );

  // Calculate fresh goal progress from current session data
  const freshGoalProgress = useMemo(() => 
    calculateGoalProgress(goals, safeSessions, tagMap), 
    [goals, safeSessions, tagMap]
  );

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

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getPeriodLabel = (period: string): string => {
    return period.charAt(0).toUpperCase() + period.slice(1);
  };

  return (
    <View className="px-5 mb-6">
      {/* Header with Filter */}
      <View className="flex-row items-center justify-between mb-4">
        <Typography variant="subtitle-16" color="white">
          Goals
        </Typography>
        <View className="flex-row space-x-2">
          {(['all', 'daily', 'weekly', 'yearly'] as const).map((period) => (
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
              <GoalProgressItem key={goal.id} goal={goal} tags={tags} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

interface GoalProgressItemProps {
  goal: ProcessedGoal;
  tags: { byId: Record<string, any>; allIds: string[] };
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

  const getTagNames = (tagIds: string[]): string => {
    return tagIds
      .map(id => tags.byId[id]?.name || 'Unknown')
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
          <Typography 
            variant="body-14" 
            className="text-white font-poppins-semibold mb-1"
          >
            {goal.name}
          </Typography>
          
          <Typography 
            variant="body-12" 
            className="text-gray-300 mb-1"
          >
            {formatTime(goal.currentProgress)} / {formatTime(goal.targetMinutes)}
          </Typography>
          
          {goal.tagIds.length > 0 && (
            <Typography 
              variant="tiny-10" 
              className="text-gray-400"
            >
              {getTagNames(goal.tagIds)}
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