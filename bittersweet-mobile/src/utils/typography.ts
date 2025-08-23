import { TextStyle } from 'react-native';
import { TYPOGRAPHY_VARIANTS, TypographyVariant, FONT_FAMILIES } from '../config/fonts';

/**
 * Get typography styles for a given variant
 * Useful when you need to apply typography styles programmatically
 */
export const getTypographyStyle = (variant: TypographyVariant): TextStyle => {
  return TYPOGRAPHY_VARIANTS[variant] as TextStyle;
};

/**
 * Get font family for a given weight
 * Useful when you need to apply font family directly
 */
export const getFontFamily = (weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular'): string => {
  return FONT_FAMILIES[weight];
};

/**
 * Create a custom text style with Poppins font
 */
export const createTextStyle = (
  fontSize: number,
  weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular',
  lineHeight?: number
): TextStyle => ({
  fontFamily: getFontFamily(weight),
  fontSize,
  lineHeight: lineHeight || fontSize,
});