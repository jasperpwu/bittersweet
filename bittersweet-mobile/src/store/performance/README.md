# Performance Optimization Guide

## Overview

This document outlines performance optimization strategies for the bittersweet mobile app store, focusing on efficient data management and rendering optimization.

## Store Architecture

### Focus Sessions (Primary Entity)
- **Sessions**: Time-based focus periods with tags and progress tracking
- **Tags**: Labels for organizing and categorizing sessions
- **Settings**: User preferences for focus sessions

### Performance Patterns

#### 1. Normalized State Structure
```typescript
// Efficient data access
const sessions = state.focus.sessions;
const session = sessions.byId[sessionId]; // O(1) lookup
const sessionIds = sessions.allIds; // Array for iteration
```

#### 2. Selective Rendering
```typescript
// Only re-render when specific data changes
const useFocusSessions = () => useAppStore(
  (state) => state.focus.sessions
);
```

#### 3. Computed Selectors
```typescript
// Memoized selectors for expensive calculations
export const useSessionsForDate = (date: Date) => {
  return useMemo(() => {
    return selectSessionsForDate(date)(getStoreState());
  }, [date]);
};
```

## Optimization Strategies

### 1. Data Normalization
- Store entities in `byId` records for O(1) lookups
- Maintain `allIds` arrays for iteration and filtering
- Avoid nested object structures

### 2. Selective Subscriptions
- Subscribe only to the data you need
- Use shallow equality checks where possible
- Implement custom equality functions for complex objects

### 3. Memoization
- Memoize expensive calculations
- Cache selector results
- Use React.memo for expensive components

### 4. Batch Updates
- Group related state changes
- Use immer for immutable updates
- Minimize re-renders

## Performance Monitoring

### Memory Management
```typescript
// Register cleanup tasks
manager.registerCleanupTask(`${componentId}_${cleanupTasks.current.length}`, cleanup);

// Clean up on unmount
cleanupTasks.current.forEach(cleanup => cleanup());
```

### Performance Metrics
- Track render times
- Monitor memory usage
- Measure selector performance

## Best Practices

1. **Avoid Deep Nesting**: Keep state structure flat
2. **Use Selectors**: Compute derived state efficiently
3. **Batch Updates**: Group related changes
4. **Cleanup Resources**: Remove listeners and timers
5. **Monitor Performance**: Track key metrics

## Troubleshooting

### Common Issues
- **Memory Leaks**: Ensure proper cleanup in useEffect
- **Excessive Re-renders**: Check selector dependencies
- **Slow Selectors**: Memoize expensive calculations

### Performance Tools
- React DevTools Profiler
- Performance monitor
- Memory usage tracking