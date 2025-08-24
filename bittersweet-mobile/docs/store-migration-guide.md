# Store Migration Guide

## Overview

This guide documents the migration from fragmented Zustand stores to the unified state management architecture. The migration addresses Requirements 5.4, 7.1, 7.4, 8.1, 8.4, 8.5, 9.5, 10.4, 10.5.

## Migration Summary

### What Changed

1. **Unified Store Architecture**: All state is now managed through a single root store with domain-separated slices
2. **Optimized Persistence**: Enhanced persistence with versioning, selective storage, and performance optimizations
3. **Type Safety**: Comprehensive TypeScript interfaces throughout the state layer
4. **Performance Optimizations**: Memoized selectors, optimized hooks, and memory management
5. **Cross-Store Communication**: Event-based communication between store slices

### Before (Fragmented)
```typescript
// Multiple separate stores
import { useFocusStore } from './focusSlice';
import { useTasksStore } from './tasksSlice';
import { useHomeStore } from './homeSlice'; // Legacy

// Inconsistent patterns
const focusData = useFocusStore();
const tasksData = useTasksStore();
```

### After (Unified)
```typescript
// Single unified store with typed hooks
import { useFocus, useTasks, useAuth } from '../store';

// Consistent, optimized patterns
const focusData = useFocus();
const tasksData = useTasks();
const authData = useAuth();
```

## Migration Steps

### 1. Store Structure Migration

#### Legacy Structure (Removed)
- `store/store.ts` - Example bear store (unused)
- `src/store/slices/homeSlice.ts` - Mixed user/tasks data (migrated)

#### New Unified Structure
- `src/store/index.ts` - Main store with all slices
- `src/store/slices/` - Domain-separated slices
- `src/store/middleware/` - Persistence and performance middleware
- `src/store/utils/` - Entity management and event bus

### 2. Component Integration Updates

#### Before
```typescript
// Direct store access with potential performance issues
const Component = () => {
  const store = useStore();
  const data = store.someData; // May cause unnecessary re-renders
  
  return <View>...</View>;
};
```

#### After
```typescript
// Optimized selective subscriptions
const Component = memo(() => {
  const data = useSomeData(); // Only re-renders when data changes
  const actions = useSomeActions(); // Stable action references
  
  return <View>...</View>;
});
```

### 3. Data Structure Migration

#### Legacy Data (Auto-migrated)
```typescript
// homeSlice user data
{
  user: { id, name, email, ... },
  tasks: [...], // Array format
  dailyGoals: { ... }
}
```

#### New Normalized Structure
```typescript
// Separated into appropriate slices
auth: {
  user: { id, name, email, preferences, stats, ... }
},
tasks: {
  tasks: {
    byId: { [id]: task },
    allIds: [id1, id2, ...],
    loading: false,
    error: null
  }
}
```

## Component Migration Examples

### DateSelector Component

#### Before (Basic Implementation)
```typescript
export const DateSelector = ({ selectedDate, onDateSelect, weekDates }) => {
  return (
    <ScrollView horizontal>
      {weekDates.map((date, index) => (
        <Pressable key={index} onPress={() => onDateSelect(date)}>
          {/* Date content */}
        </Pressable>
      ))}
    </ScrollView>
  );
};
```

#### After (Optimized with Store Integration)
```typescript
export const OptimizedDateSelector = memo(() => {
  const { selectedDate, currentWeekStart } = useTasks();
  const { setSelectedDate, goToPreviousWeek, goToNextWeek } = useTasksActions();
  
  const dateItems = useMemo(() => {
    // Memoized calculations
  }, [currentWeekStart, selectedDate]);
  
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, [setSelectedDate]);
  
  return (
    <FlashList
      data={dateItems}
      renderItem={renderDateItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      horizontal
    />
  );
});
```

### Key Improvements
1. **Performance**: FlashList instead of ScrollView with map
2. **Memoization**: useMemo and useCallback for expensive operations
3. **Store Integration**: Direct connection to unified store
4. **Accessibility**: Proper accessibility labels and roles
5. **Type Safety**: Full TypeScript support

## Persistence Migration

### Automatic Data Migration

The store automatically migrates data from previous versions:

#### Version 1 Migration
- Migrates `homeSlice` user data to `auth` slice
- Converts task arrays to normalized structure
- Removes legacy slice references

#### Version 2 Migration
- Adds new computed stats fields
- Ensures all slices have proper normalized structure
- Cleans up old data formats

### Storage Optimizations

1. **Selective Persistence**: Only essential data is persisted
2. **Batch Writes**: Multiple updates are batched for performance
3. **Compression**: Optional compression for large datasets
4. **Cleanup**: Automatic cleanup of old/expired data

## Performance Improvements

### Memory Management
- Automatic cleanup of expired data
- Limited error history (max 50 items)
- Transaction history limits (max 100 items)
- Event listener cleanup on unmount

### Render Optimizations
- Memoized selectors prevent unnecessary re-renders
- Selective subscriptions for specific data
- Stable action references with useCallback
- Component memoization with React.memo

### List Performance
- FlashList instead of ScrollView + map
- Fixed item layouts for better performance
- Proper key extraction
- Estimated item sizes

## Testing Migration

### Before
```typescript
// Manual store setup for tests
const mockStore = {
  focusData: { ... },
  tasksData: { ... }
};
```

### After
```typescript
// Unified test utilities
import { createTestStore, storeTestHelpers } from '../store/test-utils';

const store = storeTestHelpers.createMockStore({
  auth: { user: mockUser },
  focus: { sessions: mockSessions }
});
```

## Breaking Changes

### Removed
- `store/store.ts` - Legacy bear store example
- `homeSlice` - Data migrated to appropriate slices
- Direct array access patterns

### Changed
- All store hooks now use unified patterns
- Component props may need updates for new data structures
- Event handling patterns updated for cross-store communication

## Validation Checklist

After migration, verify:

- [ ] All components render without errors
- [ ] Data persists correctly between app restarts
- [ ] Performance is improved (no unnecessary re-renders)
- [ ] All user data is preserved
- [ ] Cross-store communication works (focus sessions → rewards)
- [ ] Error handling works properly
- [ ] Accessibility features are maintained
- [ ] Tests pass with new store structure

## Rollback Plan

If issues occur:

1. **Data Recovery**: Previous data is preserved during migration
2. **Version Rollback**: Storage version can be reverted
3. **Component Fallbacks**: Components have fallback states for missing data
4. **Error Boundaries**: Global error boundaries catch store-related errors

## Performance Monitoring

Monitor these metrics after migration:

- **Memory Usage**: Should be lower due to cleanup mechanisms
- **Render Count**: Should be reduced due to selective subscriptions
- **Storage Performance**: Should be faster due to batch writes
- **App Startup**: Should be similar or faster due to optimized hydration

## Support

For issues during migration:

1. Check browser/debugger console for migration logs
2. Verify data integrity with store validation utilities
3. Use performance monitoring tools to identify bottlenecks
4. Refer to component examples in this guide

## Future Considerations

The unified store architecture supports:

- Easy addition of new feature slices
- Scalable cross-store communication
- Advanced caching strategies
- Real-time data synchronization
- Offline-first capabilities

This migration establishes a solid foundation for future feature development while maintaining excellent performance and developer experience.