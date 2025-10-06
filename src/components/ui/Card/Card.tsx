import React, { FC, ReactNode } from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
  borderRadius?: 'small' | 'medium' | 'large';
  children: ReactNode;
}

export const Card: FC<CardProps> = ({
  variant = 'default',
  padding = 'medium',
  borderRadius = 'large',
  children,
  className,
  style,
  ...props
}) => {
  const paddingClasses = {
    none: '',
    small: 'p-2',
    medium: 'p-4',
    large: 'p-6',
  };

  const radiusClasses = {
    small: 'rounded-lg',
    medium: 'rounded-xl',
    large: 'rounded-2xl',
  };

  const variantClasses = {
    default: 'bg-dark-bg',
    outlined: 'bg-transparent border border-dark-border',
    elevated: 'bg-dark-bg',
  };

  const shadowStyle = variant === 'elevated' ? {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  } : {};

  return (
    <View
      className={`
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${radiusClasses[borderRadius]}
        ${className || ''}
      `}
      style={[shadowStyle, style]}
      {...props}
    >
      {children}
    </View>
  );
};