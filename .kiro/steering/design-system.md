# Design System Steering for bittersweet

---
inclusion: always
---

## Overview

This document defines the comprehensive design system for the bittersweet React Native application, extracted directly from our Figma design files. All components and styling must strictly adhere to these design tokens to ensure visual consistency across the application.

## Color System

### Primary Colors
```typescript
export const colors = {
  // Primary Brand Colors
  primary: '#6592E9',
  primaryDisabled: '#6592E9', // Same as primary but with opacity
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
  },
  
  // Dark Mode Colors
  dark: {
    textPrimary: '#FFFFFF',
    textSecondary: '#CACACA',
    border: '#575757',
    background: '#1B1C30',
  },
} as const;
```

### Gradient System
```typescript
export const gradients = {
  green: 'linear-gradient(135deg, #51BC6F, #4CAF50)',
  blue: 'linear-gradient(135deg, #6592E9, #438EEC)',
  red: 'linear-gradient(135deg, #EF786C, #E57373)',
  orange: 'linear-gradient(135deg, #FF9800, #FF7043)',
  yellow: 'linear-gradient(135deg, #FFC107, #FFB300)',
  darkBlue: 'linear-gradient(135deg, #1B1C30, #2C2F48)',
  
  // Action Gradients
  actions: {
    green: 'linear-gradient(135deg, #51BC6F, #4CAF50)',
    red: 'linear-gradient(135deg, #EF786C, #E57373)',
  },
} as const;
```

### NativeWind Color Configuration
```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6592E9',
        'primary-disabled': '#6592E9',
        link: '#438EEC',
        success: '#51BC6F',
        error: '#EF786C',
        'text-grey': '#CACACA',
        
        // Light mode
        'light-text-primary': '#4C4C4C',
        'light-text-secondary': '#8A8A8A',
        'light-border': '#E1E1E1',
        'light-bg': '#FFFFFF',
        
        // Dark mode
        'dark-text-primary': '#FFFFFF',
        'dark-text-secondary': '#CACACA',
        'dark-border': '#575757',
        'dark-bg': '#1B1C30',
      },
    },
  },
};
```

## Typography System

### Font Family
- **Primary Font**: Poppins
- **Fallback**: System default sans-serif

### Typography Scale
```typescript
export const typography = {
  // Headlines
  headline: {
    main24: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: 24,
      fontWeight: '600',
      lineHeight: 24, // 100% line height
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
      lineHeight: 24, // Increased line height for readability
    },
    regular12: {
      fontFamily: 'Poppins-Regular',
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 12,
    },
    placeholder12: {
      fontFamily: 'Poppins-Italic',
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
```

### NativeWind Typography Classes
```javascript
// Add to tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        'poppins-regular': ['Poppins-Regular'],
        'poppins-medium': ['Poppins-Medium'],
        'poppins-semibold': ['Poppins-SemiBold'],
        'poppins-italic': ['Poppins-Italic'],
      },
      fontSize: {
        'headline-24': ['24px', '24px'],
        'headline-20': ['20px', '20px'],
        'headline-18': ['18px', '18px'],
        'subtitle-16': ['16px', '16px'],
        'subtitle-14': ['14px', '14px'],
        'body-14': ['14px', '14px'],
        'paragraph-14': ['14px', '24px'],
        'body-12': ['12px', '12px'],
        'tiny-10': ['10px', '10px'],
      },
    },
  },
};
```

## Spacing System

### Base Spacing Scale
```typescript
export const spacing = {
  xs: 4,    // 0.25rem
  sm: 8,    // 0.5rem
  md: 12,   // 0.75rem
  lg: 16,   // 1rem
  xl: 20,   // 1.25rem
  '2xl': 24, // 1.5rem
  '3xl': 32, // 2rem
  '4xl': 40, // 2.5rem
  '5xl': 48, // 3rem
} as const;
```

### Component Spacing Guidelines
- **Buttons**: Padding 12px vertical, 20px horizontal
- **Cards**: Padding 16px all sides
- **Modals**: Padding 24px all sides
- **List Items**: Padding 16px vertical, 20px horizontal
- **Form Fields**: Margin bottom 16px

## Component Design Tokens

### Button System
```typescript
export const buttonTokens = {
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderColor: colors.light.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  disabled: {
    backgroundColor: colors.primaryDisabled,
    opacity: 0.5,
  },
} as const;
```

### Card System
```typescript
export const cardTokens = {
  default: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dark: {
    backgroundColor: colors.dark.background,
    borderColor: colors.dark.border,
    borderWidth: 1,
  },
} as const;
```

### Input System
```typescript
export const inputTokens = {
  default: {
    borderColor: colors.light.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  focused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  error: {
    borderColor: colors.error,
    borderWidth: 1,
  },
} as const;
```

## Theme Configuration

### Light Theme
```typescript
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
```

### Dark Theme
```typescript
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
```

## Component Implementation Standards

