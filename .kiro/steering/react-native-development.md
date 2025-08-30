# React Native Frontend Development Steering for bittersweet

---
inclusion: always
---

## Project Overview

bittersweet is a React Native mobile application focused on mindful screen time management, focus habit building, and meaningful time tracking. The app combines Focus Sessions, smart app locks, positive reinforcement features to help users take control of their digital lives.

## Core Technology Stack

### Primary Framework
- **React Native** (latest stable version)
- **TypeScript** for type safety
- **Expo SDK** for streamlined development and native capabilities
- **React Navigation v6** for navigation
- **React Native Reanimated 3** for smooth animations

### UI/Styling
- **NativeWind v4** (Tailwind CSS for React Native)
- **React Native UI Kinematics** for physics-based animations
- **Figma UI Kit Integration** - All components should match our existing Figma design system
- **React Native SVG** for vector graphics and icons

### State Management & Data
- **Zustand** for global state management
- **React Query (TanStack Query)** for server state
- **AsyncStorage** for local persistence
- **React Hook Form** for form handling
- **Zod** for schema validation

### Development Tools (MCP Integration)
- **@twodoorsdev/react-native-debugger-mcp** for debugging integration
- **expo-mcp-server** for Expo development automation
- **react-native-mcp** for comprehensive React Native tooling

## MCP Tool Usage Guidelines

USE THEM AS MUCH AS POSSIBLE

### 1. React Native Debugger MCP Integration

Always configure the React Native Debugger MCP server in development:

```json
{
  "mcpServers": {
    "react-native-debugger-mcp": {
      "command": "npx",
      "args": ["-y", "@twodoorsdev/react-native-debugger-mcp"]
    }
  }
}
```

**Usage:**
- Monitor console logs in real-time
- Track Metro bundler output
- Debug performance issues
- Capture network requests

### 2. React Native MCP Server Integration

For Expo-specific operations:

```json
{
  "mcpServers": {
    "react-native": {
      "command": "npx",
      "args": [
        "-y",
        "cali-mcp-server@latest"
      ],
      "env": {
        "FILESYSTEM_ROOT": "/Users/nozim/workplace/bittersweet"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### 3. Component Generation with MCP

When creating new components, use MCP tools to:
1. Analyze existing Figma designs
2. Generate TypeScript interfaces from Figma properties
3. Create component scaffolding with proper typing
4. Implement NativeWind styling matching Figma specs

## Project Structure

```
src/
├── app/                    # Expo Router app directory
│   ├── (tabs)/            # Tab-based navigation screens
│   │   ├── focus.tsx      # Focus Session tab
│   │   ├── journal.tsx    # Time Journal tab
│   │   ├── insights.tsx   # Insights Dashboard tab
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry point
├── components/
│   ├── ui/                # Base UI components (match Figma)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── Modal.tsx
│   ├── focus/             # Focus session components
│   │   ├── FocusTimer.tsx
│   │   ├── SessionStatus.tsx
│   │   └── TagSelector.tsx
│   ├── rewards/           # Reward system components
│   │   ├── SeedCounter.tsx
│   │   ├── UnlockModal.tsx
│   │   └── QuoteDisplay.tsx
│   ├── journal/           # Time tracking components
│       ├── CalendarView.tsx
│       ├── TimeEntry.tsx
│       └── ActivityList.tsx
├── hooks/                 # Custom React hooks
│   ├── useFocusSession.ts
│   ├── useScreenTime.ts
│   ├── useRewards.ts
├── services/             # API and external services
│   ├── api/
│   ├── notifications/
│   └── screentime/       # Native screen time APIs
├── store/                # Zustand stores
│   ├── focusStore.ts
│   ├── rewardStore.ts
│   ├── journalStore.ts
├── types/                # TypeScript type definitions
│   ├── models.ts
│   ├── api.ts
│   └── navigation.ts
├── utils/                # Utility functions
│   ├── time.ts
│   ├── validation.ts
│   └── formatting.ts
└── constants/            # App constants
    ├── colors.ts         # Must match Figma color system
    ├── typography.ts     # Must match Figma typography
    └── spacing.ts        # Must match Figma spacing
```

## Component Development Standards

### 1. Component Template

All components must follow this structure:

```tsx
import React, { FC, memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { styled } from 'nativewind';

interface ComponentNameProps {
  // Props matching Figma properties
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  onPress?: () => void;
}

const StyledView = styled(View);
const StyledText = styled(Text);
const StyledPressable = styled(Pressable);

export const ComponentName: FC<ComponentNameProps> = memo(({
  variant = 'primary',
  size = 'medium',
  onPress
}) => {
  return (
    <StyledPressable
      className={`
        ${variant === 'primary' ? 'bg-primary' : 'bg-secondary'}
        ${size === 'small' ? 'p-2' : size === 'large' ? 'p-6' : 'p-4'}
        rounded-xl active:opacity-80
      `}
      onPress={onPress}
    >
      <StyledText className="text-white font-semibold">
        Component Content
      </StyledText>
    </StyledPressable>
  );
});

ComponentName.displayName = 'ComponentName';
```

### 2. NativeWind Styling Rules

- Use Tailwind utility classes exclusively
- Define custom colors in `tailwind.config.js` matching Figma
- Use consistent spacing scale: 2, 4, 8, 12, 16, 20, 24, 32, 40, 48
- Implement responsive design using breakpoints

### 3. Animation Standards

Use React Native Reanimated for all animations:

```tsx
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

// Spring animations for user interactions
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(scale.value) }]
}));

