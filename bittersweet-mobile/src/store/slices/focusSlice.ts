/**
 * Enhanced Focus slice with normalized structure and cross-store integration
 * Addresses Requirements: 2.1, 2.2, 3.3, 4.2, 4.3, 5.1, 5.2, 8.2, 9.2, 9.3, 9.4
 */

import { 
  FocusSettings, 
  Tag,
  ChartDataPoint, 
  TimePeriod,
  ProductivityInsights 
} from '../types';
import { FocusSession } from '../../types/models';
import { createNormalizedState, updateNormalizedState, EntityManager } from '../utils/entityManager';
import { createEventEmitter, createEventListener, STORE_EVENTS } from '../utils/eventBus';

// Re-export types for backward compatibility
export type { FocusSession } from '../../types/models';
export type { ChartDataPoint, TimePeriod } from '../types';

// Focus slice interface
interface FocusSlice {
  // Normalized State
  sessions: any;
  tags: any;
  
  // Current Session State
  currentSession: {
    session: FocusSession | null;
    isRunning: boolean;
    remainingTime: number;
    startedAt: Date | null;
  };
  
  // Settings
  settings: FocusSettings;
  
  // Actions
  startSession: (params: { targetDuration: number; tagIds: string[]; description?: string }) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  cancelSession: () => void;
  
  // Tag Management
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => Tag;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  
  // Selectors
  getSessionById: (id: string) => FocusSession | undefined;
  getSessionsForDateRange: (start: Date, end: Date) => FocusSession[];
  getTagById: (id: string) => Tag | undefined;
  getAllTags: () => Tag[];
  getActiveSession: () => FocusSession | null;
  
  // Analytics
  getChartData: (period: TimePeriod) => any[];
  getProductivityInsights: () => any;
}

// Default tags (matching the Focus tab initial tags)
const defaultTags: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Work', icon: '💼', userId: '' },
  { name: 'Study', icon: '📚', userId: '' },
  { name: 'Personal', icon: '👤', userId: '' },
  { name: 'Exercise', icon: '💪', userId: '' },
  { name: 'Reading', icon: '📖', userId: '' },
  { name: 'Creative', icon: '🎨', userId: '' },
];

// Timer management
let timerInterval: NodeJS.Timeout | null = null;

