import React, { FC } from 'react';
import { View } from 'react-native';
import { Button } from '../../ui/Button';

interface TimerControlsProps {
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
  disabled?: boolean;
}


export const TimerControls: FC<TimerControlsProps> = ({
  isRunning,
  isPaused,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
  disabled = false,
}) => {
  return (
    <View className="flex-row justify-center items-center space-x-4 px-4">
      {!isRunning && !isPaused && (
        <Button
          variant="primary"
          size="large"
          onPress={onStart}
          disabled={disabled}
          className="flex-1"
        >
          Start Focus
        </Button>
      )}
      
      {isRunning && (
        <>
          <Button
            variant="secondary"
            size="medium"
            onPress={onPause}
            disabled={disabled}
            className="flex-1"
          >
            Pause
          </Button>
          <Button
            variant="secondary"
            size="medium"
            onPress={onStop}
            disabled={disabled}
            className="flex-1"
          >
            Stop
          </Button>
        </>
      )}
      
      {isPaused && (
        <>
          <Button
            variant="primary"
            size="medium"
            onPress={onResume}
            disabled={disabled}
            className="flex-1"
          >
            Resume
          </Button>
          <Button
            variant="secondary"
            size="medium"
            onPress={onReset}
            disabled={disabled}
            className="flex-1"
          >
            Reset
          </Button>
        </>
      )}
    </View>
  );
};