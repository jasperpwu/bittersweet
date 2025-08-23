import { FC, ReactNode } from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { TYPOGRAPHY_VARIANTS, TypographyVariant } from '../../config/fonts';
import { createNoClipTextStyle } from '../../utils/textUtils';

interface TypographyProps extends TextProps {
  variant: TypographyVariant;
  color?: 'primary' | 'secondary' | 'error' | 'success' | 'white';
  children: ReactNode;
}

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
  style,
  ...props
}) => {
  const baseTypographyStyle = TYPOGRAPHY_VARIANTS[variant] as TextStyle;
  const noClipStyle = createNoClipTextStyle(baseTypographyStyle);

  return (
    <Text
      className={`${colorClasses[color]} ${className || ''}`}
      style={[noClipStyle, style]}
      {...props}
    >
      {children}
    </Text>
  );
};