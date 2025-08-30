# Design Document

## Overview

This design document outlines the unified Zustand state management architecture for the bittersweet React Native application. The design addresses current fragmentation issues by creating a single, type-safe, domain-separated root store with standardized patterns, comprehensive middleware integration, and optimized performance characteristics.

## Architecture

### Current State Analysis

**Existing Store Fragmentation:**
- `focusSlice.ts`: Fully implemented with complex logic, persistence, and mock data
- `homeSlice.ts`: Partially implemented with user, tasks, and daily goals management
- `tasksSlice.ts`: Implemented with mock data generation and basic CRUD operations
- `rewardsSlice.ts`, `settingsSlice.ts`: Empty placeholder stores
- `store/store.ts`: Legacy bear store example (unused)

**Identified Issues:**
1. **Data Duplication**: User data exists in both `homeSlice`
2. **Inconsistent Patterns**: Different persistence strategies and action naming conventions
3. **Type Safety Gaps**: Missing comprehensive TypeScript interfaces
4. **Cross-Store Dependencies**: Tasks and focus sessions share categories but manage them separately
5. **Middleware Inconsistency**: Only `focusSlice` uses persistence middleware

### Unified Store Architecture

```typescript
// Root Store Structure
interface RootStore {
  focus: FocusSlice;
  tasks: TasksSlice;
  rewards: RewardsSlice;
  settings: SettingsSlice;
  ui: UISlice;
}

// Store Creation Pattern
const useAppStore = create<RootStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        focus: createFocusSlice(set, get),
        tasks: createTasksSlice(set, get),
        rewards: createRewardsSlice(set, get),
        settings: createSettingsSlice(set, get),
        ui: createUISlice(set, get),
      })),
      {
        name: 'bittersweet-store',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          focus: state.focus,
          tasks: state.tasks,
          rewards: state.rewards,
          settings: state.settings,
          // UI state is not persisted
        }),
        version: 1,
        migrate: (persistedState, version) => {
          // Handle state migrations
          return persistedState;
        },
      }
    ),
    { name: 'bittersweet-store' }
  )
);
```

## Components and Interfaces

### Core Type System

```typescript
// Base Entity Types
interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

interface User extends BaseEntity {
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  stats: UserStats;
}

interface FocusSession extends BaseEntity {
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  targetDuration: number;
  categoryId: string;
  tagIds: string[];
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  seedsEarned: number;
  pauseHistory: PauseRecord[];
}

interface Task extends BaseEntity {
  title: string;
  categoryId: string;
  date: Date;
  startTime: Date;
  duration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  progress: TaskProgress;
  focusSessionIds: string[];
}

// Normalized State Structure
interface NormalizedState<T extends BaseEntity> {
  byId: Record<string, T>;
  allIds: string[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Async State Pattern
interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}
```

### Domain-Specific Store Slices

#### Focus Slice (Enhanced)
```typescript
interface FocusSlice {
  // Normalized State
  sessions: NormalizedState<FocusSession>;
  categories: NormalizedState<Category>;
  tags: NormalizedState<Tag>;
  
  // Current Session State
  currentSession: {
    session: FocusSession | null;
    isRunning: boolean;
    remainingTime: number;
    startedAt: Date | null;
  };
  
  // Settings
  settings: FocusSettings;
  
  // Statistics (Computed)
  stats: {
    totalSessions: number;
    totalFocusTime: number;
    currentStreak: number;
    longestStreak: number;
    averageSessionLength: number;
    completionRate: number;
  };
  
  // Actions
  startSession: (params: StartSessionParams) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  cancelSession: () => void;
  
  // Category/Tag Management
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  
  // Selectors
  getSessionById: (id: string) => FocusSession | undefined;
  getSessionsForDateRange: (start: Date, end: Date) => FocusSession[];
  getCategoryById: (id: string) => Category | undefined;
  getActiveSession: () => FocusSession | null;
  
  // Analytics
  getChartData: (period: TimePeriod) => ChartDataPoint[];
  getProductivityInsights: () => ProductivityInsights;
}
```

#### Tasks Slice (Enhanced)
```typescript
interface TasksSlice {
  // Normalized State
  tasks: NormalizedState<Task>;
  
  // UI State
  selectedDate: Date;
  viewMode: 'day' | 'week' | 'month';
  
  // Actions
  createTask: (task: CreateTaskParams) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => void;
  completeTask: (id: string) => void;
  
  // Selectors
  getTaskById: (id: string) => Task | undefined;
  getTasksForDate: (date: Date) => Task[];
  getActiveTask: () => Task | null;
  getTasksForDateRange: (start: Date, end: Date) => Task[];
  
  // Integration with Focus
  linkTaskToSession: (taskId: string, sessionId: string) => void;
  getTaskProgress: (id: string) => TaskProgress;
}
```

