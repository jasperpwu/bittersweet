---
inclusion: always
---

# Design System - bittersweet

## Typography

### Font Family
- **Primary Font**: Poppins (Regular, Medium, Semibold, Bold)

### Typography Scale
```typescript
// constants/fonts.ts
export const FONTS = {
  HEADLINE_1: {
    fontSize: 24,
    lineHeight: 'auto',
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  HEADLINE_2: {
    fontSize: 20,
    lineHeight: 'auto',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  HEADLINE_3: {
    fontSize: 18,
    lineHeight: 'auto',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  HEADLINE_4: {
    fontSize: 16,
    lineHeight: 'auto',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  HEADLINE_5: {
    fontSize: 14,
    lineHeight: 'auto',
    fontWeight: '600',
    fontFamily: 'Poppins-SemiBold',
  },
  HEADLINE_6: {
    fontSize: 14,
    lineHeight: 'auto',
    fontWeight: '500',
    fontFamily: 'Poppins-Medium',
  },
  BODY_1: {
    fontSize: 14,
    lineHeight: 'auto',
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
  },
  PARAGRAPH: {
    fontSize: 12,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
    fontStyle: 'italic',
  },
  BODY_2: {
    fontSize: 12,
    lineHeight: 'auto',
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
  },
  PLACEHOLDER: {
    fontSize: 12,
    lineHeight: 'auto',
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
    fontStyle: 'italic',
  },
  TINY: {
    fontSize: 10,
    lineHeight: 'auto',
    fontWeight: '400',
    fontFamily: 'Poppins-Regular',
  },
};
```

## Color System

### Core Colors
```typescript
// constants/colors.ts
export const COLORS = {
  PRIMARY: '#6592E9',
  LINK: '#438EEC',
  DISABLED: '#6592E9', // 60% opacity should be applied
  BLACK: '#4C4C4C',
  RED: '#EF786C',
  GREEN: '#51BC6F',
  GRAY_TEXT: '#CACACA',
  WHITE: '#FFFFFF',
};
```

### Theme Colors (Updated with Component Usage)
```typescript
export const LIGHT_THEME = {
  ...COLORS,
  TEXT: '#4C4C4C',
  GRAY_TEXT: '#8A8A8A',
  GRAY_BORDER: '#E1E1E1',
  BACKGROUND: '#FFFFFF',
  
  // Component-specific colors
  INPUT_BACKGROUND: '#F3F6F8', // For slider tracks and inactive states
  CONTROL_BORDER: '#E1E1E1', // For +/- buttons and input borders
  DISABLED_OPACITY: 0.6, // For disabled button states
};

export const DARK_THEME = {
  ...COLORS,
  TEXT: '#FFFFFF',
  GRAY_TEXT: '#CACACA',
  GRAY_BORDER: '#575757',
  BACKGROUND: '#1B1C30',
  
  // Component-specific colors
  INPUT_BACKGROUND: '#4F5170', // For slider tracks in dark mode
  CONTROL_BORDER: '#575757', // For +/- buttons and input borders
  DISABLED_OPACITY: 0.6,
};
```

### Component Dimensions
```typescript
export const COMPONENT_SIZES = {
  // Button sizes
  BUTTON_HEIGHT: 60,
  BUTTON_WIDTH: 335,
  BUTTON_PADDING_VERTICAL: 19.5,
  BUTTON_PADDING_HORIZONTAL: 133,
  
  // Input sizes
  INPUT_HEIGHT: 48,
  INPUT_WIDTH: 335,
  INPUT_PADDING_VERTICAL: 15,
  INPUT_PADDING_HORIZONTAL: 20,
  
  // Time control sizes
  CONTROL_BUTTON_SIZE: 20,
  CONTROL_ICON_WIDTH: 8,
  CONTROL_ICON_HEIGHT_MINUS: 2,
  CONTROL_ICON_HEIGHT_PLUS: 8,
  
  // Slider sizes
  SLIDER_TRACK_HEIGHT: 6,
  SLIDER_THUMB_SIZE: 16,
  
  // Password dots
  DOT_SIZE: 6,
  DOT_SPACING: 9,
};
```

### Gradients
```typescript
export const GRADIENTS = {
  GREEN: ['#62C38E', '#43A971'],
  ORANGE: ['#FFA556', '#F3913B'],
  BLUE: ['#01B9FF', '#018FFF'],
  YELLOW: ['#FAC338', '#F2BD33'],
  RED: ['#FD5B71', '#EB4C62'],
  DARK_BLUE: ['#6167C1', '#3D439D'],
};
```

## Component Standards

### Button Component
Based on your design system, buttons should follow these exact patterns:

