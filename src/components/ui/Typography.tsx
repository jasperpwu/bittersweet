import { FC, ReactNode } from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import {
  TYPOGRAPHY_VARIANTS,
  TypographyVariant,
  resolveBrandFontClasses,
  resolveTypographyStyle,
} from '../../config/fonts';
import { useLanguage } from '../../i18n/useLanguage';
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
  // Poppins has no glyphs for several shipped scripts (Cyrillic, Bengali,
  // Arabic, CJK), so the family is resolved per language — see resolveFontFamily.
  const language = useLanguage();
  const { className: resolvedClassName, weightStyle } = resolveBrandFontClasses(
    className,
    language
  );
  const baseTypographyStyle = TYPOGRAPHY_VARIANTS[variant]
    ? resolveTypographyStyle(variant, language)
    : (undefined as unknown as TextStyle);

  if (!baseTypographyStyle) {
    console.error(`Typography variant "${variant}" not found. Using body-14 as fallback.`);
    const fallbackStyle = resolveTypographyStyle('body-14', language);
    const noClipStyle = createNoClipTextStyle(fallbackStyle);

    return (
      <Text
        className={`${colorClasses[color]} ${resolvedClassName || ''}`}
        style={[noClipStyle, weightStyle, style]}
        {...props}>
        {children}
      </Text>
    );
  }

  const noClipStyle = createNoClipTextStyle(baseTypographyStyle);

  return (
    <Text
      className={`${colorClasses[color]} ${resolvedClassName || ''}`}
      style={[noClipStyle, weightStyle, style]}
      {...props}>
      {children}
    </Text>
  );
};
