import React, { FC } from 'react';
import { View } from 'react-native';
import { Typography } from '../../ui/Typography';

interface CircularTimerProps {
  duration: number; // in seconds
  remainingTime: number; // in seconds
  size?: number;
  strokeWidth?: number;
  isRunning?: boolean;
}


export const CircularTimer: FC<CircularTimerProps> = ({
  duration,
  remainingTime,
  size = 200,
  strokeWidth = 8,
  isRunning = false,
}) => {
  const progress = duration > 0 ? (duration - remainingTime) / duration : 0;
  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <View 
      className="items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Circular progress will be implemented with SVG */}
      <View className="absolute items-center justify-center">
        <Typography variant="headline-24" color="primary">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </Typography>
        <Typography variant="body-12" color="secondary">
          {isRunning ? 'Focus Time' : 'Paused'}
        </Typography>
      </View>
    </View>
  );
};