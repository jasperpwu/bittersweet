import React, { FC, useState } from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  variant?: 'default' | 'outlined';
}


export const Input: FC<InputProps> = ({
  label,
  error,
  variant = 'default',
  className,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="w-full">
      {label && (
        <Text className="font-poppins-medium text-body-14 text-light-text-primary dark:text-dark-text-primary mb-2">
          {label}
        </Text>
      )}
      <TextInput
        className={`
          ${variant === 'outlined' 
            ? 'border border-light-border dark:border-dark-border' 
            : 'bg-light-bg dark:bg-dark-bg'
          }
          ${isFocused ? 'border-primary border-2' : ''}
          ${error ? 'border-error' : ''}
          rounded-xl px-4 py-3 min-h-12
          font-poppins-regular text-body-14
          text-light-text-primary dark:text-dark-text-primary
          ${className || ''}
        `}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholderTextColor="#8A8A8A"
        {...props}
      />
      {error && (
        <Text className="font-poppins-regular text-body-12 text-error mt-1">
          {error}
        </Text>
      )}
    </View>
  );
};