#### Rewards Slice
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
  
  // Selectors
  getBalance: () => number;
  getTransactionHistory: () => RewardTransaction[];
  getUnlockableApps: () => UnlockableApp[];
  canAfford: (amount: number) => boolean;
}
```

### Middleware Integration

#### Persistence Middleware
```typescript
const persistenceConfig = {
  name: 'bittersweet-store',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state: RootStore) => ({
    focus: {
      sessions: state.focus.sessions,
      categories: state.focus.categories,
      tags: state.focus.tags,
      settings: state.focus.settings,
    },
    tasks: {
      tasks: state.tasks.tasks,
    },
    rewards: {
      balance: state.rewards.balance,
      totalEarned: state.rewards.totalEarned,
      totalSpent: state.rewards.totalSpent,
      transactions: state.rewards.transactions,
    },
    settings: state.settings,
  }),
  version: 1,
  migrate: (persistedState: any, version: number) => {
    if (version === 0) {
      // Migrate from old store structure
      return migrateFromLegacyStore(persistedState);
    }
    return persistedState;
  },
  onRehydrateStorage: () => (state) => {
    if (state) {
      // Perform post-hydration setup
      state.ui.isHydrated = true;
    }
  },
};
```

#### DevTools Integration
```typescript
const devtoolsConfig = {
  name: 'bittersweet-store',
  enabled: __DEV__,
  serialize: {
    options: {
      date: true,
      function: true,
      undefined: true,
    },
  },
  actionSanitizer: (action: any) => ({
    ...action,
    // Sanitize sensitive data in development
    payload: action.payload,
  }),
};
```

#### Performance Monitoring Middleware
```typescript
const performanceMiddleware = (config: any) => (set: any, get: any, api: any) => {
  const originalSet = set;
  
  return config(
    (...args: any[]) => {
      const start = performance.now();
      const result = originalSet(...args);
      const end = performance.now();
      
      if (__DEV__ && end - start > 16) {
        console.warn(`Slow state update: ${end - start}ms`);
      }
      
      return result;
    },
    get,
    api
  );
};
```

## Data Models

### Normalized Data Structure

```typescript
// Entity Normalization Helper
class EntityManager<T extends BaseEntity> {
  private entities: Record<string, T> = {};
  private ids: string[] = [];
  
  add(entity: T): void {
    this.entities[entity.id] = entity;
    if (!this.ids.includes(entity.id)) {
      this.ids.push(entity.id);
    }
  }
  
  update(id: string, updates: Partial<T>): void {
    if (this.entities[id]) {
      this.entities[id] = { ...this.entities[id], ...updates, updatedAt: new Date() };
    }
  }
  
  remove(id: string): void {
    delete this.entities[id];
    this.ids = this.ids.filter(entityId => entityId !== id);
  }
  
  getById(id: string): T | undefined {
    return this.entities[id];
  }
  
  getAll(): T[] {
    return this.ids.map(id => this.entities[id]).filter(Boolean);
  }
  
  query(predicate: (entity: T) => boolean): T[] {
    return this.getAll().filter(predicate);
  }
}
```

### Cross-Store Communication

```typescript
// Event System for Cross-Store Communication
interface StoreEvent {
  type: string;
  payload: any;
  source: keyof RootStore;
  timestamp: Date;
}

class StoreEventBus {
  private listeners: Map<string, Array<(event: StoreEvent) => void>> = new Map();
  
  emit(event: StoreEvent): void {
    const handlers = this.listeners.get(event.type) || [];
    handlers.forEach(handler => handler(event));
  }
  
