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
    <View className="flex-row items-center justify-center">
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          className={`mx-1 h-2 rounded-full ${
            i === currentStep
              ? 'w-6 bg-primary'
              : i < currentStep
                ? 'w-2 bg-primary'
                : 'w-2 bg-light-border dark:bg-dark-border'
          }`}
        />
      ))}
    </View>
  );
};
