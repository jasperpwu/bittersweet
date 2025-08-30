# Store Performance Optimizations

This directory contains advanced performance optimizations for the unified Zustand store, addressing Requirements 3.3, 3.4, 3.5, 4.4, 4.5, 6.1, 6.2, 6.3, 6.4, 6.5, and 7.5.

## Features

### 1. Memoized Selectors (`../selectors/index.ts`)

Advanced selectors with automatic memoization to prevent unnecessary re-renders:

```typescript
// Basic selectors
export const selectFocusSessions = (state: RootStore) => state.focus.sessions;

// Computed selectors with memoization
export const selectFocusStats = (state: RootStore) => {
  const sessions = selectCompletedSessions(state);
  
  return useMemo(() => {
    // Complex calculations are memoized
    const totalSessions = sessions.length;
    const totalFocusTime = sessions.reduce((total, session) => total + session.duration, 0);
    // ... more calculations
    
    return { totalSessions, totalFocusTime, /* ... */ };
  }, [sessions]);
};

// Cross-domain selectors
export const selectDashboardData = (state: RootStore) => {
  const focusStats = selectFocusStats(state);
  const activeTask = selectActiveTask(state);
  // Combines data from multiple domains efficiently
};
```

### 2. Typed Hooks with Selective Subscriptions (`../hooks/index.ts`)

Performance-optimized hooks that only subscribe to specific parts of the store:

```typescript
// Selective subscriptions - only re-render when specific data changes
export const useCurrentSession = () => useAppStore(selectors.selectCurrentSession);

// Parameterized hooks with memoization
export const useTasksForDate = (date: Date) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectTasksForDate(date)(state),
      [date]
    )
  );
};

// Computed hooks with complex logic
export const useSessionProgress = () => {
  const currentSession = useCurrentSession();
  
  return useMemo(() => {
    if (!currentSession.session || !currentSession.isRunning) {
      return null;
    }
    
    // Complex progress calculations are memoized
    const elapsed = Date.now() - new Date(currentSession.session.startTime).getTime();
    const progress = elapsed / (currentSession.session.targetDuration * 60 * 1000);
    
    return {
      elapsed: Math.floor(elapsed / 1000),
      progress: Math.max(0, Math.min(1, progress)),
      isOvertime: progress > 1
    };
  }, [currentSession]);
};
```

### 3. Performance Monitoring (`../utils/performance.ts`)

Comprehensive performance monitoring system:

```typescript
// Performance monitoring
const monitor = PerformanceMonitor.getInstance();

// Record metrics
monitor.recordMetric('render_time', 15.5);
monitor.recordRenderTime('ComponentName', 12.3);
monitor.recordMemoryUsage();

// Get analytics
const renderStats = monitor.getRenderStats();
const memoryUsage = monitor.getCurrentMemoryUsage();

// Component performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const monitor = PerformanceMonitor.getInstance();
  // Automatically tracks render times and warns about slow renders
};
```

### 4. Memory Management (`../utils/performance.ts`)

Automatic memory management and cleanup:

```typescript
// Memory management
const manager = MemoryManager.getInstance();

// Register cleanup tasks
manager.registerCleanupTask('component_cache', () => {
  // Cleanup logic
});

// Automatic memory monitoring
manager.checkMemoryUsage(); // Triggers cleanup if threshold exceeded

// Memory management hook
export const useMemoryManagement = (componentId: string) => {
  const { registerCleanup } = useMemoryManagement(componentId);
  
  // Register cleanup functions that run when component unmounts
  registerCleanup(() => {
    // Component-specific cleanup
  });
};
```

### 5. Lazy Loading (`../utils/performance.ts`)

Efficient lazy loading system:

```typescript
// Lazy module loading
const LazyLoader = {
  async loadModule<T>(moduleId: string, loader: () => Promise<T>): Promise<T> {
    // Caches loaded modules and prevents duplicate loading
  }
};

// Lazy loading hook
export const useLazyLoad = <T>(
  moduleId: string,
  loader: () => Promise<T>,
  shouldLoad: boolean = true
) => {
  // Returns { data, loading, error, isLoaded }
};
```

### 6. State Cleanup (`../utils/cleanup.ts`)

Automatic state cleanup and optimization:

```typescript
// Entity cleanup
EntityCleanup.setConfig({
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxEntities: 1000,
  cleanupInterval: 60 * 60 * 1000, // 1 hour
  enableAutoCleanup: true
});

// Automatic cleanup of old data
const cleanedState = EntityCleanup.cleanupNormalizedState(state.focus.sessions);

// Memory optimization
const optimizedStore = MemoryOptimizer.optimizeForMemoryUsage(store);
```

### 7. Caching System (`../utils/cleanup.ts`)

Intelligent caching with TTL support:

```typescript
// Cache management
CacheManager.set('dashboard_data', data, 5 * 60 * 1000); // 5 minutes TTL
const cachedData = CacheManager.get('dashboard_data');

// Automatic cleanup of expired cache entries
CacheManager.cleanup();
```

