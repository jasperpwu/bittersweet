import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FocusSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  targetDuration: number;
  category: string;
  tags: string[];
  isCompleted: boolean;
  isPaused: boolean;
  pausedAt?: Date;
  totalPauseTime: number;
  seedsEarned: number;
}

interface FocusState {
  // Current session state
  currentSession: FocusSession | null;
  isTimerRunning: boolean;
  remainingTime: number; // in seconds
  
  // Session history
  sessions: FocusSession[];
  
  // Settings
  defaultDuration: number; // in minutes
  breakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  sessionsUntilLongBreak: number;
  
  // Categories and tags
  categories: string[];
  tags: string[];
  
  // Statistics
  totalFocusTime: number; // in minutes
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
}

// Chart data interfaces for insights
interface ChartDataPoint {
  date: string;
  value: number; // focus minutes
  label: string; // day abbreviation
}

type TimePeriod = 'daily' | 'weekly' | 'monthly';

interface FocusActions {
  // Session management
  startSession: (targetDuration: number, category: string, tags?: string[]) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  stopSession: () => void;
  completeSession: () => void;
  
  // Timer management
  updateRemainingTime: (time: number) => void;
  
  // Settings
  updateSettings: (settings: Partial<Pick<FocusState, 'defaultDuration' | 'breakDuration' | 'longBreakDuration' | 'sessionsUntilLongBreak'>>) => void;
  
  // Categories and tags
  addCategory: (category: string) => void;
  removeCategory: (category: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  
  // Session history
  addSession: (session: FocusSession) => void;
  removeSession: (sessionId: string) => void;
  
  // Statistics
  updateStats: () => void;
  
  // Insights data processing
  getChartData: (period: TimePeriod) => ChartDataPoint[];
  getSessionsByDate: () => Record<string, FocusSession[]>;
  deleteSession: (sessionId: string) => void;
  
  // Reset
  reset: () => void;
}

// Mock sessions for development
const mockSessions: FocusSession[] = [
  {
    id: '1',
    startTime: new Date(),
    endTime: new Date(Date.now() + 25 * 60 * 1000),
    duration: 25,
    targetDuration: 25,
    category: 'Work',
    tags: ['important', 'project'],
    isCompleted: true,
    isPaused: false,
    totalPauseTime: 0,
    seedsEarned: 5,
  },
  {
    id: '2',
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
    duration: 30,
    targetDuration: 30,
    category: 'Study',
    tags: ['learning'],
    isCompleted: true,
    isPaused: false,
    totalPauseTime: 0,
    seedsEarned: 6,
  },
  {
    id: '3',
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 23.5 * 60 * 60 * 1000),
    duration: 20,
    targetDuration: 25,
    category: 'Meditation',
    tags: ['mindfulness'],
    isCompleted: true,
    isPaused: false,
    totalPauseTime: 0,
    seedsEarned: 4,
  },
];

const initialState: FocusState = {
  currentSession: null,
  isTimerRunning: false,
  remainingTime: 0,
  sessions: mockSessions,
  defaultDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  categories: ['Work', 'Study', 'Reading', 'Exercise', 'Meditation'],
  tags: ['important', 'urgent', 'learning', 'creative', 'routine'],
  totalFocusTime: 75,
  totalSessions: 3,
  currentStreak: 2,
  longestStreak: 2,
};

// Helper functions for insights data processing
const formatDateKey = (date: Date): string => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateLabel = (dateStr: string, period: TimePeriod): string => {
  const date = new Date(dateStr);
  
  switch (period) {
    case 'daily':
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    case 'weekly':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `Week ${Math.ceil(date.getDate() / 7)}`;
    case 'monthly':
      return date.toLocaleDateString('en-US', { month: 'short' });
    default:
      return dateStr;
  }
};

const getSessionsForPeriod = (sessions: FocusSession[], period: TimePeriod): FocusSession[] => {
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case 'daily':
      // Last 7 days
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      // Last 4 weeks
      startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      // Last 6 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    default:
      startDate = new Date(0); // All time
  }
  
  return sessions.filter(session => new Date(session.startTime) >= startDate);
};