export function createFocusSlice(set: any, get: any, api: any): FocusSlice {
  const eventEmitter = createEventEmitter('focus');
  const eventListener = createEventListener();
  
  // Force initialize tags with emojis (no backward compatibility)
  const initializeDefaultTags = (userId: string) => {
    if (__DEV__) {
      console.log('🏷️ Force initializing tags with emojis');
    }
    
    // Always reinitialize in development to ensure emojis
    const tagsWithIds = defaultTags.map(tag => ({
      ...tag,
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    
    set((state: any) => {
      // Clear existing tags and add new emoji tags
      const emptyState = createNormalizedState();
      const manager = new EntityManager(emptyState);
      tagsWithIds.forEach(tag => manager.add(tag));
      state.focus.tags = {
        ...manager.getState(),
        loading: false,
        error: null,
        lastUpdated: new Date(),
      };
    });
    
    if (__DEV__) {
      console.log('✅ Default tags initialized for user:', userId);
    }
  };

  // Initialize default categories immediately if we have a user or in development
  // Use setTimeout to ensure store is fully initialized
  setTimeout(() => {
    try {
      const state = get();
      const tags = state?.focus?.tags;
      
      const userId = (__DEV__ ? 'dev-user' : null);
      if (userId) {
        // Always reinitialize tags in development to ensure emojis
        initializeDefaultTags(userId);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('Could not initialize default data:', error);
      }
    }
  }, 500); // Give more time for store initialization
  
  // Calculate seeds earned based on session duration and completion
  const calculateSeedsEarned = (session: FocusSession): number => {
    if (session.status !== 'completed') return 0;
    
    const completionRate = session.duration / session.targetDuration;
    const baseSeeds = Math.floor(session.duration / 60); // 1 seed per minute
    const bonusMultiplier = completionRate >= 0.9 ? 1.5 : completionRate >= 0.7 ? 1.2 : 1;
    
    return Math.floor(baseSeeds * bonusMultiplier);
  };
  
  // Start timer for current session
  const startTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    timerInterval = setInterval(() => {
      const currentSession = get().focus.currentSession;
      
      if (!currentSession.isRunning || !currentSession.session) {
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        return;
      }
      
      const elapsed = Date.now() - (currentSession.startedAt?.getTime() || 0);
      const remaining = Math.max(0, (currentSession.session.targetDuration * 60 * 1000) - elapsed);
      
      set((state: any) => {
        state.focus.currentSession.remainingTime = Math.floor(remaining / 1000);
        
        // Update session duration
        if (state.focus.currentSession.session) {
          state.focus.currentSession.session.duration = Math.floor(elapsed / 1000 / 60);
        }
      });
      
      // Auto-complete when time is up
      if (remaining <= 0) {
        get().focus.completeSession();
      }
    }, 1000);
  };
  
  // Stop timer
  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  };
  
  return {
    // Normalized State
    sessions: createNormalizedState(),
    tags: createNormalizedState(),
    
    // Current Session State
    currentSession: {
      session: null,
      isRunning: false,
      remainingTime: 0,
      startedAt: null,
    },
    
    // Settings
    settings: {
      defaultDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsUntilLongBreak: 4,
      soundEnabled: true,
      vibrationEnabled: true,
      autoStartBreaks: false,
      autoStartSessions: false,
    },
    
    // Actions
    startSession: (params: { targetDuration: number; tagIds: string[]; description?: string }) => {
      const state = get();
      
      // Validate parameters
      if (!params.targetDuration || params.targetDuration <= 0) {
        throw new Error('Target duration must be greater than 0');
      }
      
      if (params.targetDuration > 180) {
        throw new Error('Target duration cannot exceed 180 minutes');
      }
      
      // Check if there's already an active session
      const currentSession = get().focus.currentSession;
      if (currentSession.session && currentSession.isRunning) {
        throw new Error('A session is already running. Please complete or cancel the current session first.');
      }
      
      const newSession: FocusSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        startTime: new Date(),
        endTime: new Date(Date.now() + params.targetDuration * 60 * 1000),
        targetDuration: params.targetDuration,
        duration: 0,
        status: 'active',
        isPaused: false,
        totalPauseTime: 0,
        tags: params.tagIds,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      set((state: any) => {
        // Add session to normalized state
        const manager = new EntityManager(state.focus.sessions);
        manager.add(newSession);
        state.focus.sessions = {
          ...manager.getState(),
          loading: false,
          error: null,
          lastUpdated: new Date(),
        };
        
        // Set as current session
        state.focus.currentSession = {
          session: newSession,
          isRunning: true,
          remainingTime: params.targetDuration * 60,
          startedAt: new Date(),
        };
      });
      
      // Start timer
      startTimer();
      
      // Emit session started event
      eventEmitter.emit(STORE_EVENTS.FOCUS_SESSION_STARTED, {
        sessionId: newSession.id,
        targetDuration: params.targetDuration,
        tagIds: params.tagIds,
      });
      
      if (__DEV__) {
        console.log('✅ Focus session started:', newSession.id);
      }
    },
    
    pauseSession: () => {
      const currentSession = get().focus.currentSession;
      
      if (!currentSession.session || !currentSession.isRunning) {
        throw new Error('No active session to pause');
      }
      
      const pauseRecord = {
        startTime: new Date(),
        endTime: new Date(), // Will be updated when resumed
      };
      
      set((state: any) => {
        if (state.focus.currentSession.session) {
          state.focus.currentSession.session.status = 'paused';
          state.focus.currentSession.session.pauseHistory.push(pauseRecord);
          state.focus.currentSession.session.updatedAt = new Date();
        }
        state.focus.currentSession.isRunning = false;
        
        // Update in normalized state
        const manager = new EntityManager(state.focus.sessions);
        if (state.focus.currentSession.session) {
          manager.update(state.focus.currentSession.session.id, {
            status: 'paused' as const,
            pauseHistory: state.focus.currentSession.session.pauseHistory,
          });
          state.focus.sessions = {
            ...manager.getState(),
            loading: false,
            error: null,
            lastUpdated: new Date(),
          };
        }
      });
      
      // Stop timer
      stopTimer();
      
      // Emit session paused event
      eventEmitter.emit(STORE_EVENTS.FOCUS_SESSION_PAUSED, {
        sessionId: currentSession.session.id,
      });
      
      if (__DEV__) {
        console.log('⏸️ Focus session paused:', currentSession.session.id);
      }
    },
    
    resumeSession: () => {
      const currentSession = get().focus.currentSession;
      
      if (!currentSession.session || currentSession.isRunning) {
        throw new Error('No paused session to resume');
      }
      
      set((state: any) => {
        if (state.focus.currentSession.session) {
          state.focus.currentSession.session.status = 'active';
          
          // Update last pause record end time
          const pauseHistory = state.focus.currentSession.session.pauseHistory;
          if (pauseHistory.length > 0) {
            pauseHistory[pauseHistory.length - 1].endTime = new Date();
          }
          
          state.focus.currentSession.session.updatedAt = new Date();
        }
        state.focus.currentSession.isRunning = true;
        state.focus.currentSession.startedAt = new Date();
        
        // Update in normalized state
        const manager = new EntityManager(state.focus.sessions);
        if (state.focus.currentSession.session) {
          manager.update(state.focus.currentSession.session.id, {
            status: 'active' as const,
            pauseHistory: state.focus.currentSession.session.pauseHistory,
          });
          state.focus.sessions = {
            ...manager.getState(),
            loading: false,
            error: null,
            lastUpdated: new Date(),
          };
        }
      });
      
      // Restart timer
      startTimer();
      
      // Emit session resumed event
      eventEmitter.emit(STORE_EVENTS.FOCUS_SESSION_RESUMED, {
        sessionId: currentSession.session.id,
      });
      
      if (__DEV__) {
        console.log('▶️ Focus session resumed:', currentSession.session.id);
      }
    },
    
    completeSession: () => {
      const currentSession = get().focus.currentSession;
      
      if (!currentSession.session) {
        throw new Error('No active session to complete');
      }
      
      const completedSession = {
        ...currentSession.session,
        status: 'completed' as const,
        endTime: new Date(),
        updatedAt: new Date(),
      };
      
      // Calculate seeds earned
      const seedsEarned = calculateSeedsEarned(completedSession);
      completedSession.seedsEarned = seedsEarned;
      
      set((state: any) => {
        // Update in normalized state
        const manager = new EntityManager(state.focus.sessions);
        manager.update(completedSession.id, completedSession);
        state.focus.sessions = {
          ...manager.getState(),
          loading: false,
          error: null,
          lastUpdated: new Date(),
        };
        
        // Clear current session
        state.focus.currentSession = {
          session: null,
          isRunning: false,
          remainingTime: 0,
          startedAt: null,
        };
      });
      
      // Stop timer
      stopTimer();
      
      // Emit session completed event for cross-store communication
      eventEmitter.emitFocusSessionCompleted(
        completedSession.id,
        seedsEarned,
        completedSession.duration
      );
      
      if (__DEV__) {
        console.log('✅ Focus session completed:', completedSession.id, `Seeds earned: ${seedsEarned}`);
      }
    },
    
    cancelSession: () => {
      const currentSession = get().focus.currentSession;
      
      if (!currentSession.session) {
        throw new Error('No active session to cancel');
      }
      
      set((state: any) => {
        // Update in normalized state
        const manager = new EntityManager(state.focus.sessions);
        manager.update(currentSession.session!.id, {
          status: 'cancelled' as const,
          endTime: new Date(),
          updatedAt: new Date(),
        });
        state.focus.sessions = {
          ...manager.getState(),
          loading: false,
          error: null,
          lastUpdated: new Date(),
        };
        
        // Clear current session
        state.focus.currentSession = {
          session: null,
          isRunning: false,
          remainingTime: 0,
          startedAt: null,
        };
      });
      
      // Stop timer
      stopTimer();
      
      // Emit session cancelled event
      eventEmitter.emit(STORE_EVENTS.FOCUS_SESSION_CANCELLED, {
        sessionId: currentSession.session.id,
      });
      
      if (__DEV__) {
        console.log('❌ Focus session cancelled:', currentSession.session.id);
      }
    },
    
    // Tag Management

    // Tag Management
    addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => {
      const state = get();
      
      const newTag: Tag = {
        ...tag,
        id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: 'dev-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      set((state: any) => {
        const manager = new EntityManager(state.focus.tags);
        manager.add(newTag);
        state.focus.tags = {
          ...manager.getState(),
          loading: false,
          error: null,
          lastUpdated: new Date(),
        };
      });
      
      if (__DEV__) {
        console.log('✅ Tag added:', newTag.name);
      }
      
      return newTag;
    },
    
    updateTag: (id: string, updates: Partial<Tag>) => {
      set((state: any) => {
        const manager = new EntityManager(state.focus.tags);
        manager.update(id, { ...updates, updatedAt: new Date() });
        state.focus.tags = {
          ...manager.getState(),
          loading: false,
          error: null,
          lastUpdated: new Date(),
        };
      });
      
      if (__DEV__) {
        console.log('✅ Tag updated:', id);
      }
    },
    
    deleteTag: (id: string) => {
      // Check if tag is being used by any sessions
      const sessions = get().focus.sessions;
      const sessionsUsingTag = sessions.allIds
        .map(id => sessions.byId[id])
        .filter(Boolean)
        .filter(session => session.tagIds && session.tagIds.includes(id));
      
      if (sessionsUsingTag.length > 0) {
        throw new Error('Cannot delete tag that is being used by sessions');
      }
      
      set((state: any) => {
        const manager = new EntityManager(state.focus.tags);
        manager.remove(id);
        state.focus.tags = {
          ...manager.getState(),
          loading: false,
          error: null,
          lastUpdated: new Date(),
        };
      });
      
      if (__DEV__) {
        console.log('✅ Tag deleted:', id);
      }
    },
    
    // Selectors
    getSessionById: (id: string) => {
      const sessions = get().focus.sessions;
      return sessions.byId[id];
    },
    
    getSessionsForDateRange: (start: Date, end: Date) => {
      const sessions = get().focus.sessions;
      return sessions.allIds
        .map(id => sessions.byId[id])
        .filter(Boolean)
        .filter(session => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= start && sessionDate <= end;
        });
    },
    
    getTagById: (id: string) => {
      const tags = get().focus.tags;
      return tags.byId[id];
    },
    
    getAllTags: () => {
      const tags = get().focus.tags;
      return tags.allIds.map(id => tags.byId[id]).filter(Boolean);
    },
    
    getActiveSession: () => {
      return get().focus.currentSession.session;
    },
    
    // Analytics
    getChartData: (period: TimePeriod) => {
      const sessions = get().focus.sessions;
      const completedSessions = sessions.allIds
        .map(id => sessions.byId[id])
        .filter(Boolean)
        .filter(session => session.status === 'completed');
      
      // Group sessions by date based on period
      const groupedData: Record<string, number> = {};
      
      completedSessions.forEach(session => {
        let key: string;
        const date = new Date(session.startTime);
        
        switch (period) {
          case 'daily':
            key = date.toISOString().split('T')[0];
            break;
          case 'weekly':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          case 'monthly':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          case 'yearly':
            key = String(date.getFullYear());
            break;
        }
        
        groupedData[key] = (groupedData[key] || 0) + session.duration;
      });
      
      return Object.entries(groupedData).map(([dateStr, value]) => ({
        date: new Date(dateStr),
        value,
        label: dateStr,
      }));
    },
    
    getProductivityInsights: () => {
      const sessions = get().focus.sessions;
      const completedSessions = sessions.allIds
        .map(id => sessions.byId[id])
        .filter(Boolean)
        .filter(session => session.status === 'completed');
      
      if (completedSessions.length === 0) {
        return {
          bestTimeOfDay: 'No data',
          mostProductiveDay: 'No data',
          averageSessionLength: 0,
          completionRate: 0,
          weeklyTrend: 'stable' as const,
          suggestions: ['Start your first focus session to see insights!'],
        };
      }
      
      // Calculate insights
      const totalSessions = manager.count();
      const completionRate = (completedSessions.length / totalSessions) * 100;
      const averageSessionLength = completedSessions.reduce((sum, session) => sum + session.duration, 0) / completedSessions.length;
      
      // Find best time of day
      const hourCounts: Record<number, number> = {};
      completedSessions.forEach(session => {
        const hour = new Date(session.startTime).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + session.duration;
      });
      
      const bestHour = Object.entries(hourCounts).reduce((best, [hour, duration]) => 
        duration > best.duration ? { hour: parseInt(hour), duration } : best,
        { hour: 0, duration: 0 }
      );
      
      const bestTimeOfDay = `${bestHour.hour}:00 - ${bestHour.hour + 1}:00`;
      
      // Find most productive day
      const dayCounts: Record<number, number> = {};
      completedSessions.forEach(session => {
        const day = new Date(session.startTime).getDay();
        dayCounts[day] = (dayCounts[day] || 0) + session.duration;
      });
      
      const bestDay = Object.entries(dayCounts).reduce((best, [day, duration]) => 
        duration > best.duration ? { day: parseInt(day), duration } : best,
        { day: 0, duration: 0 }
      );
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const mostProductiveDay = dayNames[bestDay.day];
      
      // Generate suggestions
      const suggestions: string[] = [];
      if (completionRate < 70) {
        suggestions.push('Try shorter sessions to improve completion rate');
      }
      if (averageSessionLength < 15) {
        suggestions.push('Consider longer sessions for deeper focus');
      }
      if (completedSessions.length < 5) {
        suggestions.push('Build consistency with daily focus sessions');
      }
      
      return {
        bestTimeOfDay,
        mostProductiveDay,
        averageSessionLength: Math.round(averageSessionLength),
        completionRate: Math.round(completionRate),
        weeklyTrend: 'stable' as const, // TODO: Calculate actual trend
        suggestions,
      };
    },
  };
}