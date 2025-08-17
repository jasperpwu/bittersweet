import React, { FC, ReactNode } from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  variant?: 'default' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
  children: ReactNode;
}


export const Card: FC<CardProps> = ({
  variant = 'default',
  padding = 'medium',
  children,
  className,
  ...props
}) => {
  return (
    <View
      className={`
        ${variant === 'default' 
          ? 'bg-white dark:bg-dark-bg shadow-lg' 
          : 'bg-transparent border border-light-border dark:border-dark-border'
        }
        ${padding === 'none' ? '' : 
          padding === 'small' ? 'p-2' : 
          padding === 'large' ? 'p-6' : 'p-4'
        }
        rounded-2xl
        ${className || ''}
      `}
      {...props}
    >
      {children}
    </View>
  );
};