  on(eventType: string, handler: (event: StoreEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(eventType) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }
}

// Usage in store slices
const eventBus = new StoreEventBus();

// In focus slice - emit session completion
completeSession: () => {
  // ... session completion logic
  
  eventBus.emit({
    type: 'FOCUS_SESSION_COMPLETED',
    payload: { sessionId, seedsEarned, duration },
    source: 'focus',
    timestamp: new Date(),
  });
},

// In rewards slice - listen for session completion
useEffect(() => {
  const unsubscribe = eventBus.on('FOCUS_SESSION_COMPLETED', (event) => {
    earnSeeds(event.payload.seedsEarned, 'focus_session', {
      sessionId: event.payload.sessionId,
      duration: event.payload.duration,
    });
  });
  
  return unsubscribe;
}, []);
```

## Error Handling

### Standardized Error Patterns

```typescript
// Error Types
interface StoreError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

// Error Handling Middleware
const errorHandlingMiddleware = (config: any) => (set: any, get: any, api: any) => {
  return config(
    (partial: any, replace?: boolean) => {
      try {
        return set(partial, replace);
      } catch (error) {
        const storeError: StoreError = {
          code: 'STATE_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
          timestamp: new Date(),
          recoverable: true,
        };
        
        // Log error
        console.error('Store Error:', storeError);
        
        // Update error state
        set((state: RootStore) => ({
          ...state,
          ui: {
            ...state.ui,
            errors: [...state.ui.errors, storeError],
          },
        }));
        
        throw error;
      }
    },
    get,
    api
  );
};

// Async Action Error Handling
const createAsyncAction = <T, P>(
  actionName: string,
  asyncFn: (params: P) => Promise<T>
) => {
  return async (params: P, { set, get }: { set: any; get: any }) => {
    const stateKey = `${actionName}State`;
    
    // Set loading state
    set((state: any) => ({
      ...state,
      [stateKey]: { ...state[stateKey], loading: true, error: null },
    }));
    
    try {
      const result = await asyncFn(params);
      
      // Set success state
      set((state: any) => ({
        ...state,
        [stateKey]: {
          ...state[stateKey],
          loading: false,
          data: result,
          lastFetch: new Date(),
        },
      }));
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Set error state
      set((state: any) => ({
        ...state,
        [stateKey]: {
          ...state[stateKey],
          loading: false,
          error: errorMessage,
        },
      }));
      
      throw error;
    }
  };
};
```

## Testing Strategy

### Store Testing Utilities

```typescript
// Test Store Factory
const createTestStore = (initialState?: Partial<RootStore>) => {
  return create<RootStore>()(
    immer((set, get) => ({
      ...createDefaultState(),
      ...initialState,
      focus: createFocusSlice(set, get),
      tasks: createTasksSlice(set, get),
      rewards: createRewardsSlice(set, get),
      settings: createSettingsSlice(set, get),
      ui: createUISlice(set, get),
    }))
  );
};

// Store Test Helpers
export const storeTestHelpers = {
  // Create store with mock data
  createMockStore: (overrides?: Partial<RootStore>) => {
    return createTestStore({
      focus: {
        sessions: { byId: {}, allIds: [], loading: false, error: null },
        ...overrides?.focus,
      },
      // ... other mock data
    });
  },
  
  // Wait for async actions
  waitForAsyncAction: async (store: any, actionName: string) => {
    return new Promise((resolve) => {
      const unsubscribe = store.subscribe((state: any) => {
        if (!state[`${actionName}State`]?.loading) {
          unsubscribe();
          resolve(state[`${actionName}State`]);
        }
      });
    });
  },
  
  // Mock async functions
  mockAsyncAction: <T>(result: T, delay = 0) => {
    return jest.fn().mockImplementation(() => 
      new Promise((resolve) => setTimeout(() => resolve(result), delay))
    );
  },
};

// Example Test
describe('FocusSlice', () => {
  let store: ReturnType<typeof createTestStore>;
  
  beforeEach(() => {
    store = storeTestHelpers.createMockStore();
  });
  
  it('should start a focus session', () => {
    const { startSession } = store.getState().focus;
    
    startSession({
      targetDuration: 25,
      categoryId: 'work',
      tagIds: ['important'],
    });
    
    const { currentSession } = store.getState().focus;
    expect(currentSession.session).toBeTruthy();
    expect(currentSession.isRunning).toBe(true);
  });
  
  it('should handle session completion with rewards', async () => {
    // Start session
    store.getState().focus.startSession({
      targetDuration: 25,
      categoryId: 'work',
      tagIds: [],
    });
    
    // Complete session
    store.getState().focus.completeSession();
    
    // Check rewards were earned
    const { balance } = store.getState().rewards;
    expect(balance).toBeGreaterThan(0);
  });
});
```

## Migration Strategy

### Phase 1: Infrastructure Setup
1. Create unified store structure with middleware
2. Implement base types and interfaces
3. Set up testing utilities and patterns
4. Create migration utilities for existing data

### Phase 2: Core Domain Migration
1. Enhance focus slice with normalized structure
2. Migrate tasks slice with improved relationships
3. Implement cross-store communication patterns

### Phase 3: Feature Domain Migration
1. Implement rewards slice with transaction history
2. Enhance settings slice with comprehensive preferences
3. Implement UI slice for application state

### Phase 4: Integration and Optimization
1. Implement cross-store event system
2. Add performance monitoring and optimization
3. Create comprehensive selector patterns
4. Implement advanced caching strategies

### Phase 5: Testing and Validation
1. Create comprehensive test suite
2. Validate performance characteristics
3. Test migration from existing stores
4. Ensure backward compatibility during transition

This design provides a comprehensive, type-safe, and performant state management solution that addresses all current fragmentation issues while establishing patterns for future scalability and maintainability.