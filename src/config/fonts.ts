/**
 * Centralized font configuration for the bittersweet app
 * All font references should use these constants to ensure consistency
 */
import type { TextStyle } from 'react-native';

import { usesSystemFont } from '../i18n/languages';

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
  'body-16': {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 16,
    lineHeight: 22, // 1.375x for better spacing and no clipping
    fontWeight: FONT_WEIGHTS.regular,
  },
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

/**
 * Drop the Poppins family for languages whose script Poppins has no glyphs for
 * (Russian, Bengali, Arabic, Urdu, Japanese, Korean, Chinese — see the
 * `systemFont` flag in `src/i18n/languages.ts`).
 *
 * Leaving `fontFamily` undefined makes React Native fall back to the iOS system
 * font, which is the *point*: SF Pro, SF Arabic, Kohinoor Bengali and PingFang
 * are Apple-designed for these scripts and, crucially, they honour the
 * `fontWeight` that every typography variant already carries. Naming a font
 * that lacks the glyphs instead leaves CoreText to substitute per glyph, which
 * loses the weight scale and renders a Latin word ("Grove") in Poppins while
 * the script around it changes face.
 *
 * Hindi is deliberately absent from that set — Poppins ships Devanagari, so
 * Hindi keeps the brand font.
 */
export function resolveFontFamily(
  family: string | undefined,
  language: string | null | undefined
): string | undefined {
  return usesSystemFont(language) ? undefined : family;
}

const BRAND_FONT_CLASS = /\bfont-poppins-(regular|medium|semibold|bold)\b/g;

/**
 * Translate `font-poppins-*` utility classes into a plain `fontWeight` when the
 * active language needs the system font.
 *
 * Call sites use these classes to nudge the weight of a Typography variant
 * (`className="font-poppins-semibold"` on a `body-14`). They compile to a
 * `fontFamily`, so on a Cyrillic or Arabic screen they would re-pin the very
 * family `resolveTypographyStyle` just removed. Rewriting them is
 * deterministic — it doesn't depend on how NativeWind orders className styles
 * against the `style` prop — and, unlike simply dropping them, it keeps the
 * weight the author asked for.
 *
 * Returns the className unchanged for Latin/Devanagari languages.
 */
export function resolveBrandFontClasses(
  className: string | undefined,
  language: string | null | undefined
): { className: string | undefined; weightStyle: TextStyle | undefined } {
  if (!className || !usesSystemFont(language)) {
    return { className, weightStyle: undefined };
  }

  let weight: TextStyle['fontWeight'];
  const cleaned = className.replace(BRAND_FONT_CLASS, (_match, name: string) => {
    weight = FONT_WEIGHTS[name as keyof typeof FONT_WEIGHTS] as TextStyle['fontWeight'];
    return '';
  });

  return { className: cleaned, weightStyle: weight ? { fontWeight: weight } : undefined };
}

/** A typography variant with its font family resolved for the active language. */
export function resolveTypographyStyle(
  variant: TypographyVariant,
  language: string | null | undefined
): TextStyle {
  const base = TYPOGRAPHY_VARIANTS[variant] as TextStyle;
  if (!usesSystemFont(language)) {
    return base;
  }
  // `fontWeight` stays — it is what reproduces the scale on the system face.
  const { fontFamily: _dropped, ...rest } = base;
  return rest;
}
