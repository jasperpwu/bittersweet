# Technical Requirements & Implementation Guide

## Core Technology Stack

### Framework & Runtime
- **React Native 0.74+** with New Architecture enabled
- **Expo SDK 52+** for streamlined development and New Architecture by default
- **TypeScript 5.0+** with strict mode enabled
- **Node.js 18+** for development environment

### Key Feature Requirements
- **Focus Sessions**: Circular timer with fruit-growing background animation
- **Smart App Blocking**: Native iOS ScreenTime and Android UsageStats integration
- **Fruit Reward System**: 1 fruit per 5 minutes of focus, 1 fruit = 1 minute app access
- **AI Coach**: Behavioral insights and personalized productivity tips
- **Social Squads**: Accountability groups with weekly challenges and progress sharing
- **Dynamic Island**: iOS integration for active session and unlock timer display

### Navigation & Routing
- **Expo Router** (file-based routing system)
- **React Navigation v6** for complex navigation patterns
- **Deep linking** support for external integrations

### State Management
- **Zustand 4.0+** for global state management
- **React Query (TanStack Query) v5** for server state and caching
- **React Hook Form** for form state management
- **AsyncStorage** for local data persistence

### UI & Styling
- **NativeWind v4** (Tailwind CSS for React Native)
- **React Native Reanimated 3** for high-performance animations
- **React Native SVG** for vector graphics and icons
- **React Native UI Kinematics** for physics-based animations

### Development Tools
- **React Native Debugger MCP** for debugging integration
- **Expo MCP Server** for development automation
- **React Native Guide MCP** for best practices enforcement

## Performance Requirements

### Critical Performance Standards

#### 1. List Rendering (MANDATORY)
```typescript
// NEVER use FlatList - Always use FlashList
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={({ item, index }) => <OptimizedItem item={item} />}
  estimatedItemSize={80} // CRITICAL for performance
  keyExtractor={(item) => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  windowSize={10}
/>
```

#### 2. Animation Performance (MANDATORY Native Driver)
```typescript
// All animations MUST use native driver
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

// Correct implementation
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(scale.value) }]
}));

// For legacy Animated API - MANDATORY useNativeDriver
Animated.timing(animValue, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true, // MANDATORY
}).start();
```

#### 3. Image Optimization
```typescript
// Use transform instead of width/height for animations
// DON'T do this - causes UI thread drops
<Animated.Image style={{ width: animatedWidth }} />

// DO this - uses native driver
<Animated.Image style={{ transform: [{ scale: animatedScale }] }} />
```

#### 4. Touch Responsiveness
```typescript
// Wrap expensive operations in requestAnimationFrame
function handleOnPress() {
  requestAnimationFrame(() => {
    performExpensiveOperation();
  });
}
```

### Performance Testing Requirements

**CRITICAL**: Always test performance in release builds, never in development mode.

```bash
# Build release version for testing
expo build:ios --release-channel production-test
expo build:android --release-channel production-test
```

Development mode causes significant performance degradation and should never be used for performance evaluation.

## Native Integration Requirements

### Screen Time Tracking & App Blocking

#### iOS Implementation with Smart Blocking
```typescript
// iOS ScreenTime framework integration with fruit-based unlocking
import { ScreenTime } from './native-modules/ScreenTime';

class IOSScreenTimeService {
  static async requestAuthorization(): Promise<boolean> {
    return ScreenTime.requestAuthorization();
  }
  
  static async getUsageData(startDate: Date, endDate: Date): Promise<UsageData> {
    return ScreenTime.getUsageData(startDate, endDate);
  }
  
  static async setAppLimits(limits: AppLimit[]): Promise<void> {
    return ScreenTime.setAppLimits(limits);
  }
  
  static async blockApp(bundleId: string): Promise<void> {
    return ScreenTime.blockApplication(bundleId);
  }
  
  static async unlockAppWithTimer(bundleId: string, durationMinutes: number): Promise<void> {
    return ScreenTime.unlockApplicationWithTimer(bundleId, durationMinutes);
  }
  
  static async showUnlockModal(bundleId: string, fruitCost: number): Promise<boolean> {
    return ScreenTime.showCustomUnlockModal(bundleId, fruitCost);
  }
}
```

**Required Entitlements**:
- `com.apple.developer.family-controls`
- `com.apple.developer.deviceactivity`
- `com.apple.developer.deviceactivity.reporting`

