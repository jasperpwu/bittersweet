# Design Document

## Overview

This design document outlines the approach for creating a comprehensive file and directory structure for the bittersweet mobile application. The design focuses on establishing a feature-based architecture foundation through systematic directory creation and placeholder file generation, without modifying existing functionality.

## Architecture

### Directory Structure Design

The new structure will be created alongside the existing project structure, following the architecture overview specifications:

```
bittersweet-mobile/
├── src/                    # New source directory (to be created)
│   ├── components/         # Feature-based component organization
│   ├── services/          # External integrations and business logic
│   ├── store/             # Enhanced state management structure
│   ├── hooks/             # Custom hooks by feature domain
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── config/            # Configuration files
├── app/                   # Existing Expo Router structure (enhanced)
├── components/            # Existing components (preserved)
└── store/                 # Existing store (preserved)
```

### File Creation Strategy

1. **Non-Destructive Approach**: All existing files remain untouched
2. **Placeholder Generation**: Create minimal placeholder files with basic exports
3. **Index File Pattern**: Use index.ts files for clean import paths
4. **TypeScript Compliance**: Ensure all files have proper TypeScript structure

## Components and Interfaces

### Component Directory Structure

```
src/components/
├── ui/                    # Base design system components
│   ├── Button/
│   │   ├── Button.tsx
│   │   └── index.ts
│   ├── Card/
│   │   ├── Card.tsx
│   │   └── index.ts
│   ├── Input/
│   │   ├── Input.tsx
│   │   └── index.ts
│   ├── Modal/
│   │   ├── Modal.tsx
│   │   └── index.ts
│   └── Typography/
│       ├── Typography.tsx
│       └── index.ts
├── focus/                 # Focus session components
│   ├── CircularTimer/
│   │   ├── CircularTimer.tsx
│   │   └── index.ts
│   ├── TimerControls/
│   │   ├── TimerControls.tsx
│   │   └── index.ts
│   ├── SessionStatus/
│   │   ├── SessionStatus.tsx
│   │   └── index.ts
│   └── TagSelector/
│       ├── TagSelector.tsx
│       └── index.ts
├── rewards/               # Reward system components
│   ├── SeedCounter/
│   │   ├── SeedCounter.tsx
│   │   └── index.ts
│   ├── UnlockModal/
│   │   ├── UnlockModal.tsx
│   │   └── index.ts
│   └── QuoteDisplay/
│       ├── QuoteDisplay.tsx
│       └── index.ts
├── journal/               # Time tracking components
│   ├── CalendarView/
│   │   ├── CalendarView.tsx
│   │   └── index.ts
│   ├── TimeEntry/
│   │   ├── TimeEntry.tsx
│   │   └── index.ts
│   └── ActivityList/
│       ├── ActivityList.tsx
│       └── index.ts
├── analytics/             # Analytics components
│   ├── ProgressChart/
│   │   ├── ProgressChart.tsx
│   │   └── index.ts
│   ├── StatCard/
│   │   ├── StatCard.tsx
│   │   └── index.ts
│   └── TrendAnalysis/
│       ├── TrendAnalysis.tsx
│       └── index.ts
```

### Service Layer Structure

```
src/services/
├── api/                   # API communication layer
│   ├── client.ts          # HTTP client configuration
│   ├── focus.ts           # Focus session endpoints
│   ├── rewards.ts         # Reward system endpoints
├── storage/               # Local storage management
│   ├── secure.ts          # Secure storage for sensitive data
│   ├── cache.ts           # App cache management
│   └── offline.ts         # Offline data management
├── notifications/         # Push and local notifications
│   ├── manager.ts         # Notification manager
│   ├── scheduler.ts       # Local notification scheduling
│   └── handlers.ts        # Notification handlers
├── screentime/            # Native screen time APIs
│   ├── ios.ts             # iOS ScreenTime integration
│   ├── android.ts         # Android UsageStats integration
│   └── manager.ts         # Cross-platform manager
└── analytics/             # Analytics service
    ├── tracker.ts         # Event tracking
    └── insights.ts        # AI-powered insights
```

### State Management Structure

```
src/store/
├── slices/                # Feature-based store slices
│   ├── focusStore.ts      # Focus session state
│   ├── rewardStore.ts     # Reward system state
│   ├── journalStore.ts    # Time journal state
│   └── settingsStore.ts   # App settings state
├── middleware/            # Store middleware
│   ├── persistence.ts     # State persistence
│   └── logger.ts          # Development logging
└── index.ts               # Store configuration
```

