# bittersweet Mobile App - Architecture Overview

## Project Structure

Based on the design document analysis and React Native best practices, here's the recommended architecture for the bittersweet mobile application:

```
src/
├── app/                    # Expo Router app directory (New Architecture)
│   ├── (tabs)/            # Tab-based navigation screens
│   │   ├── focus.tsx      # Focus Session tab with timer and settings
│   │   ├── journal.tsx    # Time Journal tab with calendar
│   │   ├── insights.tsx   # Insights Dashboard & AI Coach tab
│   │   └── profile.tsx    # Profile, Settings & Premium tab
│   ├── (modals)/          # Modal screens
│   │   ├── session-reflection.tsx
│   │   ├── app-unlock.tsx
│   │   ├── manual-logging.tsx
│   │   └── tag-configuration.tsx
│   ├── _layout.tsx        # Root layout with providers
│   └── index.tsx          # Entry point
├── components/
│   ├── ui/                # Base UI components (Design System)
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   ├── Card/
│   │   ├── Input/
│   │   ├── Modal/
│   │   └── Typography/
│   ├── focus/             # Focus session components
│   │   ├── CircularTimer/
│   │   ├── FruitGarden/   # Background animation with growing trees
│   │   ├── TagSelector/   # Tag selection with custom notes/goals
│   │   ├── SessionReflection/
│   │   └── ManualLogger/
│   ├── rewards/           # Reward system components
│   │   ├── FruitCounter/  # Updated from SeedCounter
│   │   ├── AppUnlockModal/
│   │   ├── UnlockTimer/   # Dynamic Island integration
│   │   └── MotivationalQuote/
│   ├── journal/           # Time tracking components
│   │   ├── CalendarView/
│   │   ├── TimeEntry/
│   │   ├── ActivityList/
│   │   └── ProgressRing/
│   ├── insights/          # Analytics & AI Coach components
│       ├── InsightCard/   # AI-powered insights
│       ├── TrendChart/
│       ├── StreakCounter/
│       └── GoalProgress/
│   
├── services/
│   ├── api/               # API layer
│   │   ├── client.ts      # HTTP client configuration
│   │   ├── focus.ts       # Focus session endpoints
│   │   ├── rewards.ts     # Fruit-based reward system endpoints
│   │   └── insights.ts    # AI coach and analytics endpoints
│   ├── storage/           # Local storage
│   │   ├── secure.ts      # Secure storage (tokens, sensitive data)
│   │   ├── cache.ts       # App cache management
│   │   └── offline.ts     # Offline data management
│   ├── notifications/     # Push notifications
│   │   ├── manager.ts     # Notification manager
│   │   ├── scheduler.ts   # Local notification scheduling
│   │   └── handlers.ts    # Notification handlers
│   ├── screentime/        # Native screen time APIs
│   │   ├── ios.ts         # iOS ScreenTime integration
│   │   ├── android.ts     # Android UsageStats integration
│   │   ├── blocker.ts     # App blocking service
│   │   └── manager.ts     # Cross-platform manager
│   ├── analytics/         # Analytics service
│   │   ├── tracker.ts     # Event tracking
│   │   ├── insights.ts    # AI-powered behavioral insights
│   │   └── coach.ts       # AI time management coach
│   └── background/        # Background services
│       ├── timer.ts       # Background timer management
│       └── dynamicIsland.ts # Dynamic Island integration
├── store/                 # State management (Zustand)
│   ├── slices/
│   │   ├── focusStore.ts  # Focus session state with tags and goals
│   │   ├── rewardStore.ts # Fruit-based reward system state
│   │   ├── journalStore.ts# Time journal and calendar state
│   │   ├── insightsStore.ts# AI coach and analytics state
│   │   ├── blockerStore.ts# App blocking and unlock state
│   │   └── settingsStore.ts# App settings and preferences state
│   ├── middleware/
│   │   ├── persistence.ts # State persistence
│   │   └── logger.ts      # Development logging
│   └── index.ts           # Store configuration
├── hooks/                 # Custom React hooks
│   ├── focus/
│   │   ├── useFocusSession.ts
│   │   ├── useTimer.ts
│   │   ├── useTagManagement.ts
│   │   ├── useManualLogging.ts
│   │   └── useSessionHistory.ts
│   ├── rewards/
│   │   ├── useRewards.ts
│   │   ├── useFruitBalance.ts
│   │   ├── useAppBlocking.ts
│   │   └── useUnlockTimer.ts
│   ├── journal/
│   │   ├── useTimeTracking.ts
│   │   ├── useCalendar.ts
│   │   └── useActivityLogging.ts
│   ├── insights/
│   │   ├── useAICoach.ts
│   │   ├── useAnalytics.ts
│   │   └── useGoalTracking.ts
│   └── common/
│       ├── useScreenTime.ts
│       ├── useNotifications.ts
│       ├── useDynamicIsland.ts
│       └── useOfflineSync.ts
├── utils/                 # Utility functions
│   ├── time.ts           # Time formatting and calculations
│   ├── validation.ts     # Form validation schemas (Zod)
│   ├── formatting.ts     # Data formatting utilities
│   ├── permissions.ts    # Permission handling
│   └── constants.ts      # App constants
├── types/                # TypeScript type definitions
│   ├── api.ts           # API response types
│   ├── models.ts        # Data models
│   ├── navigation.ts    # Navigation types
│   └── store.ts         # Store types
├── config/              # App configuration
│   ├── theme.ts         # Theme configuration (colors, typography)
│   ├── env.ts           # Environment variables
│   └── constants.ts     # App-wide constants
└── assets/              # Static assets
    ├── fonts/           # Custom fonts (Poppins family)
    ├── images/          # Image assets
    └── icons/           # Icon assets
```