#### Android Implementation with App Blocking
```typescript
// Android UsageStatsManager integration with overlay blocking
import { UsageStats } from './native-modules/UsageStats';

class AndroidUsageStatsService {
  static async requestPermission(): Promise<boolean> {
    return UsageStats.requestUsageStatsPermission();
  }
  
  static async getUsageData(startTime: number, endTime: number): Promise<UsageData> {
    return UsageStats.queryUsageStats(startTime, endTime);
  }
  
  static async getAppUsageEvents(): Promise<UsageEvent[]> {
    return UsageStats.queryEvents();
  }
  
  static async blockApp(packageName: string): Promise<void> {
    return UsageStats.createAppBlockOverlay(packageName);
  }
  
  static async unlockAppWithTimer(packageName: string, durationMinutes: number): Promise<void> {
    return UsageStats.unlockAppWithTimer(packageName, durationMinutes);
  }
  
  static async showUnlockModal(packageName: string, fruitCost: number): Promise<boolean> {
    return UsageStats.showCustomUnlockModal(packageName, fruitCost);
  }
}
```

**Required Permissions**:
- `android.permission.PACKAGE_USAGE_STATS`
- `android.permission.SYSTEM_ALERT_WINDOW` (for app blocking overlays)
- `android.permission.BIND_ACCESSIBILITY_SERVICE` (for app detection)
- `android.permission.FOREGROUND_SERVICE` (for background monitoring)

### Background Processing

#### iOS Background Tasks
```typescript
import BackgroundTask from '@react-native-async-storage/async-storage';

// Register background task for timer continuation
const registerBackgroundTask = () => {
  BackgroundTask.define('FOCUS_TIMER', () => {
    // Handle timer in background
    updateTimerState();
  });
};
```

#### Android Foreground Service
```typescript
// Foreground service for continuous timer
import { ForegroundService } from './native-modules/ForegroundService';

const startTimerService = (duration: number) => {
  ForegroundService.start({
    taskName: 'focus-timer',
    taskTitle: 'Focus Session Active',
    taskDesc: 'Tracking your focus session',
    taskIcon: 'timer_icon'
  });
};
```

### AI Coach & Insights Integration

#### AI-Powered Behavioral Analysis
```typescript
// AI service for generating personalized insights
class AICoachService {
  static async generateInsights(userData: UserAnalyticsData): Promise<AIInsight[]> {
    const response = await apiClient.post('/ai/insights', {
      focusHistory: userData.focusHistory,
      productivityPatterns: userData.patterns,
      goalProgress: userData.goals
    });
    return response.data.insights;
  }
  
  static async getPersonalizedTips(userBehavior: BehaviorData): Promise<ProductivityTip[]> {
    const response = await apiClient.post('/ai/tips', userBehavior);
    return response.data.tips;
  }
  
  static async analyzeOptimalFocusTimes(sessionData: SessionData[]): Promise<TimeAnalysis> {
    return apiClient.post('/ai/analyze-times', { sessions: sessionData });
  }
}
```

**Features**:
- Behavioral pattern recognition
- Optimal focus time analysis
- Personalized productivity recommendations
- Goal adjustment suggestions based on performance

#### Dynamic Island Integration (iOS)
```typescript
// Dynamic Island integration for active sessions and unlock timers
import { DynamicIsland } from './native-modules/DynamicIsland';

class DynamicIslandService {
  static async showFocusSession(sessionData: ActiveSession): Promise<void> {
    return DynamicIsland.showActivity({
      type: 'focus-session',
      title: sessionData.tagName,
      subtitle: `${sessionData.elapsedTime} elapsed`,
      progress: sessionData.progress,
      color: sessionData.tagColor
    });
  }
  
  static async showUnlockTimer(appName: string, remainingTime: number): Promise<void> {
    return DynamicIsland.showActivity({
      type: 'unlock-timer',
      title: appName,
      subtitle: `${remainingTime}m remaining`,
      progress: 1 - (remainingTime / totalUnlockTime),
      color: '#EF786C'
    });
  }
  
  static async clearActivity(): Promise<void> {
    return DynamicIsland.clearCurrentActivity();
  }
}
```

**Integration Points**:
- Active focus session display with progress
- App unlock timer countdown
- Session completion celebrations
- Background timer continuation

### Push Notifications

#### Expo Notifications Setup
```typescript
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Schedule session reminders
const scheduleSessionReminder = async (sessionTime: Date) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Focus Session Reminder",
      body: "Time to start your focus session!",
      data: { sessionId: 'session_id' },
    },
    trigger: { date: sessionTime },
  });
};
```

## Data Architecture

### Local Storage Strategy