### Base Component Template
```tsx
import React, { FC } from 'react';
import { View, Text, Pressable } from 'react-native';
import { styled } from 'nativewind';

interface ComponentProps {
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

const StyledPressable = styled(Pressable);
const StyledText = styled(Text);

export const Component: FC<ComponentProps> = ({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  ...props
}) => {
  return (
    <StyledPressable
      className={`
        ${variant === 'primary' 
          ? 'bg-primary' 
          : 'bg-transparent border border-light-border'
        }
        ${size === 'small' ? 'px-4 py-2' : 'px-5 py-3'}
        ${disabled ? 'opacity-50' : 'active:opacity-80'}
        rounded-xl
      `}
      disabled={disabled}
      {...props}
    >
      <StyledText 
        className={`
          ${variant === 'primary' ? 'text-white' : 'text-light-text-primary'}
          font-poppins-semibold text-subtitle-14
        `}
      >
        Component Text
      </StyledText>
    </StyledPressable>
  );
};
```

### Typography Component
```tsx
import React, { FC, ReactNode } from 'react';
import { Text, TextProps } from 'react-native';
import { styled } from 'nativewind';

type TypographyVariant = 
  | 'headline-24' | 'headline-20' | 'headline-18'
  | 'subtitle-16' | 'subtitle-14-semibold' | 'subtitle-14-medium'
  | 'body-14' | 'paragraph-14' | 'body-12' | 'tiny-10';

interface TypographyProps extends TextProps {
  variant: TypographyVariant;
  color?: 'primary' | 'secondary' | 'error' | 'success';
  children: ReactNode;
}

const StyledText = styled(Text);

const variantClasses = {
  'headline-24': 'font-poppins-semibold text-headline-24',
  'headline-20': 'font-poppins-semibold text-headline-20',
  'headline-18': 'font-poppins-semibold text-headline-18',
  'subtitle-16': 'font-poppins-semibold text-subtitle-16',
  'subtitle-14-semibold': 'font-poppins-semibold text-subtitle-14',
  'subtitle-14-medium': 'font-poppins-medium text-subtitle-14',
  'body-14': 'font-poppins-regular text-body-14',
  'paragraph-14': 'font-poppins-regular text-paragraph-14',
  'body-12': 'font-poppins-regular text-body-12',
  'tiny-10': 'font-poppins-regular text-tiny-10',
};

const colorClasses = {
  primary: 'text-light-text-primary dark:text-dark-text-primary',
  secondary: 'text-light-text-secondary dark:text-dark-text-secondary',
  error: 'text-error',
  success: 'text-success',
};

export const Typography: FC<TypographyProps> = ({
  variant,
  color = 'primary',
  children,
  className,
  ...props
}) => {
  return (
    <StyledText
      className={`
        ${variantClasses[variant]}
        ${colorClasses[color]}
        ${className || ''}
      `}
      {...props}
    >
      {children}
    </StyledText>
  );
};
```

## Accessibility Standards

### Color Contrast Requirements
- **Primary text on white**: #4C4C4C on #FFFFFF (WCAG AA compliant)
- **Secondary text on white**: #8A8A8A on #FFFFFF (WCAG AA compliant)
- **Primary text on dark**: #FFFFFF on #1B1C30 (WCAG AAA compliant)
- **Primary button**: #FFFFFF on #6592E9 (WCAG AA compliant)

### Focus States
```typescript
export const focusTokens = {
  outline: {
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: 4,
  },
  shadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
} as const;
```

## Animation Standards

### Timing Functions
```typescript
export const animations = {
  timing: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easing: {
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },
} as const;
```

### Common Animations
```tsx
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Scale animation for buttons
const scaleStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.95 : 1) }],
}));

// Fade animation for modals
const fadeStyle = useAnimatedStyle(() => ({
  opacity: withTiming(visible.value ? 1 : 0, { duration: 300 }),
}));
```

## Implementation Checklist

### For Every Component:
- [ ] Uses design tokens from this system
- [ ] Implements both light and dark mode variants
- [ ] Follows accessibility guidelines
- [ ] Uses proper typography variants
- [ ] Implements focus states
- [ ] Uses consistent spacing
- [ ] Matches Figma designs exactly

### For Every Screen:
- [ ] Uses consistent color palette
- [ ] Implements proper typography hierarchy
- [ ] Uses consistent spacing and layout
- [ ] Supports both light and dark themes
- [ ] Follows accessibility best practices

## Usage Examples

### Button Implementation
```tsx
// Primary button with proper design tokens
<Button
  variant="primary"
  size="medium"
  onPress={handlePress}
  className="bg-primary text-white font-poppins-semibold text-subtitle-14 px-5 py-3 rounded-xl active:opacity-80"
>
  Start Focus Session
</Button>

// Secondary button
<Button
  variant="secondary"
  size="medium"
  onPress={handlePress}
  className="bg-transparent border border-light-border dark:border-dark-border text-light-text-primary dark:text-dark-text-primary font-poppins-semibold text-subtitle-14 px-5 py-3 rounded-xl active:opacity-80"
>
  Cancel
</Button>
```

### Card Implementation
```tsx
<View className="bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-2xl p-4 shadow-lg">
  <Typography variant="headline-18" color="primary">
    Focus Session
  </Typography>
  <Typography variant="body-14" color="secondary" className="mt-2">
    25 minutes of focused work
  </Typography>
</View>
```

This design system ensures complete visual consistency with your Figma designs while providing a robust foundation for React Native development with NativeWind.