### 8. Batch Processing (`../utils/cleanup.ts`)

Batch operations for better performance:

```typescript
// Batch processor
BatchProcessor.addToBatch('ui_updates', () => {
  // Update operation
}, 10, 100); // Batch size: 10, delay: 100ms

// Manual flush
BatchProcessor.flushBatch('ui_updates');
```

### 9. Optimized Hooks (`../hooks/optimized.ts`)

High-performance hooks for specific use cases:

```typescript
// Optimized dashboard with caching
export const useOptimizedDashboard = () => {
  usePerformanceMonitor('Dashboard');
  const { registerCleanup } = useMemoryManagement('Dashboard');
  
  const dashboardData = useAppStore(selectors.selectDashboardData);
  
  // Automatic caching and cleanup
  useEffect(() => {
    CacheManager.set('dashboard_data', dashboardData, 2 * 60 * 1000);
    registerCleanup(() => CacheManager.delete('dashboard_data'));
  }, [dashboardData, registerCleanup]);
  
  return dashboardData;
};

// Optimized tasks list with virtualization support
export const useOptimizedTasksList = (date: Date, limit: number = 50) => {
  // Returns { tasks, totalTasks, hasMore }
  // Automatically sorts and limits tasks for performance
};
```

## Performance Middleware

The store includes performance middleware that automatically monitors and optimizes performance:

```typescript
// Performance middleware integration
export const useAppStore = create<RootStore>()(
  devtools(
    createPerformanceMiddleware({
      enablePerformanceMonitoring: __DEV__,
      enableMemoryCleanup: true,
      memoryThreshold: 50 // MB
    })(
      // Store implementation
    ),
    { name: 'bittersweet-store' }
  )
);
```

## Usage Examples

### Basic Performance Optimization

```typescript
import { useOptimizedDashboard, useComponentPerformance } from '@/store/performance';

const DashboardComponent = () => {
  // Automatic performance monitoring
  useComponentPerformance('Dashboard');
  
  // Optimized data fetching with caching
  const dashboardData = useOptimizedDashboard();
  
  return (
    <View>
      {/* Dashboard content */}
    </View>
  );
};
```

### Advanced Memory Management

```typescript
import { useMemoryManagement, CacheManager } from '@/store/performance';

const DataIntensiveComponent = () => {
  const { registerCleanup } = useMemoryManagement('DataIntensive');
  
  useEffect(() => {
    // Register cleanup for component-specific data
    registerCleanup(() => {
      CacheManager.delete('component_cache');
      // Other cleanup tasks
    });
  }, [registerCleanup]);
  
  // Component logic
};
```

### Lazy Loading

```typescript
import { useLazyLoad } from '@/store/performance';

const LazyComponent = ({ shouldLoad }: { shouldLoad: boolean }) => {
  const { data, loading, error } = useLazyLoad(
    'heavy_module',
    () => import('./HeavyModule'),
    shouldLoad
  );
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage />;
  if (!data) return null;
  
  return <data.default />;
};
```

## Performance Monitoring

The system provides comprehensive performance monitoring:

- **Render Time Tracking**: Automatically tracks component render times
- **Memory Usage Monitoring**: Monitors JavaScript heap usage
- **Slow Render Warnings**: Warns about renders taking >16ms
- **Memory Threshold Alerts**: Triggers cleanup when memory usage is high
- **Performance Metrics**: Collects and analyzes performance data

## Configuration

Performance settings can be configured:

```typescript
// Cleanup configuration
EntityCleanup.setConfig({
  maxAge: 7 * 24 * 60 * 60 * 1000, // Keep data for 7 days
  maxEntities: 1000, // Maximum entities per normalized state
  cleanupInterval: 60 * 60 * 1000, // Cleanup every hour
  enableAutoCleanup: true
});

// Memory management
MemoryManager.getInstance().setMemoryThreshold(50); // 50MB threshold

// Performance monitoring
initializePerformanceMonitoring(); // Initialize all systems
```

## Testing

Comprehensive tests are included in `__tests__/performance.test.ts` covering:

- Performance monitoring functionality
- Memory management and cleanup
- Cache management with TTL
- Entity cleanup by age and count
- Batch processing
- Hook performance optimization

## Best Practices

1. **Use Selective Subscriptions**: Only subscribe to the data you need
2. **Leverage Memoization**: Use memoized selectors for computed data
3. **Register Cleanup**: Always register cleanup functions for components
4. **Monitor Performance**: Use performance monitoring hooks in development
5. **Cache Strategically**: Cache expensive computations with appropriate TTL
6. **Batch Updates**: Use batch processing for multiple related updates
7. **Lazy Load**: Only load data when needed
8. **Clean Up Regularly**: Enable automatic cleanup for old data

This performance optimization system ensures the store remains fast and memory-efficient even with large amounts of data and complex state interactions.