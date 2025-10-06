import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    period: string;
  };
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'error' | 'secondary';
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
}


export const StatCard: FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'primary',
  onPress,
  size = 'medium',
}) => {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      }
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toString();
    }
    return val;
  };

  const getTrendColor = () => {
    if (!trend) return 'secondary';
    switch (trend.direction) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      default:
        return 'secondary';
    }
  };

  const getTrendIcon = () => {
    if (!trend) return '';
    switch (trend.direction) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      default:
        return '→';
    }
  };

  const Component = onPress ? Pressable : View;

  return (
    <Component onPress={onPress} className={onPress ? 'active:opacity-80' : ''}>
      <Card 
        variant="default" 
        padding={size === 'small' ? 'small' : size === 'large' ? 'large' : 'medium'}
        className="flex-1"
      >
        <View className="items-center">
          {icon && (
            <View className="mb-2">
              {icon}
            </View>
          )}
          
          <Typography 
            variant={size === 'small' ? 'body-12' : 'body-14'} 
            color="secondary" 
            className="text-center mb-1"
          >
            {title}
          </Typography>
          
          <Typography 
            variant={size === 'small' ? 'headline-18' : size === 'large' ? 'headline-24' : 'headline-20'} 
            color={color}
            className="text-center mb-1"
          >
            {formatValue(value)}
          </Typography>
          
          {subtitle && (
            <Typography 
              variant="tiny-10" 
              color="secondary" 
              className="text-center"
            >
              {subtitle}
            </Typography>
          )}
          
          {trend && (
            <View className="flex-row items-center mt-2">
              <Typography variant="tiny-10" color={getTrendColor()}>
                {getTrendIcon()} {trend.percentage}%
              </Typography>
              <Typography variant="tiny-10" color="secondary" className="ml-1">
                {trend.period}
              </Typography>
            </View>
          )}
        </View>
      </Card>
    </Component>
  );
};