# Design Document

## Overview

This design document outlines the comprehensive transformation of the bittersweet mobile app to align perfectly with the Figma design specifications. The design focuses on creating a sophisticated, dark-themed productivity app with a focus timer, task management, and user progress tracking. The app will feature a modern UI with smooth animations, proper typography hierarchy, and intuitive navigation patterns.

## Architecture

### Component Architecture

The app will follow a modular component architecture with clear separation of concerns:

```
src/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Main tab navigation
│   │   ├── index.tsx      # Homepage (redesigned)
│   │   ├── tasks.tsx      # Tasks timeline view
│   │   ├── insights.tsx   # Statistics (future)
│   │   └── settings.tsx   # Settings screen
│   ├── (modals)/          # Modal screens
│   │   └── task-creation.tsx  # Create new task modal
│   └── _layout.tsx        # Root layout with tab navigation
├── components/
│   ├── ui/                # Base UI components
│   │   ├── StatusBar/     # Custom status bar
│   │   ├── TabBar/        # Custom tab bar
│   │   ├── Header/        # Screen headers
│   │   ├── Avatar/        # User avatar component
│   │   ├── Toggle/        # Toggle switches
│   │   ├── Slider/        # Range sliders
│   │   └── DatePicker/    # Date selection
│   ├── home/              # Homepage specific components
│   │   ├── UserProfile/   # Profile section
│   │   ├── CurrentTask/   # Active task display
│   │   ├── DailyGoals/    # Progress card
│   │   └── TasksList/     # Today's tasks list
│   ├── tasks/             # Tasks screen components
│   │   ├── DateSelector/  # Horizontal date picker
│   │   ├── Timeline/      # Timeline view
│   │   └── TaskBlock/     # Individual task blocks
│   ├── settings/          # Settings components
│   │   ├── ProfileCard/   # User profile card
│   │   ├── SettingsGroup/ # Settings sections
│   │   └── SettingsItem/  # Individual settings
│   └── forms/             # Form components
│       ├── TaskForm/      # Task creation form
│       ├── CategoryPicker/ # Category selection
│       └── TimePicker/    # Time selection
```

### State Management Architecture

Using Zustand for global state management with the following stores:

```typescript
// User Store
interface UserState {
  profile: UserProfile;
  settings: UserSettings;
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
}

// Tasks Store
interface TasksState {
  tasks: Task[];
  currentTask: Task | null;
  dailyGoals: DailyGoals;
  createTask: (task: CreateTaskInput) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => void;
  completeTask: (id: string) => void;
}

// Timer Store
interface TimerState {
  isRunning: boolean;
  remainingTime: number;
  currentSession: number;
  totalSessions: number;
  sessionType: 'focus' | 'shortBreak' | 'longBreak';
  startTimer: (duration: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
}
```

### Navigation Architecture

Using Expo Router with tab-based navigation:

```typescript
// Tab Layout Structure
const TabLayout = {
  index: 'Homepage',           // Main dashboard
  tasks: 'Tasks Timeline',     // Task management
  'task-creation': 'Modal',    // Create task (modal)
  insights: 'Statistics',      // Analytics (future)
  settings: 'Settings'         // User settings
}
```

## Components and Interfaces

### Core UI Components

#### StatusBar Component
```typescript
interface StatusBarProps {
  variant: 'light' | 'dark';
  backgroundColor?: string;
}

// Features:
// - Custom status bar with proper iOS/Android handling
// - White content on dark background
// - Proper safe area integration
```

#### TabBar Component
```typescript
interface TabBarProps {
  state: TabNavigationState;
  descriptors: TabDescriptors;
  navigation: TabNavigationHelpers;
}

// Features:
// - Custom tab bar matching Figma design
// - Active state indicators with primary color
// - Smooth animations between tabs
// - Proper icon sizing and spacing
```

#### Header Component
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
  variant?: 'default' | 'settings';
}

