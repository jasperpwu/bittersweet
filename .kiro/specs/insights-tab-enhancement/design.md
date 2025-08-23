# Design Document

## Overview

The insights tab enhancement transforms the current basic analytics implementation into a comprehensive focus session analytics and history management system. The design follows the exact Figma specifications with two main views: a Statistics screen featuring data visualization and recent sessions, and a History screen providing detailed chronological session management with swipe-to-delete functionality.

## Architecture

### Component Hierarchy

```
InsightsScreen (Tab Container)
├── StatisticsView (Default)
│   ├── Header (Back, Title, Settings)
│   ├── FocusSessionsChart
│   │   ├── ChartHeader (Title, Period Selector)
│   │   ├── AreaChart (SVG-based)
│   │   └── DayLabels
│   └── RecentSessions
│       ├── SectionHeader (Date, View All)
│       └── SessionList
│           └── SessionItem[]
└── HistoryView (Navigation Target)
    ├── Header (Back, Title, Settings)
    └── SessionHistory
        ├── DateSection[]
        │   ├── DateHeader
        │   └── SessionList
        │       └── SwipeableSessionItem[]
        └── EmptyState (when no sessions)
```

### Navigation Flow

```
Insights Tab → Statistics View (Default)
                    ↓ (View All)
                History View
                    ↓ (Back Arrow)
                Statistics View
```

## Components and Interfaces

### Reusing Existing Components

The design leverages existing UI components from the established design system:

- **Card Component**: Use existing `Card` with `variant="outlined"` and `borderRadius="medium"`
- **Typography Component**: Use existing typography variants (`subtitle-16`, `body-14`, `body-12`)
- **Button Component**: Use existing button for period selectors and actions

### Core Components

#### 1. Enhanced Session Item Component (Extends existing Card)

```typescript
interface SessionItemProps {
  session: FocusSession; // Reuse existing FocusSession from focusSlice
  onDelete?: (sessionId: string) => void;
  showSwipeActions?: boolean;
  variant?: 'compact' | 'detailed';
}

// Reuse existing FocusSession interface from focusSlice.ts
// No need for new SessionItemData interface
```

**Design Specifications (Using Design System):**
- Container: Existing `Card` component with `variant="outlined"` and `padding="medium"`
- Typography: Existing `Typography` component with `variant="subtitle-16"` (title), `variant="body-14"` (category/time)
- Colors: Use existing theme colors (`colors.dark.textPrimary`, `colors.dark.textSecondary`, `colors.dark.border`)

#### 2. Focus Sessions Chart Component

```typescript
interface FocusSessionsChartProps {
  data: ChartDataPoint[];
  period: 'daily' | 'weekly' | 'monthly';
  onPeriodChange: (period: string) => void;
  height?: number;
}

interface ChartDataPoint {
  date: string;
  value: number; // focus minutes
  label: string; // day abbreviation
}
```

