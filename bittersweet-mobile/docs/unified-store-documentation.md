# Unified Store Documentation

## Overview

The bittersweet app now uses a unified Zustand store architecture that provides type-safe, performant, and maintainable state management across all features. This document serves as the complete guide for developers working with the new store system.

## Architecture

### Store Structure

```
src/store/
├── index.ts                 # Main store export and hooks
├── types.ts                 # TypeScript interfaces
├── middleware/
│   └── persistence.ts       # Optimized persistence with versioning
├── slices/
│   ├── authSlice.ts        # User authentication and profile
│   ├── focusSlice.ts       # Focus sessions and categories
│   ├── tasksSlice.ts       # Task management
│   ├── rewardsSlice.ts     # Seeds and app unlocking
│   ├── socialSlice.ts      # Squads and challenges
│   ├── settingsSlice.ts    # User preferences
│   └── uiSlice.ts          # UI state and modals
├── utils/
│   ├── entityManager.ts    # Normalized data utilities
│   ├── eventBus.ts         # Cross-store communication
│   ├── cleanup.ts          # Memory management
│   └── performance.ts      # Performance monitoring
├── hooks/
│   ├── index.ts            # Typed store hooks
│   └── optimized.ts        # Performance-optimized hooks
├── selectors/
│   └── index.ts            # Memoized selectors
├── performance/
│   ├── index.ts            # Performance middleware
│   └── README.md           # Performance guidelines
└── validation.ts           # Store validation utilities
```

## Usage Patterns

### Basic Store Access

```typescript
import { 
  useFocus, 
  useTasks, 
  useAuth, 
  useRewards,
  useFocusActions,
  useTasksActions 
} from '../store';

const MyComponent = () => {
  // State access (selective subscriptions)
  const { currentSession, isRunning } = useFocus();
  const { selectedDate, tasks } = useTasks();
  const { user, isAuthenticated } = useAuth();
  
  // Actions access (stable references)
  const { startSession, completeSession } = useFocusActions();
  const { createTask, updateTask } = useTasksActions();
  
  return (
    <View>
      {/* Component content */}
    </View>
  );
};
```

### Performance-Optimized Patterns

```typescript
import { memo, useCallback, useMemo } from 'react';
import { useCurrentSession, useIsSessionRunning } from '../store';

const OptimizedComponent = memo(() => {
  // Selective subscriptions - only re-renders when specific data changes
  const currentSession = useCurrentSession();
  const isRunning = useIsSessionRunning();
  
  // Memoized calculations
  const sessionProgress = useMemo(() => {
    if (!currentSession) return 0;
    return (currentSession.duration / currentSession.targetDuration) * 100;
  }, [currentSession]);
  
  // Stable callbacks
  const handleAction = useCallback(() => {
    // Action logic
  }, []);
  
  return <View>{/* Content */}</View>;
});
```

### Cross-Store Communication

```typescript
// In focus slice - emit event when session completes
completeSession: () => {
  // ... completion logic
  
  eventEmitter.emit(STORE_EVENTS.FOCUS_SESSION_COMPLETED, {
    sessionId: session.id,
    seedsEarned: calculateSeeds(session.duration),
    duration: session.duration,
  });
},

// In rewards slice - listen for session completion
eventListener.on(STORE_EVENTS.FOCUS_SESSION_COMPLETED, (event) => {
  const { seedsEarned, sessionId, duration } = event.payload;
  earnSeeds(seedsEarned, 'focus_session', { sessionId, duration });
});
```

## Store Slices

### Auth Slice

Manages user authentication, profile data, and session tokens.

```typescript
interface AuthSlice {
  // State
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  refreshToken: string | null;
  loginState: AsyncState<User>;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  
  // Selectors
  getUser: () => User | null;
  isLoggedIn: () => boolean;
}
```

### Focus Slice

Manages focus sessions, categories, tags, and statistics.

