/**
 * Centralized font configuration for the bittersweet app
 * All font references should use these constants to ensure consistency
 */

export const FONT_FAMILIES = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semibold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
} as const;

export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Typography variants matching the design system
 * Line heights are set to 1.3-1.4x font size to prevent text clipping
 * includeFontPadding is handled in the Typography component
 */
export const TYPOGRAPHY_VARIANTS = {
  // Headlines
  'headline-24': {
    fontFamily: FONT_FAMILIES.semibold,
    fontSize: 24,
    lineHeight: 34, // 1.42x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.semibold,
  },
  'headline-20': {
    fontFamily: FONT_FAMILIES.semibold,
    fontSize: 20,
    lineHeight: 28, // 1.4x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.semibold,
  },
  'headline-18': {
    fontFamily: FONT_FAMILIES.semibold,
    fontSize: 18,
    lineHeight: 26, // 1.44x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.semibold,
  },
  
  // Subtitles
  'subtitle-16': {
    fontFamily: FONT_FAMILIES.semibold,
    fontSize: 16,
    lineHeight: 22, // 1.375x for better spacing
    fontWeight: FONT_WEIGHTS.semibold,
  },
  'subtitle-14-semibold': {
    fontFamily: FONT_FAMILIES.semibold,
    fontSize: 14,
    lineHeight: 20, // 1.43x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.semibold,
  },
  'subtitle-14-medium': {
    fontFamily: FONT_FAMILIES.medium,
    fontSize: 14,
    lineHeight: 20, // 1.43x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.medium,
  },
  
  // Body text
  'body-14': {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 14,
    lineHeight: 20, // 1.43x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.regular,
  },
  'paragraph-14': {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 14,
    lineHeight: 24, // 1.71x for readability (kept as is)
    fontWeight: FONT_WEIGHTS.regular,
  },
  'body-12': {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 12,
    lineHeight: 18, // 1.5x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.regular,
  },
  'tiny-10': {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 10,
    lineHeight: 16, // 1.6x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.regular,
  },
} as const;

export type TypographyVariant = keyof typeof TYPOGRAPHY_VARIANTS;