**Design Specifications:**
- Chart Type: Area chart with gradient fill
- Colors: Primary blue (#6592E9) with gradient to transparent
- Grid Lines: Horizontal lines with 50% opacity (#575757)
- Height: 200px
- Padding: 20px horizontal, 16px vertical

#### 3. Swipeable Session Item Component

```typescript
interface SwipeableSessionItemProps extends SessionItemProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onDelete: (sessionId: string) => void;
}
```

**Design Specifications:**
- Swipe Threshold: 60px
- Delete Button: 48px width, red background (#EF786C, 20% opacity)
- Animation: 300ms ease-out transitions
- Icon: Trash icon, 20px size

### Data Models (Reusing Existing)

#### Focus Session Model (Already Exists)

The existing `FocusSession` interface from `focusSlice.ts` will be used as-is:

```typescript
// From existing focusSlice.ts - no changes needed
interface FocusSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  targetDuration: number;
  category: string; // Will be enhanced to support category objects
  tags: string[];
  isCompleted: boolean;
  isPaused: boolean;
  pausedAt?: Date;
  totalPauseTime: number;
  seedsEarned: number;
}

// New category mapping for UI display
interface CategoryDisplay {
  name: string;
  icon: string;
  color: string;
  gradient?: string;
}

const categoryMap: Record<string, CategoryDisplay> = {
  'Education': { name: 'Education', icon: 'book', color: '#51BC6F', gradient: 'from-green-400 to-green-500' },
  'Music': { name: 'Music', icon: 'music', color: '#6592E9', gradient: 'from-blue-400 to-blue-500' },
  'Work': { name: 'Work', icon: 'briefcase', color: '#8B5CF6', gradient: 'from-purple-400 to-purple-500' },
  'Meditation': { name: 'Meditation', icon: 'lotus', color: '#FAC438', gradient: 'from-yellow-400 to-yellow-500' },
  'Code': { name: 'Code', icon: 'code', color: '#FD5B71', gradient: 'from-red-400 to-red-500' },
};
```

#### Chart Data Models

```typescript
interface ChartData {
  period: 'daily' | 'weekly' | 'monthly';
  dataPoints: ChartDataPoint[];
  totalSessions: number;
  totalFocusTime: number;
  averageSessionLength: number;
}

interface SessionStats {
  today: SessionSummary;
  thisWeek: SessionSummary;
  thisMonth: SessionSummary;
  allTime: SessionSummary;
}

interface SessionSummary {
  totalSessions: number;
  totalFocusTime: number;
  completionRate: number;
  topCategories: CategoryStats[];
}
```

## Data Flow and State Management (Zustand Integration)

### Extending Existing Focus Store

Instead of creating a new store, we'll extend the existing `useFocusStore` with insights-specific functionality:

```typescript
// Add to existing focusSlice.ts
interface InsightsState {
  // View State (local component state, not persisted)
  selectedPeriod: 'daily' | 'weekly' | 'monthly';
  
  // UI State (local component state)
  isLoading: boolean;
  error: string | null;
}

// Add to existing FocusActions interface
interface FocusActions {
  // ... existing actions
  
  // New insights-specific actions
  getSessionsForPeriod: (period: 'daily' | 'weekly' | 'monthly') => FocusSession[];
  getChartData: (period: 'daily' | 'weekly' | 'monthly') => ChartDataPoint[];
  deleteSession: (sessionId: string) => void; // Enhanced version of removeSession
  getSessionsByDate: () => Record<string, FocusSession[]>;
}
```

### Leveraging Existing Store Structure

The existing `useFocusStore` already provides:
- ✅ `sessions: FocusSession[]` - All session data
- ✅ `removeSession(sessionId: string)` - Delete functionality
- ✅ `totalFocusTime`, `totalSessions`, `currentStreak` - Statistics
- ✅ Zustand persistence with AsyncStorage

### Data Flow (Using Existing Store)

1. **Initial Load:**
   - Access `sessions` from existing `useFocusStore`
   - Process sessions using new helper functions
   - Group sessions by date for history view

2. **Chart Period Change:**
   - Use existing `sessions` array
   - Filter and process with new `getSessionsForPeriod` action
   - Update chart with smooth transition

3. **Session Deletion:**
   - Use existing `removeSession` action
   - Existing `updateStats` action recalculates statistics
   - Zustand persistence automatically saves changes
   - Animate list item removal

### Data Processing (New Helper Functions)

```typescript
// Add these as new actions to existing focusSlice.ts
export const useFocusStore = create<FocusState & FocusActions>()(
  persist(
    (set, get) => ({
      // ... existing implementation
      
      // New insights-specific actions
      getSessionsForPeriod: (period) => {
        const { sessions } = get();
        const now = new Date();
        let startDate: Date;
        
        switch (period) {
          case 'daily':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'weekly':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }
        
        return sessions.filter(session => 
          new Date(session.startTime) >= startDate
        );
      },
      
      getChartData: (period) => {
        const sessions = get().getSessionsForPeriod(period);
        const groupedSessions = groupSessionsByPeriod(sessions, period);
        return Object.entries(groupedSessions).map(([date, sessions]) => ({
          date,
          value: sessions.reduce((total, session) => total + session.duration, 0),
          label: formatDateLabel(date, period)
        }));
      },
      
      getSessionsByDate: () => {
        const { sessions } = get();
        return sessions.reduce((groups, session) => {
          const dateKey = format(session.startTime, 'yyyy-MM-dd');
          if (!groups[dateKey]) groups[dateKey] = [];
          groups[dateKey].push(session);
          return groups;
        }, {} as Record<string, FocusSession[]>);
      },
      
      deleteSession: (sessionId) => {
        // Enhanced version that also updates stats
        get().removeSession(sessionId);
        get().updateStats();
      },
    }),
    // ... existing persist config
  )
);
```

## Error Handling

### Error Scenarios and Solutions

1. **No Session Data:**
   - Display empty state with motivational message
   - Show "Start your first focus session" call-to-action
   - Hide chart and show placeholder

2. **Chart Rendering Errors:**
   - Fallback to simple bar representation
   - Show error message with retry button
   - Log error for debugging

3. **Delete Operation Failures:**
   - Revert UI changes
   - Show error toast message
   - Retry mechanism with exponential backoff

4. **Network Connectivity Issues:**
   - Show cached data with offline indicator
   - Queue operations for when connectivity returns
   - Graceful degradation of features

### Error Handling Implementation

```typescript
const handleSessionDelete = async (sessionId: string) => {
  try {
    // Optimistic update
    setOptimisticDelete(sessionId);
    
    await deleteSession(sessionId);
    
    // Confirm deletion
    confirmDelete(sessionId);
  } catch (error) {
    // Revert optimistic update
    revertDelete(sessionId);
    
    // Show error message
    showErrorToast('Failed to delete session. Please try again.');
    
    // Log error
    logError('Session deletion failed', error);
  }
};
```

## Testing Strategy

### Unit Testing

1. **Component Testing:**
   - Session item rendering with different data
   - Chart data processing and display
   - Swipe gesture handling
   - Period selector functionality

2. **Data Processing Testing:**
   - Chart data calculation accuracy
   - Session grouping logic
   - Statistics computation
   - Date formatting and localization

3. **State Management Testing:**
   - Action creators and reducers
   - Async operation handling
   - Error state management
   - Optimistic updates

### Integration Testing

1. **Navigation Testing:**
   - Statistics to History navigation
   - Back navigation functionality
   - Tab state preservation

2. **Data Flow Testing:**
   - Session creation to display pipeline
   - Delete operation end-to-end
   - Chart updates after data changes

3. **Performance Testing:**
   - Large dataset rendering
   - Smooth scrolling with many items
   - Chart animation performance

### Visual Testing

1. **Design Compliance:**
   - Pixel-perfect Figma matching
   - Color accuracy verification
   - Typography consistency
   - Spacing and layout precision

2. **Responsive Testing:**
   - Different screen sizes
   - Orientation changes
   - Dynamic type scaling

## Performance Considerations

### Optimization Strategies

1. **List Virtualization:**
   - Use FlatList with proper optimization
   - Implement getItemLayout for consistent heights
   - Use keyExtractor for stable keys

2. **Chart Performance:**
   - Debounce period changes
   - Memoize chart data calculations
   - Use React Native Reanimated for smooth animations

3. **Memory Management:**
   - Limit session history to reasonable timeframe
   - Implement pagination for large datasets
   - Clean up event listeners and timers

4. **Rendering Optimization:**
   - Use React.memo for expensive components
   - Implement useMemo for computed values
   - Optimize re-renders with useCallback

### Performance Metrics

- Initial load time: < 500ms
- Chart rendering: < 200ms
- Swipe response time: < 16ms (60fps)
- List scrolling: Maintain 60fps
- Memory usage: < 50MB for typical usage

## Accessibility Implementation

### Screen Reader Support

```typescript
// Session item accessibility
<Pressable
  accessibilityRole="button"
  accessibilityLabel={`${session.title}, ${session.category.name}, ${formatDuration(session.duration)}, ${formatTimeRange(session.startTime, session.endTime)}`}
  accessibilityHint="Double tap to view details, swipe left to delete"
  accessibilityActions={[
    { name: 'delete', label: 'Delete session' }
  ]}
  onAccessibilityAction={handleAccessibilityAction}
>
```

### Visual Accessibility

- High contrast mode support
- Dynamic type scaling
- Reduced motion preferences
- Color-blind friendly chart colors

### Interaction Accessibility

- Minimum 44px touch targets
- Clear focus indicators
- Logical tab order
- Voice control support

## Implementation Phases

### Phase 1: Core Components (Week 1)
- Enhanced SessionItem component
- Basic chart structure
- Navigation between views
- Data models and types

### Phase 2: Data Visualization (Week 2)
- SVG-based area chart implementation
- Period selector functionality
- Chart data processing
- Smooth animations

### Phase 3: Advanced Interactions (Week 3)
- Swipe-to-delete functionality
- Delete confirmations and animations
- Error handling and edge cases
- Performance optimizations

### Phase 4: Polish and Testing (Week 4)
- Accessibility implementation
- Visual polish and animations
- Comprehensive testing
- Performance tuning

This design provides a comprehensive foundation for implementing the insights tab enhancement while maintaining consistency with the existing app architecture and design system.