```typescript
interface FocusSlice {
  // Normalized State
  sessions: NormalizedState<FocusSession>;
  categories: NormalizedState<Category>;
  tags: NormalizedState<Tag>;
  
  // Current Session
  currentSession: {
    session: FocusSession | null;
    isRunning: boolean;
    remainingTime: number;
    startedAt: Date | null;
  };
  
  // Settings & Stats
  settings: FocusSettings;
  stats: FocusStats;
  
  // Actions
  startSession: (params: StartSessionParams) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  cancelSession: () => void;
}
```

### Tasks Slice

Manages task creation, scheduling, and progress tracking.

```typescript
interface TasksSlice {
  // State
  tasks: NormalizedState<Task>;
  selectedDate: Date;
  viewMode: 'day' | 'week' | 'month';
  currentWeekStart: Date;
  
  // Actions
  createTask: (task: CreateTaskParams) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => void;
  completeTask: (id: string) => void;
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: ViewMode) => void;
}
```

### Rewards Slice

Manages seed balance, transactions, and app unlocking.

```typescript
interface RewardsSlice {
  // State
  balance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: NormalizedState<RewardTransaction>;
  unlockableApps: NormalizedState<UnlockableApp>;
  
  // Actions
  earnSeeds: (amount: number, source: string, metadata?: any) => void;
  spendSeeds: (amount: number, purpose: string, metadata?: any) => void;
  unlockApp: (appId: string) => Promise<boolean>;
}
```

## Performance Features

### Selective Subscriptions

```typescript
// ❌ Bad - subscribes to entire slice
const focusData = useFocus();

// ✅ Good - subscribes only to specific data
const currentSession = useCurrentSession();
const isRunning = useIsSessionRunning();
```

### Memoized Selectors

```typescript
// Automatically memoized selectors prevent unnecessary re-renders
const getTasksForDate = useMemo(() => 
  createSelector(
    (state: RootStore) => state.tasks.tasks,
    (state: RootStore) => state.tasks.selectedDate,
    (tasks, selectedDate) => {
      return tasks.allIds
        .map(id => tasks.byId[id])
        .filter(task => isSameDay(task.date, selectedDate));
    }
  ), []
);
```

### Memory Management

The store includes automatic cleanup mechanisms:

- Old error logs (30+ days)
- Excessive transaction history (100+ items)
- Expired session data
- Unused event listeners

### Persistence Optimization

- **Selective Persistence**: Only essential data is saved
- **Batch Writes**: Multiple updates are batched
- **Versioning**: Automatic migration between versions
- **Compression**: Optional compression for large datasets

## Event System

### Available Events

```typescript
export const STORE_EVENTS = {
  // Focus Events
  FOCUS_SESSION_STARTED: 'focus_session_started',
  FOCUS_SESSION_COMPLETED: 'focus_session_completed',
  FOCUS_SESSION_CANCELLED: 'focus_session_cancelled',
  
  // Task Events
  TASK_CREATED: 'task_created',
  TASK_COMPLETED: 'task_completed',
  TASK_UPDATED: 'task_updated',
  
  // Reward Events
  SEEDS_EARNED: 'seeds_earned',
  SEEDS_SPENT: 'seeds_spent',
  APP_UNLOCKED: 'app_unlocked',
  
  // UI Events
  MODAL_OPENED: 'modal_opened',
  MODAL_CLOSED: 'modal_closed',
  ERROR_OCCURRED: 'error_occurred',
  
  // Auth Events
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  
  // Settings Events
  THEME_CHANGED: 'theme_changed',
  SETTINGS_UPDATED: 'settings_updated',
} as const;
```

### Using Events

```typescript
// Emit an event
eventEmitter.emit(STORE_EVENTS.TASK_COMPLETED, {
  taskId: task.id,
  focusTime: task.actualTime,
});

// Listen for events
eventListener.on(STORE_EVENTS.TASK_COMPLETED, (event) => {
  const { taskId, focusTime } = event.payload;
  // Handle task completion
});
```

## Testing

