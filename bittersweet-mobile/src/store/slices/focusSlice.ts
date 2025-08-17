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
  
  // Reset
  reset: () => void;
}

const initialState: FocusState = {
  currentSession: null,
  isTimerRunning: false,
  remainingTime: 0,
  sessions: [],
  defaultDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsUntilLongBreak: 4,
  categories: ['Work', 'Study', 'Reading', 'Exercise', 'Meditation'],
  tags: ['important', 'urgent', 'learning', 'creative', 'routine'],
  totalFocusTime: 0,
  totalSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
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

export type { FocusSession, FocusState, FocusActions };