const groupSessionsByPeriod = (sessions: FocusSession[], period: TimePeriod): Record<string, FocusSession[]> => {
  return sessions.reduce((groups, session) => {
    let groupKey: string;
    const sessionDate = new Date(session.startTime);
    
    switch (period) {
      case 'daily':
        groupKey = formatDateKey(sessionDate);
        break;
      case 'weekly':
        // Group by week start (Sunday)
        const weekStart = new Date(sessionDate);
        weekStart.setDate(sessionDate.getDate() - sessionDate.getDay());
        groupKey = formatDateKey(weekStart);
        break;
      case 'monthly':
        // Group by month
        groupKey = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, '0')}-01`;
        break;
      default:
        groupKey = formatDateKey(sessionDate);
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(session);
    return groups;
  }, {} as Record<string, FocusSession[]>);
};

export const useFocusStore = create<FocusState & FocusActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      startSession: (targetDuration, category, tags = []) => {
        const session: FocusSession = {
          id: Date.now().toString(),
          startTime: new Date(),
          duration: 0,
          targetDuration,
          category,
          tags,
          isCompleted: false,
          isPaused: false,
          totalPauseTime: 0,
          seedsEarned: 0,
        };

        set({
          currentSession: session,
          isTimerRunning: true,
          remainingTime: targetDuration * 60, // convert to seconds
        });
      },

      pauseSession: () => {
        const { currentSession } = get();
        if (currentSession && !currentSession.isPaused) {
          set({
            currentSession: {
              ...currentSession,
              isPaused: true,
              pausedAt: new Date(),
            },
            isTimerRunning: false,
          });
        }
      },

      resumeSession: () => {
        const { currentSession } = get();
        if (currentSession && currentSession.isPaused && currentSession.pausedAt) {
          const pauseTime = Date.now() - currentSession.pausedAt.getTime();
          set({
            currentSession: {
              ...currentSession,
              isPaused: false,
              pausedAt: undefined,
              totalPauseTime: currentSession.totalPauseTime + pauseTime,
            },
            isTimerRunning: true,
          });
        }
      },

      stopSession: () => {
        const { currentSession } = get();
        if (currentSession) {
          const endTime = new Date();
          const duration = Math.floor((endTime.getTime() - currentSession.startTime.getTime()) / 60000); // in minutes
          
          const completedSession: FocusSession = {
            ...currentSession,
            endTime,
            duration,
            isCompleted: false,
          };

          get().addSession(completedSession);
        }

        set({
          currentSession: null,
          isTimerRunning: false,
          remainingTime: 0,
        });
      },

      completeSession: () => {
        const { currentSession } = get();
        if (currentSession) {
          const endTime = new Date();
          const duration = currentSession.targetDuration; // Full duration completed
          const seedsEarned = Math.floor(duration / 5); // 1 seed per 5 minutes
          
          const completedSession: FocusSession = {
            ...currentSession,
            endTime,
            duration,
            isCompleted: true,
            seedsEarned,
          };

          get().addSession(completedSession);
          get().updateStats();
        }

        set({
          currentSession: null,
          isTimerRunning: false,
          remainingTime: 0,
        });
      },

      updateRemainingTime: (time) => {
        set({ remainingTime: Math.max(0, time) });
      },

      updateSettings: (settings) => {
        set(settings);
      },

      addCategory: (category) => {
        const { categories } = get();
        if (!categories.includes(category)) {
          set({ categories: [...categories, category] });
        }
      },

      removeCategory: (category) => {
        const { categories } = get();
        set({ categories: categories.filter(c => c !== category) });
      },

      addTag: (tag) => {
        const { tags } = get();
        if (!tags.includes(tag)) {
          set({ tags: [...tags, tag] });
        }
      },

      removeTag: (tag) => {
        const { tags } = get();
        set({ tags: tags.filter(t => t !== tag) });
      },

      addSession: (session) => {
        const { sessions } = get();
        set({ sessions: [session, ...sessions] });
      },

      removeSession: (sessionId) => {
        const { sessions } = get();
        set({ sessions: sessions.filter(s => s.id !== sessionId) });
      },

      updateStats: () => {
        const { sessions } = get();
        const completedSessions = sessions.filter(s => s.isCompleted);
        
        const totalFocusTime = completedSessions.reduce((total, session) => total + session.duration, 0);
        const totalSessions = completedSessions.length;
        
        // Calculate current streak
        let currentStreak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let i = 0; i < completedSessions.length; i++) {
          const sessionDate = new Date(completedSessions[i].startTime);
          sessionDate.setHours(0, 0, 0, 0);
          
          const daysDiff = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === currentStreak) {
            currentStreak++;
          } else {
            break;
          }
        }
        
        // Calculate longest streak (simplified)
        const longestStreak = Math.max(get().longestStreak, currentStreak);

        set({
          totalFocusTime,
          totalSessions,
          currentStreak,
          longestStreak,
        });
      },

      // Insights data processing actions
      getChartData: (period) => {
        const { sessions } = get();
        const filteredSessions = getSessionsForPeriod(sessions, period);
        const groupedSessions = groupSessionsByPeriod(filteredSessions, period);
        
        const chartData = Object.entries(groupedSessions).map(([date, sessionGroup]) => ({
          date,
          value: sessionGroup.reduce((total, session) => total + (session.duration || 0), 0),
          label: formatDateLabel(date, period)
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // If no data, generate empty data points for the current period
        if (chartData.length === 0) {
          const now = new Date();
          const emptyData: ChartDataPoint[] = [];
          
          if (period === 'weekly') {
            // Generate 7 days of empty data
            for (let i = 6; i >= 0; i--) {
              const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
              emptyData.push({
                date: formatDateKey(date),
                value: 0,
                label: date.toLocaleDateString('en-US', { weekday: 'short' })
              });
            }
          }
          
          return emptyData;
        }
        
        return chartData;
      },

      getSessionsByDate: () => {
        const { sessions } = get();
        return sessions.reduce((groups, session) => {
          const dateKey = formatDateKey(session.startTime);
          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(session);
          return groups;
        }, {} as Record<string, FocusSession[]>);
      },

      deleteSession: (sessionId) => {
        const { sessions } = get();
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        set({ sessions: updatedSessions });
        get().updateStats();
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'focus-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        defaultDuration: state.defaultDuration,
        breakDuration: state.breakDuration,
        longBreakDuration: state.longBreakDuration,
        sessionsUntilLongBreak: state.sessionsUntilLongBreak,
        categories: state.categories,
        tags: state.tags,
        totalFocusTime: state.totalFocusTime,
        totalSessions: state.totalSessions,
        currentStreak: state.currentStreak,
        longestStreak: state.longestStreak,
      }),
    }
  )
);

export type { FocusSession, FocusState, FocusActions, ChartDataPoint, TimePeriod };