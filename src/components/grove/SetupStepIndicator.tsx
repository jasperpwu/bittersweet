import React from 'react';
import { View } from 'react-native';

interface SetupStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const SetupStepIndicator: React.FC<SetupStepIndicatorProps> = ({
  currentStep,
  totalSteps,
}) => {
  return (
    <View className="flex-row items-center justify-center gap-x-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= currentStep ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
          }`}
        />
      ))}
    </View>
  );
};
