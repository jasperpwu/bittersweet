# Design Document

## Overview

This design document outlines the simplification of the bittersweet mobile app's store architecture. The current implementation suffers from over-engineering with enterprise-level complexity that creates more problems than it solves. This design will replace the complex architecture with a simple, maintainable Zustand store that matches the actual requirements of a mobile focus app.

## Architecture

### Current Problems Identified

1. **Type System Inconsistencies**: 27+ TypeScript errors in focusSlice.ts due to mismatched type definitions
2. **Circular Dependencies**: unified-store.ts creates race conditions with dynamic imports
3. **Over-Engineered Persistence**: Complex partialize functions and migration systems that don't match actual store shape
4. **Unnecessary Abstraction Layers**: EntityManager, SessionTimingManager, and multiple middleware layers
5. **Complex Session Management**: 15+ static methods for simple timer logic
6. **Missing Infrastructure**: References to non-existent performance monitoring classes

### New Simplified Architecture

```
Simple Zustand Store
├── Focus Slice (simple timer logic)
├── Tasks Slice (basic task management)
├── Rewards Slice (seed tracking)
├── Settings Slice (user preferences)
└── UI Slice (app state)
```

## Components and Interfaces

### Core Store Structure

```typescript
// Simplified store interface
interface AppStore {
  focus: FocusSlice;
  tasks: TasksSlice;
  rewards: RewardsSlice;
  settings: SettingsSlice;
  ui: UISlice;
}

// Simple focus slice without over-engineering
interface FocusSlice {
  // State
  currentSession: FocusSession | null;
  sessions: FocusSession[];
  categories: Category[];
  isRunning: boolean;
  timeRemaining: number;
  
  // Actions
  startSession: (params: StartSessionParams) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  cancelSession: () => void;
}
```

### Simplified Data Models

```typescript
// Remove complex normalized structures
interface FocusSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // actual duration in minutes
  targetDuration: number; // planned duration in minutes
  categoryId: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  seedsEarned: number;
  pauseHistory: PauseRecord[];
  createdAt: Date;
  updatedAt: Date;
}

interface PauseRecord {
  startTime: Date;
  endTime: Date;
}

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Timer Management Simplification

Replace SessionTimingManager with simple timer logic:

```typescript
// Simple timer state
interface TimerState {
  startTime: Date | null;
  pausedTime: number; // total paused time in seconds
  isRunning: boolean;
  targetDuration: number; // in minutes
}

// Simple timer calculations
const calculateElapsed = (startTime: Date, pausedTime: number): number => {
  if (!startTime) return 0;
  const now = new Date();
  const elapsed = (now.getTime() - startTime.getTime()) / 1000;
  return Math.max(0, elapsed - pausedTime);
};

const calculateRemaining = (startTime: Date, targetDuration: number, pausedTime: number): number => {
  const elapsed = calculateElapsed(startTime, pausedTime);
  const target = targetDuration * 60; // convert to seconds
  return Math.max(0, target - elapsed);
};
```

## Data Models

### Simplified Store Types

```typescript
// Remove complex BaseEntity and NormalizedState
interface FocusSlice {
  currentSession: FocusSession | null;
  sessions: FocusSession[];
  categories: Category[];
  settings: FocusSettings;
  isRunning: boolean;
  timeRemaining: number;
  
  // Simple actions
  startSession: (params: StartSessionParams) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  cancelSession: () => void;
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
}

interface TasksSlice {
  tasks: Task[];
  selectedDate: Date;
  
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  setSelectedDate: (date: Date) => void;
}

interface RewardsSlice {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: RewardTransaction[];
  
  addSeeds: (amount: number, source: string) => void;
  spendSeeds: (amount: number, purpose: string) => void;
}

interface SettingsSlice {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  focus: FocusSettings;
  
  updateSettings: (updates: Partial<SettingsSlice>) => void;
}

interface UISlice {
  isHydrated: boolean;
  isLoading: boolean;
  errors: string[];
  
  setHydrated: (hydrated: boolean) => void;
  setLoading: (loading: boolean) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
}
```

## Error Handling

### Simplified Error Management

Replace complex error handling utilities with simple patterns:

```typescript
// Simple error boundary
const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundaryComponent
      onError={(error) => {
        console.error('App Error:', error);
        // Simple error reporting
      }}
    >
      {children}
    </ErrorBoundaryComponent>
  );
};

