import React, { FC, useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Card } from '../../ui/Card';
import { Typography } from '../../ui/Typography';

interface DailyGoalsProgress {
  completed: number;
  total: number;
  percentage: number;
  timeSpent: number; // in minutes
  timeGoal: number; // in minutes
}

interface DailyGoalsProps {
  progress: DailyGoalsProgress;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const DailyGoals: FC<DailyGoalsProps> = ({ progress }) => {
  const animatedProgress = useSharedValue(0);
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withTiming(progress.percentage / 100, {
      duration: 1000,
    });
  }, [progress.percentage]);

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

  return (
    <View className="mx-5 mb-6">
      <View className="bg-primary rounded-2xl p-6 relative overflow-hidden">
        {/* Background Pattern/Gradient Effect */}
        <View className="absolute inset-0 bg-gradient-to-br from-primary to-link opacity-90" />
        
        <View className="relative z-10 flex-row items-center">
          {/* Circular Progress */}
          <View className="relative mr-6">
            <Svg width={size} height={size} className="transform -rotate-90">
              <Defs>
                <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFFFFF" />
                  <Stop offset="100%" stopColor="#FFFFFF" />
                </LinearGradient>
              </Defs>
              
              {/* Background Circle */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              
              {/* Progress Circle */}
              <AnimatedCircle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#FFFFFF"
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
                variant="headline-24" 
                className="text-white font-poppins-semibold"
              >
                {Math.round(progress.percentage)}%
              </Typography>
            </View>
          </View>

          {/* Content */}
          <View className="flex-1">
            <Typography 
              variant="subtitle-16" 
              className="text-white font-poppins-semibold mb-2"
            >
              Your daily goals almost done!
            </Typography>
            <Typography 
              variant="body-14" 
              className="text-white opacity-75"
            >
              {progress.completed} of {progress.total} completed
            </Typography>
          </View>
        </View>
      </View>
    </View>
  );
};