## Architecture Principles

### 1. Feature-Based Organization
- Components are organized by feature domain
- Each feature has its own components, hooks, and services
- Shared components live in the `ui/` directory

### 2. Separation of Concerns
- **Presentation Layer**: React components and screens
- **Business Logic**: Custom hooks and services
- **Data Layer**: Zustand stores and API services
- **Platform Layer**: Native integrations and device APIs

### 3. State Management Strategy
- **Zustand**: Global application state
- **React Query**: Server state and caching
- **React Hook Form**: Form state management
- **AsyncStorage**: Persistent local storage

### 4. Type Safety
- Full TypeScript implementation
- Strict type checking enabled
- Zod schemas for runtime validation
- Generated types from API schemas

### 5. Performance Optimization
- React.memo for component optimization
- FlashList for efficient list rendering
- Native driver for all animations
- Code splitting with React.lazy()

## Key Design Patterns

### 1. Custom Hooks Pattern
Each feature domain has dedicated hooks that encapsulate business logic:
```typescript
// Example: useFocusSession hook
export const useFocusSession = () => {
  const { startSession, pauseSession, completeSession } = useFocusStore();
  const { addSeeds } = useRewardStore();
  
  const handleSessionComplete = useCallback((duration: number) => {
    completeSession();
    addSeeds(calculateSeeds(duration));
  }, [completeSession, addSeeds]);
  
  return { handleSessionComplete };
};
```

### 2. Service Layer Pattern
Services handle external integrations and complex business logic:
```typescript
// Example: ScreenTimeService
export class ScreenTimeService {
  static async getUsageData(): Promise<UsageData> {
    if (Platform.OS === 'ios') {
      return IOSScreenTimeService.getUsage();
    }
    return AndroidUsageStatsService.getUsage();
  }
}
```

### 3. Repository Pattern
API services act as repositories for data access:
```typescript
// Example: FocusRepository
export class FocusRepository {
  static async createSession(session: CreateSessionRequest): Promise<Session> {
    return apiClient.post('/sessions', session);
  }
  
  static async getSessionHistory(): Promise<Session[]> {
    return apiClient.get('/sessions');
  }
}
```

## Technology Stack

### Core Framework
- **React Native 0.74+** with New Architecture
- **Expo SDK 52+** for streamlined development
- **TypeScript** for type safety

### Navigation
- **Expo Router** (file-based routing)
- **React Navigation v6** for complex navigation patterns

### State Management
- **Zustand** for global state
- **React Query (TanStack Query)** for server state
- **React Hook Form** for form management

### UI & Styling
- **NativeWind v4** (Tailwind CSS for React Native)
- **React Native Reanimated 3** for animations
- **React Native SVG** for vector graphics

### Development Tools
- **React Native Debugger MCP** for debugging
- **Expo MCP Server** for development automation
- **React Native Guide MCP** for best practices

### Testing
- **Jest** for unit testing
- **React Native Testing Library** for component testing
- **Detox** for E2E testing (future implementation)

### Analytics & Monitoring
- **Sentry** for error tracking
- **Analytics service** for user behavior tracking
- **Performance monitoring** for app optimization

## Next Steps

1. **Setup Development Environment**
   - Configure Expo development build
   - Setup MCP servers for development automation
   - Configure TypeScript and ESLint

2. **Implement Core Architecture**
   - Create base store structure with Zustand
   - Implement navigation structure

3. **Develop Design System**
   - Create base UI components matching Figma designs
   - Implement theme system with NativeWind
   - Setup typography and color systems

4. **Feature Implementation Priority**
   - Focus session timer with fruit garden animation
   - Tag management and manual logging
   - Fruit-based reward system with app blocking
   - Time journal and calendar integration
   - AI coach and insights dashboard
   - Dynamic Island integration (iOS)

This architecture provides a solid foundation for building a scalable, maintainable React Native application that can grow with the product requirements.