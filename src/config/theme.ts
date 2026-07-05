// Design System Theme Configuration
export const colors = {
  // Primary Brand Colors
  primary: '#6592E9',
  primaryDisabled: '#6592E9',
  link: '#438EEC',
  
  // Status Colors
  success: '#51BC6F',
  error: '#EF786C',
  
  // Neutral Colors
  white: '#FFFFFF',
  textGrey: '#CACACA',
  
  // Light Mode Colors
  light: {
    textPrimary: '#4C4C4C',
    textSecondary: '#8A8A8A',
    border: '#E1E1E1',
    background: '#FFFFFF',
    // App screen background (NativeWind `bg-light-bg`). Differs from `background`
    // (#FFFFFF) — the screen is cream. Use this for inline-styled surfaces that
    // need to blend into the screen the way `bg-light-bg` does.
    screen: '#F5E6D3',
    // Border tuned for the cream screen (NativeWind `border-light-border`).
    // Differs from `border` (#E1E1E1, a grey for white surfaces) — the grey reads
    // too white on cream. Use this for inline-styled borders on the screen.
    screenBorder: '#D4C4A8',
    // Secondary text on the cream screen (NativeWind `text-light-text-secondary`).
    // Differs from `textSecondary` (#8A8A8A, a grey for white surfaces, near-
    // invisible on cream). Use this for inline-styled icons/text that sit next
    // to Typography color="secondary".
    screenTextSecondary: '#6B5A42',
  },

  // Dark Mode Colors
  dark: {
    textPrimary: '#FFFFFF',
    textSecondary: '#CACACA',
    border: '#575757',
    background: '#1B1C30',
    // App screen background (NativeWind `bg-dark-bg`); same as `background` in dark.
    screen: '#1B1C30',
    // Border on the dark screen (NativeWind `border-dark-border`); same as `border`.
    screenBorder: '#575757',
  },
} as const;

export const typography = {
  // Headlines
  headline: {
    main24: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 24,
    },
    main20: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 20,
      fontWeight: '600',
      lineHeight: 20,
    },
    main18: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 18,
      fontWeight: '600',
      lineHeight: 18,
    },
    subtitle16: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 16,
    },
    subtitle14Semibold: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 14,
      fontWeight: '600',
      lineHeight: 14,
    },
    subtitle14Medium: {
      fontFamily: 'Poppins-Medium',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 14,
    },
  },
  
  // Body Text
  body: {
    regular14: {
      fontFamily: 'Poppins-Regular',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 14,
    },
    paragraph14: {
      fontFamily: 'Poppins-Regular',
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 24,
    },
    regular12: {
      fontFamily: 'Poppins-Regular',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 12,
    },
    tiny10: {
      fontFamily: 'Poppins-Regular',
      fontSize: 10,
      fontWeight: '400',
      lineHeight: 10,
    },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const animations = {
  timing: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
} as const;

// Light Theme
export const lightTheme = {
  colors: {
    background: colors.white,
    surface: colors.white,
    primary: colors.primary,
    text: colors.light.textPrimary,
    textSecondary: colors.light.textSecondary,
    border: colors.light.border,
    success: colors.success,
    error: colors.error,
    link: colors.link,
  },
  typography,
  spacing,
} as const;

// Dark Theme
export const darkTheme = {
  colors: {
    background: colors.dark.background,
    surface: colors.dark.background,
    primary: colors.primary,
    text: colors.dark.textPrimary,
    textSecondary: colors.dark.textSecondary,
    border: colors.dark.border,
    success: colors.success,
    error: colors.error,
    link: colors.link,
  },
  typography,
  spacing,
} as const;