// Simple error handling in store actions
const startSession = (params: StartSessionParams) => {
  try {
    // Validate inputs
    if (!params.targetDuration || params.targetDuration <= 0) {
      throw new Error('Invalid target duration');
    }
    
    // Simple session creation
    const session: FocusSession = {
      id: generateId(),
      startTime: new Date(),
      duration: 0,
      targetDuration: params.targetDuration,
      categoryId: params.categoryId,
      status: 'active',
      seedsEarned: 0,
      pauseHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    set((state) => ({
      currentSession: session,
      sessions: [...state.sessions, session],
      isRunning: true,
      timeRemaining: params.targetDuration * 60,
    }));
    
  } catch (error) {
    console.error('Failed to start session:', error);
    // Simple error handling - don't crash the app
  }
};
```

## Testing Strategy

### Simplified Testing Approach

Remove complex test files and focus on:

1. **Component Testing**: Test React components with React Testing Library
2. **Store Testing**: Test store actions and state changes directly
3. **Integration Testing**: Test key user flows end-to-end
4. **Manual Testing**: Focus on manual testing for mobile-specific features

```typescript
// Simple store testing
describe('Focus Store', () => {
  it('should start a session', () => {
    const store = createFocusStore();
    
    store.startSession({
      targetDuration: 25,
      categoryId: 'work',
    });
    
    expect(store.currentSession).toBeTruthy();
    expect(store.isRunning).toBe(true);
  });
  
  it('should pause and resume sessions', () => {
    const store = createFocusStore();
    store.startSession({ targetDuration: 25, categoryId: 'work' });
    
    store.pauseSession();
    expect(store.isRunning).toBe(false);
    
    store.resumeSession();
    expect(store.isRunning).toBe(true);
  });
});
```

## Implementation Plan

### Phase 1: Remove Complex Infrastructure

1. Delete unnecessary utility classes:
   - `EntityManager`
   - `SessionTimingManager`
   - `SessionRestorationManager`
   - Complex middleware layers

2. Simplify type definitions:
   - Remove `BaseEntity` and `NormalizedState`
   - Create simple, direct interfaces
   - Fix type mismatches

### Phase 2: Simplify Store Slices

1. Rewrite `focusSlice.ts` with simple logic
2. Remove circular dependencies
3. Use standard Zustand patterns
4. Implement basic timer logic

### Phase 3: Simplify Persistence

1. Use standard Zustand persistence
2. Remove complex partialize functions
3. Implement simple migration if needed
4. Remove custom storage classes

### Phase 4: Clean Up

1. Remove unused test files
2. Update imports throughout codebase
3. Remove dead code
4. Update documentation

## Performance Considerations

### Simplified Performance Strategy

Instead of complex performance monitoring:

1. **Use React DevTools** for component performance
2. **Use Flipper** for React Native debugging
3. **Simple logging** for store operations
4. **Standard React Native performance practices**

```typescript
// Simple performance logging
const startSession = (params: StartSessionParams) => {
  const startTime = Date.now();
  
  try {
    // Session logic here
    
    if (__DEV__) {
      console.log(`Session started in ${Date.now() - startTime}ms`);
    }
  } catch (error) {
    console.error('Session start failed:', error);
  }
};
```

## Migration Strategy

### Safe Migration Approach

1. **Create new simplified store alongside existing one**
2. **Gradually migrate components to use new store**
3. **Test thoroughly at each step**
4. **Remove old store once migration is complete**

```typescript
// Migration helper
const migrateOldData = (oldState: any) => {
  return {
    focus: {
      currentSession: oldState.focus?.currentSession?.session || null,
      sessions: oldState.focus?.sessions?.allIds?.map(id => 
        oldState.focus.sessions.byId[id]
      ) || [],
      categories: oldState.focus?.categories?.allIds?.map(id => 
        oldState.focus.categories.byId[id]
      ) || [],
      isRunning: oldState.focus?.currentSession?.isRunning || false,
      timeRemaining: oldState.focus?.currentSession?.remainingTime || 0,
    },
    // ... other slices
  };
};
```

## Security Considerations

### Simplified Security Approach

1. **Input validation** at store action level
2. **Simple data sanitization** for user inputs
3. **Standard AsyncStorage security** for persistence
4. **Basic error handling** to prevent crashes

## Deployment Strategy

### Gradual Rollout

1. **Development testing** with simplified store
2. **Internal testing** with team members
3. **Beta testing** with small user group
4. **Production deployment** with monitoring

The key principle is to replace enterprise-level complexity with simple, maintainable code that actually works for a mobile focus app.