### Custom Hooks Structure

```
src/hooks/
├── focus/                 # Focus session hooks
│   ├── useFocusSession.ts
│   ├── useTimer.ts
│   └── useSessionHistory.ts
├── rewards/               # Reward system hooks
│   ├── useRewards.ts
│   └── useSeedBalance.ts
├── journal/               # Time tracking hooks
│   ├── useTimeTracking.ts
│   └── useCalendar.ts
└── common/                # Shared hooks
    ├── useScreenTime.ts
    ├── useNotifications.ts
    └── useOfflineSync.ts
```

## Data Models

### Placeholder File Template

Each placeholder file will follow this basic structure:

```typescript
// Component placeholder
import React from 'react';
import { View } from 'react-native';

export const ComponentName = () => {
  return <View />;
};

// Service placeholder
export const ServiceName = {
  // Placeholder methods will be added during implementation
};

// Hook placeholder
export const useHookName = () => {
  // Hook logic will be implemented later
  return {};
};

// Store placeholder
import { create } from 'zustand';

export const useStoreName = create(() => ({
  // Store state will be implemented later
}));

// Type placeholder
export interface TypeName {
  // Type definitions will be added during implementation
}
```

### Enhanced App Directory Structure

```
app/
├── (tabs)/                # Enhanced tab structure
│   ├── _layout.tsx        # Existing (preserved)
│   ├── index.tsx          # Existing (preserved)
│   ├── two.tsx            # Existing (preserved)
│   ├── focus.tsx          # New focus session tab
│   ├── journal.tsx        # New time journal tab
│   ├── insights.tsx       # New insights dashboard tab
│   ├── tasks.tsx          # New task management tab
├── (modals)/              # Modal screens
│   ├── task-creation.tsx
│   ├── session-complete.tsx
│   └── category-selection.tsx
├── _layout.tsx            # Existing (preserved)
├── index.tsx              # Existing (preserved)
└── modal.tsx              # Existing (preserved)
```

## Error Handling

### File Creation Error Handling

1. **Directory Creation**: Check if directories exist before creating
2. **File Conflicts**: Avoid overwriting existing files
3. **Permission Issues**: Handle file system permission errors gracefully
4. **Path Validation**: Ensure all paths are valid and accessible

### Placeholder File Validation

1. **TypeScript Compliance**: Ensure all files have valid TypeScript syntax
2. **Import Compatibility**: Verify placeholder exports don't break existing imports
3. **Naming Conventions**: Follow consistent naming patterns throughout

## Testing Strategy

### Structure Validation

1. **Directory Existence**: Verify all required directories are created
2. **File Presence**: Confirm all placeholder files are generated
3. **Import Testing**: Test that placeholder files can be imported without errors
4. **TypeScript Compilation**: Ensure the project compiles successfully with new structure

### Integration Testing

1. **Existing Functionality**: Verify existing app functionality remains intact
2. **Navigation Testing**: Confirm existing navigation continues to work
3. **Build Testing**: Ensure the app builds successfully with new structure
4. **Development Server**: Verify development server starts without errors

## Implementation Phases

### Phase 1: Core Directory Creation
- Create main src directory structure
- Establish component, service, store, hooks, types, utils, and config directories
- Create basic index.ts files for main directories

### Phase 2: Component Structure Creation
- Create all component directories with placeholder files
- Implement index.ts files for clean imports
- Establish feature-based component organization

### Phase 3: Service Layer Creation
- Create service directories and placeholder files
- Establish API, storage, notification, screentime, and analytics services
- Create service index files for organized exports

### Phase 4: State Management Structure
- Create store slices directory with placeholder files
- Establish middleware directory structure
- Create central store configuration file

### Phase 5: Hooks and Types Creation
- Create hooks directory structure by feature domain
- Create types directory with placeholder type files
- Establish utils and config directory structures

### Phase 6: App Directory Enhancement
- Create additional tab files for new features
- Create placeholder screen files

### Phase 7: Validation and Testing
- Verify all directories and files are created correctly
- Test TypeScript compilation
- Confirm existing functionality remains intact
- Validate import paths and file structure

This design ensures a systematic approach to creating the complete file structure foundation while preserving existing functionality and establishing a scalable architecture for future development.