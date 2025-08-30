# Mock Data Setup Guide

This setup provides a comprehensive test user with realistic data to showcase all app features during development and testing.

## Automatic Initialization

In development mode (`__DEV__ === true`), the store will automatically initialize with mock data if no user is currently authenticated.

## Manual Initialization

You can also manually load demo data:

```typescript
import { loadDemoData } from './src/store';

// Call this anywhere in your app to load demo data
const success = await loadDemoData();
if (success) {
  console.log('Demo data loaded successfully!');
}
```

## What's Included

### Demo User
- **Name**: Demo User
- **Email**: demo@bittersweet.app
- **Stats**: 45 sessions, 1125 minutes, level 5, 2250 seeds
- **Streak**: Current 7 days, longest 12 days

### Focus Categories (4)
1. **Work** (Blue, Briefcase icon)
2. **Study** (Green, Book icon)  
3. **Personal** (Orange, Person icon)
4. **Creative** (Red, Palette icon)

### Focus Tags (5)
- Deep Work, Urgent, Learning, Review, Planning

### Focus Sessions (17)
- Recent completed sessions
- Historical data spanning 2+ weeks
- Various durations (20-45 minutes)
- All categories and tags represented

### Tasks (4)
- **High Priority**: Complete project proposal (scheduled, 60 min)
- **Medium Priority**: Study React Hooks (in-progress, 60% complete)
- **Low Priority**: Plan weekend trip (completed)
- **Medium Priority**: Design new logo (scheduled for tomorrow)

### Rewards (4 transactions)
- Earned: Focus session completions, streak bonus
- Spent: App unlock (Instagram)
- Current balance: 2250 seeds

## Features Demonstrated

✅ **Authentication**: Logged in user with full profile
✅ **Focus Sessions**: Multiple completed sessions with analytics
✅ **Task Management**: Tasks in various states with progress tracking
✅ **Rewards System**: Earning and spending seeds
✅ **Categories & Tags**: Organized focus tracking
✅ **Statistics**: Streaks, totals, and performance metrics
✅ **Progress Tracking**: Task completion percentages

## Development Benefits

- **Immediate Testing**: All features work without manual data entry
- **Realistic Data**: Proper dates, realistic durations, and varied content
- **Complete Coverage**: Every major feature has sample data
- **Analytics Ready**: Enough historical data for charts and insights
- **Performance Testing**: Multiple items to test list performance

## Customization

To modify the mock data, edit:
- `src/store/mockData.ts` - Core data definitions
- `src/store/initializeMockData.ts` - Initialization logic

## Troubleshooting

### Error: "Cannot read property 'forEach' of undefined"
This error was fixed by adding proper null checks and ensuring all mock data arrays are properly defined. The initialization now includes logging to help debug any issues.

### TypeScript Errors
The mock data types have been aligned with the store's type definitions. If you encounter type errors, ensure your store types match the mock data structure.

## Environment Control

The mock data only loads in development mode (`NODE_ENV === 'development'`). For production or specific testing scenarios, you can:

1. Modify `shouldInitializeMockData()` in `initializeMockData.ts`
2. Use environment variables or flags
3. Check user authentication state
4. Add storage-based persistence flags

This ensures your production app starts clean while development is fully functional from day one!

## Testing

Run the mock data test script to verify everything is working:
```bash
node scripts/test-mock-data.js
```