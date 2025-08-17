import React, { FC, ReactNode } from 'react';
import { Text, TextProps } from 'react-native';

type TypographyVariant = 
  | 'headline-24' | 'headline-20' | 'headline-18'
  | 'subtitle-16' | 'subtitle-14-semibold' | 'subtitle-14-medium'
  | 'body-14' | 'paragraph-14' | 'body-12' | 'tiny-10';

interface TypographyProps extends TextProps {
  variant: TypographyVariant;
  color?: 'primary' | 'secondary' | 'error' | 'success' | 'white';
  children: ReactNode;
}


const variantClasses = {
  'headline-24': 'font-poppins-semibold text-2xl leading-6',
  'headline-20': 'font-poppins-semibold text-xl leading-5',
  'headline-18': 'font-poppins-semibold text-lg leading-5',
  'subtitle-16': 'font-poppins-semibold text-base leading-4',
  'subtitle-14-semibold': 'font-poppins-semibold text-sm leading-4',
  'subtitle-14-medium': 'font-poppins-medium text-sm leading-4',
  'body-14': 'font-poppins-regular text-sm leading-4',
  'paragraph-14': 'font-poppins-regular text-sm leading-6',
  'body-12': 'font-poppins-regular text-xs leading-3',
  'tiny-10': 'font-poppins-regular text-xs leading-3',
};

const colorClasses = {
  primary: 'text-light-text-primary dark:text-dark-text-primary',
  secondary: 'text-light-text-secondary dark:text-dark-text-secondary',
  error: 'text-error',
  success: 'text-success',
  white: 'text-white',
};

export const Typography: FC<TypographyProps> = ({
  variant,
  color = 'primary',
  children,
  className,
  ...props
}) => {
  return (
    <Text
      className={`
        ${variantClasses[variant]}
        ${colorClasses[color]}
        ${className || ''}
      `}
      {...props}
    >
      {children}
    </Text>
  );
};