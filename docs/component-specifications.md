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

### 4. Focus Session Components

#### Circular Timer with Fruit Garden
```typescript
interface CircularTimerProps {
  duration: number;        // Total duration in seconds
  elapsed: number;         // Elapsed time in seconds
  isActive: boolean;       // Timer running state
  isPaused: boolean;       // Timer paused state
  color: string;          // Progress ring color
  size?: number;          // Timer diameter
  strokeWidth?: number;   // Ring thickness
  fruitCount: number;     // Number of fruits earned (1 per 5 minutes)
}
```

**Visual Specifications**:
- **Size**: 280px diameter for main timer
- **Stroke Width**: 8px for progress ring
- **Colors**: Red (#EF786C) for focus, Blue/Green for breaks
- **Animation**: Smooth progress with native driver
- **Background**: Animated fruit garden showing seeds growing into trees

#### Fruit Garden Background
```typescript
interface FruitGardenProps {
  fruitCount: number;      // Total fruits collected
  isGrowing: boolean;      // Animation state during session
  sessionProgress: number; // Current session progress (0-1)
}
```

**Visual Elements**:
- Seeds that grow into trees during focus sessions
- Fruits appear on trees (1 fruit per 5 minutes of focus)
- Smooth growth animations synchronized with timer progress
- Bottom display showing total fruits collected

#### Tag Selector with Goals
```typescript
interface TagSelectorProps {
  tags: FocusTag[];
  selectedTag?: string;
  onTagSelect: (tagId: string) => void;
  onCustomNote: (note: string) => void;
  onGoalSet: (goal: Goal) => void;
}

interface FocusTag {
  id: string;
  name: string; // Study, Read, Work, etc.
  color: string;
  customNote?: string;
  goal?: Goal; // daily, weekly, monthly
}
```

**Layout**: Horizontal scrollable tag list with custom note and goal options
**Features**: Predefined tags (Study, Read, Work) with custom notes and goal setting

#### Session Reflection Modal
```typescript
interface SessionReflectionProps {
  sessionDuration: number;
  fruitsEarned: number;
  onAccomplishmentSubmit: (accomplishment: string, completed: boolean) => void;
  onClose: () => void;
}
```

**Content**: "What did you accomplish?" with text input and ✅/❌ completion tracking
**Visual**: Celebration animation with fruits earned display

#### Manual Logger
```typescript
interface ManualLoggerProps {
  onTimeRangeSubmit: (startTime: Date, endTime: Date, category: string, name?: string) => void;
  onDurationSubmit: (duration: number, category: string, name?: string) => void;
  categories: Category[];
}
```

**Features**: 
- Time range picker for offline focus tracking
- Duration input option
- Category selection with optional custom naming
- Integration with main focus session tracking

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

### 10. AI Coach & Insights Components

#### AI Insight Card
```typescript
interface AIInsightCardProps {
  insight: AIInsight;
  onDismiss: () => void;
  onApplyTip: () => void;
}

interface AIInsight {
  id: string;
  type: 'behavioral' | 'productivity' | 'goal' | 'streak';
  title: string;
  description: string;
  actionable: boolean;
  tip?: string;           // Actionable productivity tip
  data?: InsightData;     // Supporting data visualization
}
```

**Examples**:
- "You focus best between 9–11am. Try making it a habit."
- "Your productivity increases 40% after 15-minute breaks."
- "You're 3 days away from your longest focus streak!"

**Visual**: Card with AI-generated insights and actionable tips
**Actions**: Apply tip, Dismiss, View detailed analysis

#### Goal Progress Tracker
```typescript
interface GoalProgressProps {
  goals: Goal[];
  currentProgress: GoalProgress;
  onGoalUpdate: (goalId: string, progress: number) => void;
  onGoalCreate: () => void;
}

interface Goal {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  target: number;         // Target focus minutes
  category?: string;      // Optional category filter
  deadline: Date;
  progress: number;       // Current progress
}
```

**Features**:
- Daily, weekly, monthly goal tracking
- Category-specific goals (Study, Work, Read, etc.)
- Visual progress indicators with completion celebrations
- AI-suggested goal adjustments based on performance

#### Streak Counter
```typescript
interface StreakCounterProps {
  currentStreak: number;
  longestStreak: number;
  streakType: 'daily' | 'weekly';
  onStreakDetails: () => void;
}
```

**Visual**: Fire emoji with streak number, progress toward next milestone
**Animation**: Celebration effects for streak milestones
**Features**: Daily and weekly streak tracking with historical data

#### Trend Analysis Chart
```typescript
interface TrendAnalysisProps {
  data: TrendData[];
  timeRange: 'week' | 'month' | 'year';
  metric: 'focus_time' | 'sessions' | 'productivity_score';
  onTimeRangeChange: (range: string) => void;
  insights?: string[];    // AI-generated trend insights
}
```

**Features**:
- Weekly/monthly/yearly trend visualization
- Multiple metrics: focus time, session count, productivity score
- AI-generated insights about trends and patterns
- Interactive chart with data point details

### 11. Calendar Components

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

### 11. Reward System Components

#### Fruit Counter
```typescript
interface FruitCounterProps {
  count: number;
  animated?: boolean;
  size?: 'small' | 'medium' | 'large';
  showEarningAnimation?: boolean;
}
```

**Visual**: Fruit icon with animated counter (updated from seeds)
**Animation**: Bounce effect when fruits are earned (1 fruit per 5 minutes)
**Colors**: Green/orange theme for positive reinforcement

#### App Unlock Modal
```typescript
interface AppUnlockModalProps {
  appName: string;
  appIcon: string;
  fruitCost: number;        // 1 fruit = 1 minute of access
  currentBalance: number;
  motivationalQuote: string;
  nextGoal?: string;        // Suggested next focus goal
  onConfirm: () => void;
  onCancel: () => void;
  onViewAlternatives: () => void;
}
```

**Content**: 
- Motivational productivity quote
- App icon and unlock cost (1 fruit per minute)
- Current fruit balance display
- Suggested next goal to earn more fruits
**Actions**: Confirm unlock, Cancel, View focus alternatives

#### Unlock Timer
```typescript
interface UnlockTimerProps {
  remainingTime: number;    // Seconds remaining for app access
  appName: string;
  onTimeExpired: () => void;
  showInDynamicIsland?: boolean;
}
```

**Features**:
- Dynamic Island integration for iOS
- Real-time countdown display
- Auto-block when time expires
- Background timer continuation

#### Motivational Quote Display
```typescript
interface MotivationalQuoteProps {
  quote: string;
  author?: string;
  category: 'productivity' | 'focus' | 'mindfulness';
  onDismiss?: () => void;
}
```

**Usage**: Displayed when users attempt to open blocked apps
**Content**: Inspirational quotes about productivity and focus
**Animation**: Typewriter effect or fade-in presentation

### 12. Social Components (Squads)

#### Squad Card
```typescript
interface SquadCardProps {
  squad: Squad;
  memberProgress: MemberProgress[];
  currentUserProgress: UserProgress;
  onJoin?: () => void;
  onLeave?: () => void;
  onViewDetails: () => void;
}

interface Squad {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  weeklyGoal: number;      // Weekly focus minutes goal
  currentWeekProgress: number;
  isPublic: boolean;
}
```

**Content**: Squad name, member avatars, weekly progress indicators
**Visual**: Overlapping avatar group, collective progress rings
**Features**: Accountability group management with family/friends

#### Challenge Card
```typescript
interface ChallengeCardProps {
  challenge: WeeklyChallenge;
  userProgress: number;
  squadRanking?: number;
  onJoin: () => void;
  onViewLeaderboard: () => void;
}

interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  goal: number;            // Target focus minutes
  startDate: Date;
  endDate: Date;
  participants: number;
  reward?: string;         // Trophy or badge
}
```

**Layout**: Card with challenge details and progress
**Actions**: Join challenge, View leaderboard, Share progress
**Features**: Weekly challenges similar to Duolingo streaks

#### Trophy Display
```typescript
interface TrophyDisplayProps {
  trophies: Trophy[];
  weeklyStreak: number;
  monthlyStreak: number;
  onTrophyPress: (trophy: Trophy) => void;
}

interface Trophy {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate?: Date;
  category: 'streak' | 'challenge' | 'milestone';
}
```

**Visual**: Trophy collection with streak counters
**Animation**: Celebration effects when earning new trophies
**Features**: Achievement system for motivation and gamification

#### Progress Share
```typescript
interface ProgressShareProps {
  weeklyProgress: WeeklyProgress;
  squadMembers: SquadMember[];
  onShare: (platform: 'squad' | 'social') => void;
  onEncourage: (memberId: string) => void;
}
```

**Content**: Weekly focus progress, squad member comparisons
**Actions**: Share progress, Encourage squad members
**Features**: Social accountability and positive reinforcement

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