// Timing animations for transitions
const fadeStyle = useAnimatedStyle(() => ({
  opacity: withTiming(opacity.value, { duration: 300 })
}));
```

## Feature-Specific Implementation

### Focus Session Tab

**Core Components:**
- `FocusTimer`: Circular progress timer with pause/resume
- `TagSelector`: Horizontal scrollable tag list
- `SessionReflection`: Post-session modal with accomplishment tracking
- `ManualLogEntry`: Time range picker for offline tracking

**Native Integrations:**
- Use `expo-notifications` for session reminders
- Implement `expo-task-manager` for background timer
- Use `expo-haptics` for timer feedback

### Reward System

**Implementation:**
- Store seed balance in Zustand with AsyncStorage persistence
- Calculate seed earnings based on focus duration and completion
- Implement exponential backoff for app unlock costs

**UI Components:**
- `SeedAnimation`: Particle animation when earning seeds
- `UnlockConfirmation`: Modal with seed cost and remaining balance
- `MotivationalQuote`: Animated quote display with typewriter effect

### Time Journal

**Calendar Implementation:**
- Use `react-native-calendars` with custom theme matching Figma
- Implement week/month view toggle
- Show focus session dots on calendar dates

**Data Visualization:**
- Use `react-native-svg-charts` for time distribution
- Implement gesture-based chart interactions
- Show category breakdowns with pie charts

## Performance Optimization

### 1. Component Optimization
- Use `React.memo` for all functional components
- Implement `useMemo` and `useCallback` for expensive operations
- Lazy load tabs using React.lazy()

### 2. List Performance
- Use `FlashList` instead of FlatList for large lists
- Implement `getItemLayout` for fixed-height items
- Use `keyExtractor` with stable IDs

### 3. Image Optimization
- Use `expo-image` for optimized image loading
- Implement progressive loading for avatars
- Cache images using `expo-file-system`

## Testing Standards

### Unit Testing
- Use Jest and React Native Testing Library
- Test all custom hooks independently
- Mock native modules appropriately

### Component Testing
```tsx
import { render, fireEvent } from '@testing-library/react-native';

describe('ComponentName', () => {
  it('should render with default props', () => {
    const { getByText } = render(<ComponentName />);
    expect(getByText('Expected Text')).toBeDefined();
  });

  it('should handle press events', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<ComponentName onPress={onPress} />);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

## Accessibility Standards

### Required Implementations
- All interactive elements must have `accessibilityLabel`
- Use `accessibilityRole` for semantic meaning
- Implement `accessibilityHint` for complex interactions
- Support screen readers with proper navigation order

### Example:
```tsx
<StyledPressable
  accessibilityRole="button"
  accessibilityLabel="Start focus session"
  accessibilityHint="Double tap to begin a new focus session"
  accessibilityState={{ disabled: isTimerRunning }}
>
  {/* Content */}
</StyledPressable>
```

## Native Module Integration

### Screen Time Tracking (iOS)
- Use `ScreenTime` framework via native module
- Request `Family Controls` entitlement
- Implement `DeviceActivityMonitor`

### App Usage Monitoring (Android)
- Use `UsageStatsManager` API
- Request `PACKAGE_USAGE_STATS` permission
- Implement foreground service for monitoring

### Platform-Specific Code
```tsx
import { Platform } from 'react-native';

const ScreenTimeModule = Platform.select({
  ios: () => require('./ios/ScreenTimeModule'),
  android: () => require('./android/UsageStatsModule'),
})();
```

## Error Handling

### Global Error Boundary
```tsx
import * as Sentry from '@sentry/react-native';

class ErrorBoundary extends Component {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error);
    // Log to analytics
    // Show user-friendly error screen
  }
}
```

### API Error Handling
- Implement retry logic with exponential backoff
- Show appropriate error messages to users
- Cache failed requests for later retry

## MCP Workflow Commands

### Common Development Tasks

1. **Start Development:**
   ```
   Use MCP: expoStart with iOS simulator
   Monitor with react-native-debugger-mcp
   ```

2. **Create New Component:**
   ```
   1. Analyze Figma design with MCP
   2. Generate component scaffold
   3. Implement with NativeWind styles
   4. Add to Storybook
   ```

3. **Debug Performance:**
   ```
   Use react-native-debugger-mcp for:
   - Component render tracking
   - Memory usage monitoring
   - Network request inspection
   ```

## Deployment Checklist

- [ ] All components match Figma designs
- [ ] Animations are smooth (60 FPS)
- [ ] Accessibility features implemented
- [ ] Error boundaries in place
- [ ] Analytics events tracked
- [ ] Performance metrics meet targets
- [ ] All MCP tools properly configured
- [ ] Native modules tested on both platforms

## Additional Resources

- Figma Fonts & Colors System: https://www.figma.com/design/TSLL5Ws1O1ZnEhq4v7wU8L/Pomodoro-App-iOS-UI-KIT?node-id=34-2372
- Figma Light mode UI Kit: https://www.figma.com/design/TSLL5Ws1O1ZnEhq4v7wU8L/Pomodoro-App-iOS-UI-KIT?node-id=0-1
- Figma Dark mode UI Kit: https://www.figma.com/design/TSLL5Ws1O1ZnEhq4v7wU8L/Pomodoro-App-iOS-UI-KIT?node-id=46-1961
- Figma UI Kit Components: https://www.figma.com/design/TSLL5Ws1O1ZnEhq4v7wU8L/Pomodoro-App-iOS-UI-KIT?node-id=3-2083
- MCP Server Documentation: https://modelcontextprotocol.io
- React Native Best Practices: https://reactnative.dev/docs/performance