// Features:
// - Consistent header across screens
// - Back navigation support
// - Action buttons (settings, notifications)
// - Proper typography and spacing
```

### Homepage Components

#### UserProfile Component
```typescript
interface UserProfileProps {
  user: {
    name: string;
    avatar: string;
  };
  onNotificationPress: () => void;
}

// Features:
// - User avatar with proper sizing
// - Personalized greeting
// - Notification icon with badge support
// - Proper spacing and alignment
```

#### CurrentTask Component
```typescript
interface CurrentTaskProps {
  task: Task | null;
  onPlayPress: () => void;
  onPausePress: () => void;
}

// Features:
// - Shows active task or empty state
// - Category icon with proper colors
// - Play/pause button with animations
// - Task duration and progress
```

#### DailyGoals Component
```typescript
interface DailyGoalsProps {
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

// Features:
// - Circular progress indicator
// - Gradient background (#6592E9)
// - Progress percentage display
// - Completion status text
```

#### TasksList Component
```typescript
interface TasksListProps {
  tasks: Task[];
  onTaskPress: (taskId: string) => void;
  onViewAllPress: () => void;
}

// Features:
// - List of today's tasks
// - Category icons with colors
// - Task duration display
// - Play buttons for each task
// - "View all" link
```

### Tasks Screen Components

#### DateSelector Component
```typescript
interface DateSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  weekDates: Date[];
}

// Features:
// - Horizontal scrollable date picker
// - Current date highlighting
// - Smooth scrolling animations
// - Proper date formatting
```

#### Timeline Component
```typescript
interface TimelineProps {
  tasks: Task[];
  currentTime: Date;
  onTaskPress: (taskId: string) => void;
}

// Features:
// - Hourly timeline grid
// - Task blocks with proper positioning
// - Current time indicator
// - Category-based colors
// - Smooth scrolling
```

#### TaskBlock Component
```typescript
interface TaskBlockProps {
  task: Task;
  onPress: () => void;
  style?: ViewStyle;
}

// Features:
// - Colored background based on category
// - Task title and time range
// - Status indicator circle
// - Proper sizing and positioning
```

### Settings Components

#### ProfileCard Component
```typescript
interface ProfileCardProps {
  user: UserProfile;
  onEditPress: () => void;
}

// Features:
// - User avatar with edit button
// - Name and email display
// - Camera icon overlay
// - Proper spacing and typography
```

#### SettingsGroup Component
```typescript
interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

// Features:
// - Section title styling
// - Proper spacing between items
// - Consistent visual grouping
```

#### SettingsItem Component
```typescript
interface SettingsItemProps {
  title: string;
  type: 'toggle' | 'navigation';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
}

// Features:
// - Toggle switches with animations
// - Navigation arrows
// - Proper touch targets
// - Consistent styling
```

### Form Components

#### TaskForm Component
```typescript
interface TaskFormProps {
  onSubmit: (task: CreateTaskInput) => void;
  onCancel: () => void;
}

// Features:
// - Task name input field
// - Date and time pickers
// - Category selection grid
// - Session configuration sliders
// - Form validation
// - Submit button with loading state
```

#### CategoryPicker Component
```typescript
interface CategoryPickerProps {
  categories: Category[];
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
}

// Features:
// - Grid of category icons
// - Proper colors for each category
// - Selection state indication
// - Touch feedback animations
```

## Data Models

### User Models
```typescript
interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
}

interface UserSettings {
  notifications: boolean;
  nightMode: boolean;
  doNotDisturb: boolean;
  reminder: boolean;
  reminderRingtone: string;
}
```

### Task Models
```typescript
interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  date: Date;
  startTime: Date;
  duration: number; // in minutes
  workingSessions: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  progress: TaskProgress;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface TaskProgress {
  completedSessions: number;
  totalSessions: number;
  timeSpent: number; // in seconds
  isActive: boolean;
  currentSessionType: 'focus' | 'shortBreak' | 'longBreak';
}