#### Secure Storage (Sensitive Data)
```typescript
import * as SecureStore from 'expo-secure-store';

class SecureStorageService {
  static async storeToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('auth_token', token);
  }
  
  static async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync('auth_token');
  }
  
  static async removeToken(): Promise<void> {
    await SecureStore.deleteItemAsync('auth_token');
  }
}
```

#### App Cache (Non-sensitive Data)
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

class CacheService {
  static async storeData(key: string, data: any): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }
  
  static async getData<T>(key: string): Promise<T | null> {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
  
  static async removeData(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}
```

### State Management Architecture

#### Zustand Store Structure with Fruit Rewards
```typescript
// Enhanced focus session store with fruit rewards and tags
interface FocusState {
  currentSession: Session | null;
  isActive: boolean;
  isPaused: boolean;
  elapsedTime: number;
  sessionHistory: Session[];
  tags: FocusTag[];
  selectedTag?: FocusTag;
  customNote?: string;
  sessionGoal?: Goal;
}

interface FocusActions {
  startSession: (session: Omit<Session, 'id'>) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: (accomplishment?: string, completed?: boolean) => void;
  updateElapsedTime: (time: number) => void;
  setSelectedTag: (tag: FocusTag) => void;
  setCustomNote: (note: string) => void;
  setSessionGoal: (goal: Goal) => void;
  logManualSession: (session: ManualSession) => void;
}

// Fruit reward store
interface RewardState {
  fruitBalance: number;
  totalFruitsEarned: number;
  unlockedApps: UnlockedApp[];
  blockedApps: string[];
}

interface RewardActions {
  earnFruits: (minutes: number) => void; // 1 fruit per 5 minutes
  spendFruits: (amount: number, appId: string) => void;
  unlockApp: (appId: string, durationMinutes: number) => void;
  blockApp: (appId: string) => void;
  updateUnlockTimer: (appId: string, remainingTime: number) => void;
}

export const useFocusStore = create<FocusState & FocusActions>()(
  persist(
    (set, get) => ({
      // State
      currentSession: null,
      isActive: false,
      isPaused: false,
      elapsedTime: 0,
      sessionHistory: [],
      tags: defaultTags,
      
      // Actions
      startSession: (session) => set({
        currentSession: { 
          ...session, 
          id: generateId(),
          tag: get().selectedTag,
          customNote: get().customNote,
          goal: get().sessionGoal
        },
        isActive: true,
        isPaused: false,
        elapsedTime: 0
      }),
      
      completeSession: (accomplishment, completed) => {
        const { currentSession, elapsedTime } = get();
        if (currentSession) {
          const fruitsEarned = Math.floor(elapsedTime / 300); // 1 fruit per 5 minutes
          
          // Update focus store
          set(state => ({
            sessionHistory: [...state.sessionHistory, {
              ...currentSession,
              duration: elapsedTime,
              accomplishment,
              completed,
              fruitsEarned,
              completedAt: new Date()
            }],
            currentSession: null,
            isActive: false,
            isPaused: false,
            elapsedTime: 0
          }));
          
          // Award fruits
          useRewardStore.getState().earnFruits(fruitsEarned);
        }
      },
      
      logManualSession: (session) => {
        const fruitsEarned = Math.floor(session.duration / 300);
        set(state => ({
          sessionHistory: [...state.sessionHistory, {
            ...session,
            id: generateId(),
            fruitsEarned,
            isManual: true
          }]
        }));
        useRewardStore.getState().earnFruits(fruitsEarned);
      }
    }),
    {
      name: 'focus-store',
      storage: createJSONStorage(() => AsyncStorage)
    }
  )
);
```

#### React Query Configuration
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});
```

## API Integration

### HTTP Client Configuration
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStorageService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token expiration
      await SecureStorageService.removeToken();
      // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

### API Service Layer
```typescript
// Focus session API service
export class FocusAPI {
  static async createSession(session: CreateSessionRequest): Promise<Session> {
    const response = await apiClient.post('/sessions', session);
    return response.data;
  }
  
  static async getSessionHistory(userId: string): Promise<Session[]> {
    const response = await apiClient.get(`/users/${userId}/sessions`);
    return response.data;
  }
  
  static async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const response = await apiClient.patch(`/sessions/${sessionId}`, updates);
    return response.data;
  }
}
```

## Security Requirements

### Data Protection
- **Encryption**: All sensitive data encrypted at rest
- **Secure Storage**: Use Expo SecureStore for tokens and credentials
- **API Security**: HTTPS only, token-based authentication
- **Input Validation**: Zod schemas for all user inputs

### Privacy Compliance
- **Data Minimization**: Collect only necessary data
- **User Consent**: Explicit consent for screen time access
- **Data Retention**: Configurable data retention periods
- **Export/Delete**: User data export and deletion capabilities

## Testing Requirements

### Unit Testing
```typescript
// Component testing with React Native Testing Library
import { render, fireEvent } from '@testing-library/react-native';
import { CircularTimer } from '../CircularTimer';

describe('CircularTimer', () => {
  it('should display correct time format', () => {
    const { getByText } = render(
      <CircularTimer duration={1500} elapsed={300} isActive={true} />
    );
    expect(getByText('20:00')).toBeDefined();
  });
  
  it('should handle pause/resume correctly', () => {
    const onPause = jest.fn();
    const { getByRole } = render(
      <CircularTimer duration={1500} elapsed={300} isActive={true} onPause={onPause} />
    );
    
    fireEvent.press(getByRole('button', { name: 'Pause' }));
    expect(onPause).toHaveBeenCalled();
  });
});
```

### Integration Testing
```typescript
// Store integration testing
import { renderHook, act } from '@testing-library/react-hooks';
import { useFocusStore } from '../stores/focusStore';

describe('FocusStore', () => {
  it('should start and complete session correctly', () => {
    const { result } = renderHook(() => useFocusStore());
    
    act(() => {
      result.current.startSession({
        name: 'Test Session',
        category: 'work',
        plannedDuration: 1500
      });
    });
    
    expect(result.current.isActive).toBe(true);
    expect(result.current.currentSession?.name).toBe('Test Session');
    
    act(() => {
      result.current.completeSession();
    });
    
    expect(result.current.isActive).toBe(false);
    expect(result.current.sessionHistory).toHaveLength(1);
  });
});
```

### E2E Testing (Future Implementation)
```typescript
// Detox E2E testing setup
describe('Focus Session Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });
  
  it('should complete a focus session', async () => {
    await element(by.id('start-session-button')).tap();
    await element(by.id('session-name-input')).typeText('Test Session');
    await element(by.id('confirm-button')).tap();
    
    await waitFor(element(by.id('timer-display')))
      .toBeVisible()
      .withTimeout(2000);
    
    await element(by.id('complete-session-button')).tap();
    
    await expect(element(by.text('Session Complete!'))).toBeVisible();
  });
});
```

## Deployment Requirements

### Build Configuration

#### iOS Configuration
```json
// app.json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.bittersweet.app",
      "buildNumber": "1.0.0",
      "supportsTablet": true,
      "infoPlist": {
        "NSUserTrackingUsageDescription": "This app uses screen time data to help you manage your digital habits.",
        "NSFamilyControlsUsageDescription": "This app needs access to screen time controls to help you manage app usage."
      },
      "entitlements": {
        "com.apple.developer.family-controls": true,
        "com.apple.developer.deviceactivity": true
      }
    }
  }
}
```

#### Android Configuration
```json
// app.json
{
  "expo": {
    "android": {
      "package": "com.bittersweet.app",
      "versionCode": 1,
      "permissions": [
        "android.permission.PACKAGE_USAGE_STATS",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.WAKE_LOCK"
      ]
    }
  }
}
```

### Environment Configuration
```typescript
// config/env.ts
export const config = {
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api.bittersweet.app',
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  ANALYTICS_KEY: process.env.EXPO_PUBLIC_ANALYTICS_KEY,
  ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT || 'development',
};
```

### Performance Monitoring
```typescript
// Setup Sentry for error tracking
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: config.SENTRY_DSN,
  environment: config.ENVIRONMENT,
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
});

// Performance monitoring
import { Performance } from '@react-native-firebase/perf';

const trace = Performance().newTrace('focus_session_start');
trace.start();
// ... session logic
trace.stop();
```

## Memory Management

### Animation Cleanup
```typescript
useEffect(() => {
  const animation = Animated.timing(animValue, {
    toValue: 1,
    duration: 1000,
    useNativeDriver: true,
  });
  
  animation.start();
  
  return () => {
    animation.stop(); // Cleanup animations
  };
}, []);
```

### Event Listener Cleanup
```typescript
useEffect(() => {
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  return () => {
    subscription?.remove(); // Cleanup listeners
  };
}, []);
```

### Hardware Texture Optimization
```typescript
// Android text over images optimization
<Text style={{ renderToHardwareTextureAndroid: true }}>
  Overlay Text
</Text>

// iOS rasterization (enabled by default)
<View style={{ shouldRasterizeIOS: true }}>
  Complex View
</View>
```

This technical specification ensures the bittersweet app is built with performance, security, and maintainability as core principles while leveraging the latest React Native capabilities and best practices.