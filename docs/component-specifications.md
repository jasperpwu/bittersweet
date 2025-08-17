# Component Specifications

## Design System Components

Based on the Figma design analysis, here are the core UI components that need to be implemented:

### 1. Typography System

```typescript
// Typography component with Figma-exact specifications
interface TypographyProps {
  variant: 
    | 'main24Semibold'     // Page titles
    | 'main20Semibold'     // Section headers
    | 'main18Semibold'     // Card titles
    | 'subtitle16Semibold' // Component headers
    | 'subtitle14Semibold' // List items
    | 'subtitle14Medium'   // Secondary headers
    | 'body14Regular'      // Primary body text
    | 'paragraph14Regular' // Long form content
    | 'body12Regular'      // Secondary body text
    | 'placeholder12Italic'// Form placeholders
    | 'tiny10Regular';     // Captions and labels
  color?: string;
  children: React.ReactNode;
}
```

### 2. Button Components

#### Primary Button
- **Usage**: Main actions (Start Session, Save, Continue)
- **Colors**: Primary (#6592E9), with gradient states
- **Typography**: subtitle16Semibold or subtitle14Semibold
- **States**: Default, Pressed, Disabled
- **Border Radius**: 12px

#### Secondary Button
- **Usage**: Secondary actions (Cancel, Skip)
- **Colors**: Border with primary color, transparent background
- **Typography**: subtitle14Medium
- **States**: Default, Pressed, Disabled

#### Icon Button
- **Usage**: Timer controls, navigation actions
- **Sizes**: Small (32px), Medium (48px), Large (64px)
- **Colors**: Primary, White, or theme-based

### 3. Card Components

#### Base Card
```typescript
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'small' | 'medium' | 'large';
  borderRadius?: number;
  children: React.ReactNode;
}
```

#### Task Card
- **Content**: Task name, category color, duration, progress
- **Actions**: Edit, Delete, Start Session
- **States**: Active, Completed, Overdue

#### Session Card
- **Content**: Session type, duration, completion status
- **Visual**: Category color indicator, progress ring
- **Actions**: View details, Restart session

### 4. Timer Components

#### Circular Timer
```typescript
interface CircularTimerProps {
  duration: number;        // Total duration in seconds
  elapsed: number;         // Elapsed time in seconds
  isActive: boolean;       // Timer running state
  isPaused: boolean;       // Timer paused state
  color: string;          // Progress ring color
  size?: number;          // Timer diameter
  strokeWidth?: number;   // Ring thickness
}
```

**Visual Specifications**:
- **Size**: 280px diameter for main timer
- **Stroke Width**: 8px for progress ring
- **Colors**: Red (#EF786C) for focus, Blue/Green for breaks
- **Animation**: Smooth progress with native driver

#### Timer Controls
```typescript
interface TimerControlsProps {
  isActive: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onReset?: () => void;
}
```

**Layout**: Horizontal button group at bottom of timer screen
**Buttons**: Play/Pause (primary), Stop (secondary), Reset (tertiary)

### 5. Input Components

#### Text Input
```typescript
interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  variant?: 'default' | 'outlined' | 'filled';
  multiline?: boolean;
  secureTextEntry?: boolean;
}
```

**Specifications**:
- **Height**: 48px for single line, auto for multiline
- **Border Radius**: 8px
- **Typography**: body14Regular for input text
- **Colors**: Border (#E1E1E1 light, #575757 dark)

#### Category Selector
```typescript
interface CategorySelectorProps {
  categories: Category[];
  selectedId?: string;
  onSelect: (categoryId: string) => void;
  variant?: 'grid' | 'horizontal' | 'dropdown';
}
```

**Visual**: 6 color-coded categories in grid or horizontal scroll
**Colors**: As defined in Figma (6 distinct category colors)

### 6. Navigation Components

#### Tab Bar
```typescript
interface TabBarProps {
  routes: TabRoute[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}
```

**Specifications**:
- **Height**: 80px with safe area
- **Background**: Theme-based background color
- **Icons**: 24px tab icons with labels
- **Active State**: Primary color with label

#### Header
```typescript
interface HeaderProps {
  title: string;
  leftAction?: {
    icon: string;
    onPress: () => void;
  };
  rightAction?: {
    icon: string;
    onPress: () => void;
  };
  variant?: 'default' | 'large' | 'minimal';
}
```

### 7. Modal Components

#### Base Modal
```typescript
interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  variant?: 'center' | 'bottom' | 'fullscreen';
}
```

#### Session Complete Modal
- **Content**: Congratulations message, session stats, next actions
- **Visual**: Celebration illustration, progress summary
- **Actions**: Continue, New Session, View Stats

#### Task Creation Modal
- **Content**: Task name input, category selection, duration picker
- **Layout**: Bottom sheet style modal
- **Actions**: Save, Cancel

### 8. Chart Components

#### Progress Chart
```typescript
interface ProgressChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'bar' | 'area';
  timeRange: 'week' | 'month' | 'year';
  color?: string;
  height?: number;
}
```

**Implementation**: React Native SVG Charts
**Interactions**: Touch to view data points
**Animation**: Smooth entry animations with native driver

#### Pie Chart
```typescript
interface PieChartProps {
  data: PieDataPoint[];
  centerText?: string;
  colors: string[];
  size?: number;
}
```

**Usage**: Category time distribution
**Visual**: Donut chart with category colors
**Labels**: Category names with percentages

### 9. List Components

#### Task List
```typescript
interface TaskListProps {
  tasks: Task[];
  onTaskPress: (task: Task) => void;
  onTaskComplete: (taskId: string) => void;
  emptyState?: React.ReactNode;
}
```

**Implementation**: FlashList for performance
**Item Height**: 72px per task item
**Actions**: Swipe actions for edit/delete

#### Session History List
```typescript
interface SessionHistoryProps {
  sessions: Session[];
  onSessionPress: (session: Session) => void;
  groupBy?: 'date' | 'category';
}
```

**Layout**: Grouped by date with section headers
**Content**: Session duration, category, completion status

### 10. Calendar Components

#### Calendar View
```typescript
interface CalendarViewProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  markedDates?: { [date: string]: MarkedDate };
  theme?: 'light' | 'dark';
}
```

**Implementation**: React Native Calendars
**Customization**: Match Figma theme colors
**Markers**: Dots for sessions, different colors for categories

### 11. Reward Components

#### Seed Counter
```typescript
interface SeedCounterProps {
  count: number;
  animated?: boolean;
  size?: 'small' | 'medium' | 'large';
}
```

**Visual**: Seed icon with animated counter
**Animation**: Bounce effect when seeds are earned
**Colors**: Green theme for positive reinforcement

#### Unlock Modal
```typescript
interface UnlockModalProps {
  appName: string;
  seedCost: number;
  currentBalance: number;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Content**: App icon, unlock cost, balance after unlock
**Actions**: Confirm unlock, Cancel, View alternatives

### 12. Social Components

#### Squad Card
```typescript
interface SquadCardProps {
  squad: Squad;
  memberProgress: MemberProgress[];
  onJoin?: () => void;
  onLeave?: () => void;
}
```

**Content**: Squad name, member avatars, progress indicators
**Visual**: Overlapping avatar group, progress rings

#### Challenge Card
```typescript
interface ChallengeCardProps {
  challenge: Challenge;
  progress: number;
  onJoin: () => void;
  onViewDetails: () => void;
}
```

**Layout**: Card with challenge details and progress
**Actions**: Join challenge, View leaderboard

## Implementation Guidelines

### 1. Component Structure
```typescript
// Standard component structure
export const ComponentName: FC<ComponentNameProps> = memo(({
  // Props with defaults
}) => {
  // Hooks and state
  // Event handlers
  // Render logic
  
  return (
    <StyledView className="component-styles">
      {/* Component content */}
    </StyledView>
  );
});

ComponentName.displayName = 'ComponentName';
```

### 2. Styling Approach
- **NativeWind v4**: Tailwind CSS classes for styling
- **Custom Colors**: Extend Tailwind config with Figma colors
- **Responsive Design**: Use breakpoint prefixes for different screen sizes
- **Dark Mode**: Automatic theme switching with `dark:` prefix

### 3. Animation Requirements
- **Native Driver**: All animations must use `useNativeDriver: true`
- **React Native Reanimated 3**: For complex animations
- **Spring Physics**: Use `withSpring` for natural interactions
- **Timing**: Use `withTiming` for controlled transitions

### 4. Accessibility
- **Screen Reader**: All interactive elements need `accessibilityLabel`
- **Semantic Roles**: Use appropriate `accessibilityRole`
- **Focus Management**: Proper focus order for navigation
- **High Contrast**: Support for high contrast mode

### 5. Testing Strategy
- **Unit Tests**: Jest + React Native Testing Library
- **Component Tests**: Test props, interactions, and accessibility
- **Snapshot Tests**: Visual regression testing
- **Performance Tests**: Measure render times and memory usage

This component specification provides the foundation for implementing a consistent, accessible, and performant UI system that matches the Figma designs exactly.