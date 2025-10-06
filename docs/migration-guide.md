# Store Migration Guide

This document explains how the store migration system works in the bittersweet mobile app.

## Overview

The migration system handles the conversion from the old complex normalized store structure to the new simplified array-based structure. This ensures that existing user data is preserved when updating to the new store architecture.

## Migration Process

### 1. Automatic Detection

The migration system automatically detects when migration is needed by checking for:

- Normalized structures (`byId` and `allIds` properties)
- Legacy slice names (`homeSlice`, `focusSlice`, etc.)
- Old store structure patterns

### 2. Data Conversion

The migration converts:

**Focus Slice:**
- `sessions.byId` → `sessions[]` (array)
- `categories.byId` → `categories[]` (array)
- `currentSession.session` → `currentSession` (direct object)
- Preserves timer state and settings

**Tasks Slice:**
- `tasks.byId` → `tasks[]` (array)
- Merges data from legacy `homeSlice.tasks`
- Preserves selected date and view preferences

**Rewards Slice:**
- `transactions.byId` → `transactions[]` (array)
- `unlockableApps.byId` → `unlockableApps[]` (array)
- Preserves balance and totals

### 3. Data Validation

After migration, the system validates:
- All arrays are properly formed
- Required fields are present
- Date objects are correctly converted
- Data integrity is maintained

## Migration Features

### Date Handling

The migration system ensures all date fields are converted to proper `Date` objects:

```typescript
// Before migration (string)
startTime: "2024-01-01T10:00:00Z"

// After migration (Date object)
startTime: new Date("2024-01-01T10:00:00Z")
```

### Legacy Data Preservation

The system preserves user data from legacy structures:

- Focus sessions and their history
- Categories and their settings
- Tasks and their completion status
- Reward balances and transaction history
- User preferences and settings

### Error Recovery

If migration encounters issues:

1. Validation errors are logged
2. Corrupted data is filtered out
3. Default values are used where needed
4. User data is preserved where possible

## Usage

### Automatic Migration

Migration happens automatically during store rehydration:

```typescript
// The persist middleware handles migration automatically
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Store slices
    }),
    persistConfig // Includes migration configuration
  )
);
```

### Manual Migration Testing

For testing purposes, you can manually trigger migration:

```typescript
import { migrateStore, needsMigration } from '../store/migration';

// Check if migration is needed
const needsUpdate = needsMigration(legacyState);

// Perform migration
if (needsUpdate) {
  const migratedState = migrateStore(legacyState);
}
```

### Development Testing Utilities

In development mode, you can use the built-in testing utilities:

```typescript
import { testMigration, testEdgeCases } from '../store/test-migration';

// Test migration with sample legacy data
testMigration();

// Test edge cases and error handling
testEdgeCases();
```

Or use them directly in the browser console:
```javascript
// Available in development mode
testMigration();
testEdgeCases();
```

### Validation

Validate migrated data integrity:

```typescript
import { validateMigratedData } from '../store/migration';

const validation = validateMigratedData(migratedState);
if (!validation.isValid) {
  console.warn('Migration issues:', validation.issues);
}
```

## Migration Examples

### Focus Sessions

**Before (Normalized):**
```typescript
{
  focus: {
    sessions: {
      byId: {
        "session1": {
          id: "session1",
          startTime: "2024-01-01T10:00:00Z",
          duration: 25,
          status: "completed"
        }
      },
      allIds: ["session1"]
    }
  }
}
```

**After (Simplified):**
```typescript
{
  focus: {
    sessions: [
      {
        id: "session1",
        startTime: new Date("2024-01-01T10:00:00Z"),
        duration: 25,
        status: "completed"
      }
    ]
  }
}
```

### Legacy HomeSlice

**Before:**
```typescript
{
  homeSlice: {
    tasks: [
      {
        id: "task1",
        title: "Complete project",
        date: "2024-01-01"
      }
    ]
  }
}
```

**After:**
```typescript
{
  tasks: {
    tasks: [
      {
        id: "task1",
        title: "Complete project",
        date: new Date("2024-01-01"),
        // Additional required fields added with defaults
        categoryId: "default",
        status: "scheduled",
        priority: "medium",
        // ...
      }
    ]
  }
}
```

## Troubleshooting

### Common Issues

1. **Date Conversion Errors**
   - Invalid date strings are converted to current date
   - Missing dates use creation time as fallback

2. **Missing Required Fields**
   - Default values are provided for missing fields
   - IDs are generated for items without them

3. **Validation Failures**
   - Corrupted items are filtered out
   - Default state is used as fallback
   - User data is preserved where possible

### Debugging

Enable development logging to see migration details:

```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('Migration performed:', migrationResult);
}
```

### Recovery

If migration fails completely:

1. The app falls back to default state
2. User can manually re-enter data
3. Previous data may be recoverable from device backups

## Performance

The migration system is designed to be:

- **Fast**: Processes data in single pass
- **Memory efficient**: Doesn't duplicate large objects
- **Non-blocking**: Runs during normal store hydration
- **Safe**: Validates data integrity throughout

## Future Migrations

To add new migrations:

1. Increment `MIGRATION_VERSION`
2. Add migration function to handle new changes
3. Update validation rules if needed
4. Test with various legacy data scenarios

The system supports incremental migrations, so users can update from any previous version to the latest.