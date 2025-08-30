# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands
```bash
# Start development server
npm run start          # Expo development server
npm run ios            # Start iOS simulator
npm run android        # Start Android emulator
npm run web            # Start web development

# Code Quality
npm run lint           # Run ESLint on TypeScript/JavaScript files
npm run format         # Fix linting and format with Prettier

# Building
npm run prebuild       # Generate native iOS/Android projects
```

### Testing Commands
```bash
# Run tests
npm test               # Run Jest tests
npm run test:watch     # Run Jest in watch mode

# Test files follow patterns:
# **/__tests__/**/*.(ts|tsx|js)
# **/*.(test|spec).(ts|tsx|js)
```

## Architecture Overview

### Technology Stack
- **Framework**: React Native with Expo Router (file-based routing)
- **State Management**: Zustand with unified store architecture
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **UI Components**: Custom component library in `src/components/ui/`
- **Navigation**: Expo Router with stack and tab navigation
- **Persistence**: AsyncStorage with Zustand persistence middleware
- **Fonts**: Custom Poppins font family (Regular, Medium, SemiBold, Bold)

### Project Structure
```
app/                    # File-based routing (Expo Router)
  (tabs)/              # Main tab navigation
  (modals)/            # Modal screens
src/
  components/          # Reusable components organized by domain
    ui/                # Core UI components (Button, Input, Modal, etc.)
    focus/             # Focus session related components
    tasks/             # Task management components
    analytics/         # Charts and statistics components
  store/               # Unified Zustand store
    index.ts           # Main store with all slices
    unified-store.ts   # Comprehensive user management store
    slices/            # Domain-separated state slices
  hooks/               # Custom React hooks
  services/            # API and external service integrations
  utils/               # Utility functions and helpers
  types/               # TypeScript type definitions
ios/DynamicIslandModule/ # iOS Dynamic Island integration
```

## Store Architecture

### Unified Store System
The app uses a simplified Zustand-based store with:

1. **unified-store.ts**: App preferences and settings with device integration
2. **index.ts**: Domain-separated slices (focus, tasks, settings, ui)

### Key Store Patterns
```typescript
// Use selective subscriptions for performance
const { sessions, currentSession } = useFocus();
const { preferences, theme } = useAppSettings();

// Use action hooks for stable references
const { createTask, updateTask } = useTasksActions();
const { updatePreferences } = useAppSettings();
```

### State Structure
- **Normalized Data**: Entities stored as `{ byId: {}, allIds: [] }` for efficiency
- **Async States**: Loading, error, and lastUpdated tracking for API calls
- **Cross-Store Communication**: Event-based system for inter-slice communication
- **Persistence**: Selective persistence with versioning and migration support

## Component Architecture

### UI Component Library
Located in `src/components/ui/`, follows consistent patterns:
- Each component has its own directory with `Component.tsx` and `index.ts`
- TypeScript interfaces for props
- Accessibility support built-in
- NativeWind styling with theme consistency

### Component Organization
```
components/
  ui/           # Core reusable components
  focus/        # Focus timer specific components
  tasks/        # Task management components
  analytics/    # Data visualization components
  journal/      # Activity tracking components
  rewards/      # Gamification components
```

### Performance Patterns
- Use `React.memo()` for pure components
- `useMemo()` for expensive calculations
- `useCallback()` for stable event handlers
- `FlashList` instead of `ScrollView + map` for long lists

## iOS Integration

### Dynamic Island Support
- Native iOS integration for focus timer in Dynamic Island
- Live Activities for background session tracking
- Interactive controls for pause/resume without opening app
- Files located in `ios/DynamicIslandModule/`

### Requirements
- iOS 16.1+ for Dynamic Island features
- ActivityKit entitlements configured
- Background processing capabilities

## Development Guidelines

### State Management
- Always use the unified store hooks, never direct store access
- Prefer selective subscriptions over entire slice subscriptions
- Use event system for cross-domain state communication
- Implement proper loading and error states for async operations

### Component Development
- Follow existing component structure and naming conventions
- Use TypeScript interfaces for all props and state
- Implement accessibility features (labels, roles, states)
- Use NativeWind for consistent styling

### Performance Considerations
- Use FlashList for lists with many items
- Implement proper `getItemLayout` for fixed-size items
- Memoize expensive calculations and stable callbacks
- Use React DevTools Profiler to identify unnecessary re-renders

### Navigation
- Expo Router handles file-based routing automatically
- Screens organized by feature: `(tabs)`, `(modals)`
- Type-safe navigation with proper TypeScript definitions

### API Integration
- Services located in `src/services/`
- Async state management through store slices
- Proper error handling and loading states
- Mock data initialization for development

## Testing Strategy

### Test Setup
- Jest configuration in `jest.config.js`
- Setup file: `jest.setup.js`
- Module path mapping: `@/` → `src/`
- Coverage collection from `src/**/*.{ts,tsx}`

### Test Patterns
- Store testing utilities for mock stores
- Component testing with React Native Testing Library
- Async action testing with proper state validation
- Performance testing for store operations

## Build Configuration

### Key Config Files
- `babel.config.js`: React Native preset with custom configurations
- `metro.config.js`: Metro bundler configuration
- `tailwind.config.js`: NativeWind styling configuration
- `app.json`: Expo configuration with native integrations

### Environment Management
- Development mock data initialization
- Conditional feature flags based on `__DEV__`
- Platform-specific code handling (iOS/Android)

## Migration Notes

### Store Migration System
The app includes automatic migration from legacy store structures:
- Version-based persistence migrations
- Data integrity validation
- Fallback mechanisms for corrupted state
- Performance optimizations during hydration

### Component Migration
Many components have been optimized from basic implementations:
- Performance improvements with memoization
- Better accessibility support
- Consistent styling patterns
- Enhanced error handling

When working on this codebase, prioritize performance, type safety, and maintainability. The simplified store architecture focuses on core productivity features while maintaining excellent developer experience.