import React, { FC } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface Trend {
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
  period: string;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: Trend;
  color?: 'primary' | 'success' | 'error';
  size?: 'small' | 'medium' | 'large';
}

export const StatCard: FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  color = 'primary',
  size = 'medium',
}) => {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success',
    error: 'text-error',
  };

  const trendColor = trend?.direction === 'up' ? '#51BC6F' : 
                   trend?.direction === 'down' ? '#EF786C' : '#8A8A8A';

  const trendIcon = trend?.direction === 'up' ? 'trending-up' : 
                   trend?.direction === 'down' ? 'trending-down' : 'remove';

  return (
    <View className="bg-white dark:bg-gray-800 rounded-2xl p-4">
      <Typography variant="body-12" color="secondary" className="mb-2">
        {title}
      </Typography>
      
      <Typography 
        variant={size === 'large' ? 'headline-24' : 'headline-20'} 
        color="primary" 
        className="mb-1"
      >
        {value}
      </Typography>
      
      {subtitle && (
        <Typography variant="body-12" color="secondary">
          {subtitle}
        </Typography>
      )}
      
      {trend && (
        <View className="flex-row items-center mt-2">
          <Ionicons 
            name={trendIcon as any} 
            size={14} 
            color={trendColor} 
          />
          <Typography 
            variant="tiny-10" 
            style={{ color: trendColor }}
            className="ml-1"
          >
            {trend.percentage}% {trend.period}
          </Typography>
        </View>
      )}
    </View>
  );
};