interface DailyGoals {
  date: Date;
  totalTasks: number;
  completedTasks: number;
  totalTimeGoal: number; // in minutes
  completedTime: number; // in minutes
  percentage: number;
}
```

### Timer Models
```typescript
interface TimerSession {
  id: string;
  taskId: string;
  type: 'focus' | 'shortBreak' | 'longBreak';
  duration: number; // in seconds
  remainingTime: number;
  isRunning: boolean;
  isPaused: boolean;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
}
```

## Error Handling

### Error Boundaries
```typescript
// Global error boundary for React errors
class AppErrorBoundary extends Component {
  // Handle component errors gracefully
  // Show user-friendly error screens
  // Log errors for debugging
}

// Async error handling for API calls
const handleAsyncError = (error: Error) => {
  // Log error details
  // Show appropriate user message
  // Retry logic where applicable
}
```

### Validation
```typescript
// Form validation schemas using Zod
const TaskFormSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  category: z.string().min(1, 'Category is required'),
  date: z.date(),
  startTime: z.date(),
  workingSessions: z.number().min(1).max(8),
  shortBreakDuration: z.number().min(1).max(10),
  longBreakDuration: z.number().min(10).max(30),
});
```

## Testing Strategy

### Component Testing
```typescript
// Test all UI components with React Native Testing Library
describe('UserProfile Component', () => {
  it('displays user name and greeting', () => {
    // Test component rendering
    // Test user interactions
    // Test accessibility
  });
});
```

### Integration Testing
```typescript
// Test complete user flows
describe('Task Creation Flow', () => {
  it('creates a task successfully', () => {
    // Test navigation to form
    // Test form filling
    // Test submission
    // Test navigation back
  });
});
```

### Visual Testing
```typescript
// Storybook stories for visual testing
export default {
  title: 'Components/UserProfile',
  component: UserProfile,
};

export const Default = () => (
  <UserProfile user={mockUser} onNotificationPress={() => {}} />
);
```

## Performance Considerations

### Optimization Strategies
1. **Component Memoization**: Use React.memo for expensive components
2. **List Optimization**: Use FlashList for task lists and timeline
3. **Image Optimization**: Use expo-image for avatar and icons
4. **State Updates**: Batch state updates to prevent unnecessary re-renders
5. **Animation Performance**: Use React Native Reanimated for smooth 60fps animations

### Memory Management
1. **Timer Cleanup**: Properly clear intervals and timeouts
2. **Event Listeners**: Remove listeners on component unmount
3. **Image Caching**: Implement proper image caching strategy
4. **State Persistence**: Use AsyncStorage efficiently

## Accessibility Implementation

### Screen Reader Support
```typescript
// Proper accessibility labels and hints
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Start focus session"
  accessibilityHint="Double tap to begin a new focus session"
  accessibilityState={{ disabled: isTimerRunning }}
>
  {/* Button content */}
</Pressable>
```

### Color Contrast
- Ensure WCAG AA compliance for all text
- Primary text: #FFFFFF on #1B1C30 (AAA compliant)
- Secondary text: #CACACA on #1B1C30 (AA compliant)
- Button text: #FFFFFF on #6592E9 (AA compliant)

### Touch Targets
- Minimum 44px touch targets for all interactive elements
- Proper spacing between touch targets
- Clear visual feedback for interactions

## Animation and Interaction Design

### Micro-interactions
```typescript
// Button press animations
const buttonScale = useSharedValue(1);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(buttonScale.value) }],
}));

// Toggle animations
const togglePosition = useSharedValue(0);
const toggleStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: withTiming(togglePosition.value) }],
}));
```

### Screen Transitions
- Smooth navigation transitions between tabs
- Modal presentations with proper animations
- Loading states with skeleton screens
- Pull-to-refresh animations

### Progress Animations
- Circular progress with smooth updates
- Timer countdown animations
- Task completion celebrations
- Daily goals progress updates

This design provides a comprehensive foundation for implementing the Figma-aligned bittersweet mobile app with proper architecture, component structure, and user experience considerations.