### Test Utilities

```typescript
import { createTestStore, storeTestHelpers } from '../store/test-utils';

describe('MyComponent', () => {
  let store: ReturnType<typeof createTestStore>;
  
  beforeEach(() => {
    store = storeTestHelpers.createMockStore({
      auth: { user: mockUser, isAuthenticated: true },
      focus: { currentSession: { session: null, isRunning: false } },
    });
  });
  
  it('should handle focus session start', async () => {
    const { startSession } = store.getState().focus;
    
    startSession({ targetDuration: 25, categoryId: 'work' });
    
    await storeTestHelpers.waitForAsyncAction(store, 'startSession');
    
    const { currentSession } = store.getState().focus;
    expect(currentSession.isRunning).toBe(true);
  });
});
```

### Validation

```typescript
import { validateStoreIntegrity, checkMigrationStatus } from '../store/validation';

// Validate store integrity
const validation = validateStoreIntegrity();
if (!validation.isValid) {
  console.error('Store validation errors:', validation.errors);
}

// Check migration status
const migration = checkMigrationStatus();
if (!migration.isComplete) {
  console.warn('Pending migrations:', migration.pendingMigrations);
}
```

## Best Practices

### Component Integration

1. **Use Selective Subscriptions**: Subscribe only to data you need
2. **Memoize Expensive Calculations**: Use useMemo for derived state
3. **Stable Action References**: Use useCallback for event handlers
4. **Component Memoization**: Use React.memo for pure components

### Performance

1. **Avoid Deep Subscriptions**: Don't subscribe to entire store slices
2. **Use FlashList**: Replace ScrollView + map with FlashList for lists
3. **Implement getItemLayout**: For fixed-size list items
4. **Batch Updates**: Group related state updates

### Error Handling

1. **Use Error Boundaries**: Catch store-related errors
2. **Validate Data**: Check data integrity after hydration
3. **Provide Fallbacks**: Handle missing or invalid data gracefully
4. **Log Errors**: Use the built-in error tracking

### Accessibility

1. **Proper Labels**: Use accessibilityLabel for interactive elements
2. **Semantic Roles**: Use accessibilityRole appropriately
3. **State Announcements**: Use accessibilityState for dynamic content
4. **Focus Management**: Handle focus properly in modals

## Migration from Legacy Stores

If you're migrating from old store patterns:

1. **Replace Direct Imports**: Use unified store hooks instead
2. **Update Component Props**: Adjust for new data structures
3. **Handle Async State**: Use the new async state patterns
4. **Test Thoroughly**: Verify all functionality works correctly

See the [Store Migration Guide](./store-migration-guide.md) for detailed migration instructions.

## Troubleshooting

### Common Issues

1. **Component Not Re-rendering**: Check if you're using selective subscriptions correctly
2. **Performance Issues**: Use React DevTools Profiler to identify unnecessary re-renders
3. **Data Not Persisting**: Check persistence configuration and storage permissions
4. **Type Errors**: Ensure you're using the correct typed hooks

### Debugging

```typescript
// Enable store debugging in development
if (__DEV__) {
  // Log all store actions
  useAppStore.subscribe((state, prevState) => {
    console.log('Store updated:', { state, prevState });
  });
  
  // Validate store integrity
  import('./validation').then(({ logValidationResults }) => {
    logValidationResults();
  });
}
```

### Performance Monitoring

```typescript
// Monitor store performance
import { initializePerformanceMonitoring } from '../store/performance';

// Initialize in app startup
initializePerformanceMonitoring();

// Check performance metrics
const metrics = getPerformanceMetrics();
console.log('Store performance:', metrics);
```

## Future Enhancements

The unified store architecture supports future enhancements:

- Real-time synchronization with backend
- Offline-first capabilities with sync queues
- Advanced caching strategies
- Machine learning integration for insights
- Multi-user collaboration features

This architecture provides a solid foundation for scaling the application while maintaining excellent performance and developer experience.