```typescript
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'disabled' | 'outline' | 'text';
  disabled?: boolean;
  fullWidth?: boolean;
}

// Button variants implementation
const ButtonStyles = StyleSheet.create({
  // Primary button - main actions
  primary: {
    backgroundColor: COLORS.PRIMARY, // #6592E9
    borderRadius: BORDER_RADIUS.MD, // 8px
    paddingVertical: 19.5,
    paddingHorizontal: 133,
    height: 60,
  },
  
  // Disabled state - 60% opacity of primary
  disabled: {
    backgroundColor: `${COLORS.PRIMARY}99`, // rgba(101, 146, 233, 0.6)
    borderRadius: BORDER_RADIUS.MD,
    paddingVertical: 19.5,
    paddingHorizontal: 133,
    height: 60,
  },
  
  // Outline/Border button - secondary actions
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: LIGHT_THEME.GRAY_BORDER, // #E1E1E1
    borderRadius: BORDER_RADIUS.MD,
    paddingVertical: 19.5,
    paddingHorizontal: 133,
    height: 60,
  },
  
  // Text-only button - tertiary actions
  text: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.ROUND, // 100px for text buttons
    paddingVertical: 19.5,
    paddingHorizontal: 133,
    height: 60,
  }
});

const ButtonTextStyles = StyleSheet.create({
  primary: {
    ...FONTS.HEADLINE_5, // 14px semibold
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  disabled: {
    ...FONTS.HEADLINE_5,
    color: COLORS.WHITE,
    textAlign: 'center',
  },
  outline: {
    ...FONTS.HEADLINE_5,
    color: COLORS.BLACK, // #4C4C4C
    textAlign: 'center',
  },
  text: {
    ...FONTS.HEADLINE_5,
    color: COLORS.LINK, // #438EEC
    textAlign: 'center',
  },
});

// Usage examples
<Button title="Sign in" variant="primary" onPress={handleSignIn} />
<Button title="Sign in" variant="disabled" disabled onPress={handleSignIn} />
<Button title="Sign in" variant="outline" onPress={handleSecondaryAction} />
<Button title="Sign in" variant="text" onPress={handleTertiaryAction} />
```

### Input Component
Based on your design patterns, inputs should follow these specifications:

```typescript
interface InputProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  state?: 'default' | 'active' | 'error';
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

const InputStyles = StyleSheet.create({
  container: {
    width: 335,
    marginBottom: SPACING.MD,
  },
  
  label: {
    ...FONTS.HEADLINE_6, // 14px medium
    color: COLORS.BLACK, // #4C4C4C in light mode
    marginBottom: 8,
  },
  
  // Input field styles based on state
  inputDefault: {
    borderWidth: 1,
    borderColor: LIGHT_THEME.GRAY_BORDER, // #E1E1E1
    borderRadius: BORDER_RADIUS.MD, // 8px
    paddingVertical: 15,
    paddingHorizontal: 20,
    height: 48,
    ...FONTS.BODY_1, // 14px regular
    color: COLORS.BLACK,
  },
  
  inputActive: {
    borderColor: COLORS.PRIMARY, // #6592E9
    borderWidth: 1,
  },
  
  inputError: {
    borderColor: COLORS.RED, // #EF786C
    borderWidth: 1,
  },
  
  placeholder: {
    ...FONTS.PLACEHOLDER, // 12px italic
    color: LIGHT_THEME.GRAY_TEXT, // #8A8A8A
  },
  
  errorText: {
    ...FONTS.TINY, // 10px regular
    color: COLORS.RED,
    marginTop: 4,
  },
  
  forgotPassword: {
    ...FONTS.HEADLINE_6, // 14px medium
    color: COLORS.LINK, // #438EEC
    textAlign: 'right',
    position: 'absolute',
    right: 0,
    top: 0,
  }
});

// Password input with dots for hidden text
const PasswordDots = ({ length }: { length: number }) => (
  <View style={styles.passwordDots}>
    {Array.from({ length }, (_, i) => (
      <View key={i} style={styles.dot} />
    ))}
  </View>
);

const dotStyles = StyleSheet.create({
  passwordDots: {
    flexDirection: 'row',
    gap: 9, // 9px spacing between dots
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.BLACK, // #4C4C4C
  }
});

// Usage examples
<Input 
  label="Email" 
  placeholder="Enter your email"
  value={email}
  onChangeText={setEmail}
  state="default"
/>

<Input 
  label="Password" 
  value={password}
  onChangeText={setPassword}
  secureTextEntry={!showPassword}
  showPasswordToggle
  state="error"
  error="Password must be at least 8 characters"
  rightAction={<Text style={styles.forgotPassword}>Forgot your password</Text>}
/>
```

