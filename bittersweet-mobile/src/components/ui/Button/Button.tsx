import React, { FC, memo } from 'react';
import { Pressable, PressableProps, Text } from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  children: string;
}

export const Button: FC<ButtonProps> = memo(({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  children,
  ...props
}) => {
  return (
    <Pressable
      style={{
        backgroundColor: variant === 'primary' ? '#6592E9' : 'transparent',
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: variant === 'secondary' ? '#E1E1E1' : 'transparent',
        paddingHorizontal: size === 'small' ? 16 : size === 'large' ? 24 : 20,
        paddingVertical: size === 'small' ? 8 : size === 'large' ? 16 : 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
      disabled={disabled}
      {...props}
    >
      <Text 
        style={{
          color: variant === 'primary' ? '#FFFFFF' : '#4C4C4C',
          fontFamily: 'Poppins-SemiBold',
          fontSize: 14,
          fontWeight: '600',
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
});

Button.displayName = 'Button';