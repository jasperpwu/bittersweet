/**
 * Font styles resolved for the active language, for call sites that set type in
 * an inline style rather than going through `<Typography>` — tab-bar labels,
 * TextInputs, the duration picker.
 *
 * Each entry is a partial style meant to be spread:
 *
 *   <Text style={{ color, ...fonts.medium }} />
 *
 * For Latin and Devanagari languages it yields the Poppins family, whose file
 * already carries the weight. For scripts Poppins has no glyphs for it yields a
 * bare `fontWeight` instead, letting React Native use the iOS system font at
 * the right weight — see `resolveFontFamily` in `src/config/fonts.ts` for why
 * that beats leaving CoreText to substitute per glyph.
 */
import { useMemo } from 'react';
import type { TextStyle } from 'react-native';

import { FONT_FAMILIES, FONT_WEIGHTS, resolveFontFamily } from '../config/fonts';
import { useLanguage } from '../i18n/useLanguage';

type BrandFontStyle = Pick<TextStyle, 'fontFamily' | 'fontWeight'>;

export interface BrandFonts {
  regular: BrandFontStyle;
  medium: BrandFontStyle;
  semibold: BrandFontStyle;
  bold: BrandFontStyle;
}

function styleFor(weightKey: keyof typeof FONT_FAMILIES, language: string): BrandFontStyle {
  const fontFamily = resolveFontFamily(FONT_FAMILIES[weightKey], language);
  return fontFamily
    ? { fontFamily }
    : { fontWeight: FONT_WEIGHTS[weightKey] as TextStyle['fontWeight'] };
}

export function useBrandFonts(): BrandFonts {
  const language = useLanguage();

  return useMemo(
    () => ({
      regular: styleFor('regular', language),
      medium: styleFor('medium', language),
      semibold: styleFor('semibold', language),
      bold: styleFor('bold', language),
    }),
    [language]
  );
}