### Time/Duration Controls
Based on your break time components, here are the time control patterns:

```typescript
interface TimeControlProps {
  label: string;
  value: number; // in minutes
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  showMinusPlus?: boolean;
}

interface SliderProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

const TimeControlStyles = StyleSheet.create({
  container: {
    width: 335,
    marginBottom: SPACING.MD,
  },
  
  label: {
    ...FONTS.HEADLINE_6, // 14px medium
    color: COLORS.BLACK,
    marginBottom: 8,
  },
  
  // Time input with +/- controls
  timeInput: {
    borderWidth: 1,
    borderColor: LIGHT_THEME.GRAY_BORDER,
    borderRadius: BORDER_RADIUS.MD,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  
  timeValue: {
    ...FONTS.BODY_1, // 14px regular
    color: COLORS.BLACK,
  },
  
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  controlButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LIGHT_THEME.GRAY_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  controlIcon: {
    width: 8,
    height: 2, // For minus
    backgroundColor: COLORS.PRIMARY,
  },
  
  controlIconPlus: {
    width: 8,
    height: 8, // For plus (needs different implementation)
    backgroundColor: COLORS.PRIMARY,
  },
  
  controlLabel: {
    ...FONTS.BODY_2, // 12px regular
    color: COLORS.BLACK,
  },
  
  // Slider component
  sliderContainer: {
    marginBottom: SPACING.LG,
  },
  
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  
  sliderValue: {
    ...FONTS.HEADLINE_6, // 14px semibold for current value
    fontWeight: '600',
    color: COLORS.BLACK,
  },
  
  sliderMinMax: {
    ...FONTS.BODY_2, // 12px regular
    color: COLORS.BLACK,
  },
  
  sliderTrack: {
    height: 6,
    backgroundColor: '#F3F6F8', // Light gray background
    borderRadius: BORDER_RADIUS.MD,
    position: 'relative',
  },
  
  sliderProgress: {
    height: 6,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: BORDER_RADIUS.MD,
    opacity: 0.7,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  
  sliderThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.PRIMARY,
    position: 'absolute',
    top: -5, // Center on track
  }
});

// Usage examples
<TimeControl 
  label="Start break after" 
  value={25}
  onValueChange={setBreakStart}
  showMinusPlus
/>

<Slider 
  label="Working sessions"
  value={4}
  onValueChange={setWorkingSessions}
  min={1}
  max={8}
/>

<Slider 
  label="Long break"
  value={15}
  onValueChange={setLongBreak}
  min={10}
  max={30}
/>
```

## Layout Patterns

### Screen Structure
```typescript
const ScreenName: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Screen content */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  content: {
    padding: 16,
  },
});
```

### Spacing System
```typescript
export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
};
```

### Border Radius
```typescript
export const BORDER_RADIUS = {
  SM: 4,
  MD: 8,
  LG: 12,
  XL: 16,
  ROUND: 999,
};
```

## Animation Standards

### Focus Session Timer
- Use `React Native Reanimated` for smooth animations
- Timer should have pulsing animation during active session
- Completion should trigger celebration animation

### Screen Transitions
- Use React Navigation default transitions
- Custom transitions for modal presentations
- Smooth fade-ins for loading states

## Accessibility
- All interactive elements must have `accessibilityLabel`
- Support for screen readers
- Minimum touch target size: 44x44 points
- High contrast support for text

## Component Implementation Examples

### Focus Timer Display
```typescript
const FocusTimer: React.FC<{ duration: number; isActive: boolean }> = ({ duration, isActive }) => {
  return (
    <View style={styles.timerContainer}>
      <Text style={[FONTS.HEADLINE_1, { color: COLORS.PRIMARY }]}>
        {formatTime(duration)}
      </Text>
      {isActive && <PulsingCircle />}
    </View>
  );
};
```

### Journal Entry Card
```typescript
const JournalEntryCard: React.FC<{ entry: JournalEntry }> = ({ entry }) => {
  return (
    <Card shadow padding={SPACING.MD} margin={SPACING.SM}>
      <Text style={[FONTS.HEADLINE_4, { color: COLORS.BLACK }]}>
        {entry.title}
      </Text>
      <Text style={[FONTS.BODY_2, { color: COLORS.GRAY_TEXT }]}>
        {formatDuration(entry.duration)}
      </Text>
    </Card>
  );
};
```

## Design Principles
- **Human-Centered**: Focus on positive reinforcement and motivation
- **Clean & Minimal**: Avoid clutter, prioritize essential information
- **Consistent**: Use design system components throughout
- **Accessible**: Support users with different abilities
- **Delightful**: Subtle animations and celebrations for achievements