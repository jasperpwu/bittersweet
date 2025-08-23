import React, { FC, useState } from 'react';
import { TextInput, TextInputProps, View } from 'react-native';
import { Typography } from '../Typography';
import { getFontFamily } from '../../../utils/typography';

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
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="w-full">
      {label && (
        <Typography variant="subtitle-14-medium" className="mb-2">
          {label}
        </Typography>
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
          text-light-text-primary dark:text-dark-text-primary
          ${className || ''}
        `}
        style={[
          {
            fontFamily: getFontFamily('regular'),
            fontSize: 14,
          },
          style,
        ]}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholderTextColor="#8A8A8A"
        {...props}
      />
      {error && (
        <Typography variant="body-12" color="error" className="mt-1">
          {error}
        </Typography>
      )}
    </View>
  );
};