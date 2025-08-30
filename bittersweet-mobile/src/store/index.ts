/**
 * Unified Zustand store - consolidated working version
 * Fixed version that uses the working store implementation
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface Task {
  id: string;
  title: string;
  description?: string;
  categoryId: string;
  date: Date;
  startTime: Date;
  duration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  userId: string;
  progress?: {
    completed: boolean;
    focusTimeSpent: number;
    estimatedTime: number;
    actualTime: number;
  };
  focusSessionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface AppStore {
  // Auth
  auth: {
    user: any;
    isAuthenticated: boolean;
    authToken: string | null;
    refreshToken: string | null;
    loginState: { data: any; loading: boolean; error: string | null; lastFetch: Date | null };
    login: (credentials: { email: string; password: string }) => Promise<void>;
    logout: () => void;
    refreshAuth: () => Promise<void>;
    updateProfile: (updates: any) => Promise<void>;
    getUser: () => any;
    isLoggedIn: () => boolean;
  };
  
  // Focus
  focus: {
    sessions: { byId: Record<string, any>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    categories: { 
      byId: Record<string, { id: string; name: string; color: string; icon: string; isDefault?: boolean; userId: string; createdAt: Date; updatedAt: Date }>;
      allIds: string[];
      loading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };
    tags: { byId: Record<string, any>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    currentSession: { session: any; isRunning: boolean; remainingTime: number; startedAt: Date | null };
    settings: {
      defaultDuration: number;
      breakDuration: number;
      longBreakDuration: number;
      sessionsUntilLongBreak: number;
      soundEnabled: boolean;
      vibrationEnabled: boolean;
      autoStartBreaks: boolean;
      autoStartSessions: boolean;
    };
  };
  
  // Tasks
  tasks: {
    tasks: { byId: Record<string, Task>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    selectedDate: Date;
    viewMode: 'day' | 'week' | 'month';
    currentWeekStart: Date;
    createTask: (taskData: any) => void;
    updateTask: (id: string, updates: any) => void;
    deleteTask: (id: string) => void;
    startTask: (id: string) => void;
    completeTask: (id: string) => void;
    setSelectedDate: (date: Date) => void;
    setViewMode: (mode: 'day' | 'week' | 'month') => void;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
    goToCurrentWeek: () => void;
  };
  
  // UI
  ui: {
    isHydrated: boolean;
    modals: Record<string, any>;
    loading: { global: boolean; actions: Record<string, boolean> };
    errors: any[];
    showModal: (type: string, data?: any) => void;
    hideModal: (type: string) => void;
    setLoading: (action: string, loading: boolean) => void;
    addError: (error: any) => void;
    clearError: (errorId: string) => void;
    clearAllErrors: () => void;
    isModalVisible: (type: string) => boolean;
    getModalData: (type: string) => any;
    isLoading: (action?: string) => boolean;
    getErrors: () => any[];
  };
  
  // Settings
  settings: {
    theme: 'dark' | 'light';
    language: string;
    notifications: { enabled: boolean; sound: boolean; vibration: boolean };
    privacy: { analytics: boolean; crashReporting: boolean };
    updateTheme: () => void;
    updateLanguage: () => void;
    updateNotifications: () => void;
    updatePrivacy: () => void;
  };
  
  // Rewards
  rewards: {
    transactions: { byId: Record<string, any>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    unlockableApps: { byId: Record<string, any>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    totalPoints: number;
    spentPoints: number;
    availablePoints: number;
  };
  
  // Social
  social: {
    squads: { byId: Record<string, any>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    challenges: { byId: Record<string, any>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    friends: { byId: Record<string, any>; allIds: string[]; loading: boolean; error: string | null; lastUpdated: Date | null };
    currentSquadId: string | null;
    activeChallenges: any[];
  };
}

const getWeekStart = () => {
  const today = new Date();
  const currentDay = today.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // Auth state and actions
      auth: {
        user: null,
        isAuthenticated: false,
        authToken: null,
        refreshToken: null,
        loginState: { data: null, loading: false, error: null, lastFetch: null },
        
        login: async (credentials) => {
          console.log('🔐 Login called with:', credentials);
          set((state) => ({
            auth: {
              ...state.auth,
              user: { 
                id: 'dev-user-' + Date.now(), 
                email: credentials.email, 
                name: 'Dev User',
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              isAuthenticated: true,
              authToken: 'mock-token',
            }
          }));
        },
        
        logout: () => {
          console.log('🚪 Logout called');
          set((state) => ({
            auth: {
              ...state.auth,
              user: null,
              isAuthenticated: false,
              authToken: null,
            }
          }));
        },
        
        refreshAuth: async () => { console.log('🔄 Refresh auth called'); },
        updateProfile: async () => { console.log('👤 Update profile called'); },
        getUser: () => get().auth.user,
        isLoggedIn: () => get().auth.isAuthenticated,
      },
      
      // Focus state
      focus: {
        sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        categories: { 
          byId: {
            'work': { id: 'work', name: 'Work', color: '#6592E9', icon: '💼', isDefault: true, userId: 'fallback', createdAt: new Date(), updatedAt: new Date() },
            'study': { id: 'study', name: 'Study', color: '#51BC6F', icon: '📚', isDefault: true, userId: 'fallback', createdAt: new Date(), updatedAt: new Date() },
            'personal': { id: 'personal', name: 'Personal', color: '#EF786C', icon: '🏠', isDefault: true, userId: 'fallback', createdAt: new Date(), updatedAt: new Date() },
            'exercise': { id: 'exercise', name: 'Exercise', color: '#FF9800', icon: '💪', isDefault: true, userId: 'fallback', createdAt: new Date(), updatedAt: new Date() },
          }, 
          allIds: ['work', 'study', 'personal', 'exercise'], 
          loading: false, 
          error: null, 
          lastUpdated: null 
        },
        tags: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        currentSession: { session: null, isRunning: false, remainingTime: 0, startedAt: null },
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
      },
      
      // Tasks state and actions
      tasks: {
        tasks: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        selectedDate: new Date(),
        viewMode: 'day',
        currentWeekStart: getWeekStart(),
        
        createTask: (taskData) => {
          console.log('📝 Creating task:', taskData);
          const taskId = 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          const task: Task = {
            id: taskId,
            title: taskData.title,
            description: taskData.description || '',
            categoryId: taskData.categoryId,
            date: new Date(taskData.date),
            startTime: new Date(taskData.startTime),
            duration: taskData.duration,
            status: taskData.status || 'scheduled',
            priority: taskData.priority || 'medium',
            userId: taskData.userId,
            progress: {
              completed: false,
              focusTimeSpent: 0,
              estimatedTime: taskData.duration || 0,
              actualTime: 0,
            },
            focusSessionIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            tasks: {
              ...state.tasks,
              tasks: {
                ...state.tasks.tasks,
                byId: { ...state.tasks.tasks.byId, [taskId]: task },
                allIds: [...state.tasks.tasks.allIds, taskId],
              }
            }
          }));
          
          console.log('✅ Task created and added to store:', task);
        },
        
        updateTask: (taskId, updates) => {
          console.log('📝 Updating task:', taskId, updates);
          set((state) => {
            const existingTask = state.tasks.tasks.byId[taskId];
            if (existingTask) {
              return {
                tasks: {
                  ...state.tasks,
                  tasks: {
                    ...state.tasks.tasks,
                    byId: {
                      ...state.tasks.tasks.byId,
                      [taskId]: {
                        ...existingTask,
                        ...updates,
                        updatedAt: new Date(),
                      }
                    }
                  }
                }
              };
            }
            return state;
          });
        },
        
        deleteTask: (taskId) => {
          console.log('🗑️ Deleting task:', taskId);
          set((state) => {
            const { [taskId]: removed, ...remainingTasks } = state.tasks.tasks.byId;
            return {
              tasks: {
                ...state.tasks,
                tasks: {
                  ...state.tasks.tasks,
                  byId: remainingTasks,
                  allIds: state.tasks.tasks.allIds.filter(id => id !== taskId),
                }
              }
            };
          });
        },
        
        startTask: (taskId) => {
          console.log('▶️ Starting task:', taskId);
          get().tasks.updateTask(taskId, { status: 'active' });
        },
        
        completeTask: (taskId) => {
          console.log('✅ Completing task:', taskId);
          get().tasks.updateTask(taskId, { 
            status: 'completed',
            progress: {
              ...get().tasks.tasks.byId[taskId]?.progress,
              completed: true,
            }
          });
        },
        
        setSelectedDate: (date) => {
          console.log('📅 Setting selected date:', date);
          set((state) => ({
            tasks: { ...state.tasks, selectedDate: date }
          }));
        },
        
        setViewMode: (mode) => {
          console.log('👁️ Setting view mode:', mode);
          set((state) => ({
            tasks: { ...state.tasks, viewMode: mode }
          }));
        },
        
        goToPreviousWeek: () => {
          console.log('⬅️ Going to previous week');
          set((state) => {
            const newWeekStart = new Date(state.tasks.currentWeekStart);
            newWeekStart.setDate(newWeekStart.getDate() - 7);
            return {
              tasks: { ...state.tasks, currentWeekStart: newWeekStart }
            };
          });
        },
        
        goToNextWeek: () => {
          console.log('➡️ Going to next week');
          set((state) => {
            const newWeekStart = new Date(state.tasks.currentWeekStart);
            newWeekStart.setDate(newWeekStart.getDate() + 7);
            return {
              tasks: { ...state.tasks, currentWeekStart: newWeekStart }
            };
          });
        },
        
        goToCurrentWeek: () => {
          console.log('📍 Going to current week');
          set((state) => ({
            tasks: { ...state.tasks, currentWeekStart: getWeekStart() }
          }));
        },
      },
      
      // UI state
      ui: {
        isHydrated: true,
        modals: {},
        loading: { global: false, actions: {} },
        errors: [],
        showModal: () => {},
        hideModal: () => {},
        setLoading: () => {},
        addError: () => {},
        clearError: () => {},
        clearAllErrors: () => {},
        isModalVisible: () => false,
        getModalData: () => null,
        isLoading: () => false,
        getErrors: () => [],
      },
      
      // Settings state
      settings: {
        theme: 'dark',
        language: 'en',
        notifications: { enabled: true, sound: true, vibration: true },
        privacy: { analytics: true, crashReporting: true },
        updateTheme: () => {},
        updateLanguage: () => {},
        updateNotifications: () => {},
        updatePrivacy: () => {},
      },
      
      // Rewards state
      rewards: {
        transactions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        unlockableApps: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        totalPoints: 0,
        spentPoints: 0,
        availablePoints: 0,
      },
      
      // Social state
      social: {
        squads: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        challenges: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        friends: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        currentSquadId: null,
        activeChallenges: [],
      },
    }),
    { name: 'bittersweet-store' }
  )
);

/**
 * Typed hooks for accessing store slices
 */
export const useAuth = () => useAppStore((state) => state.auth);
export const useFocus = () => useAppStore((state) => state.focus);
export const useTasks = () => useAppStore((state) => state.tasks);
export const useRewards = () => useAppStore((state) => state.rewards);
export const useSocial = () => useAppStore((state) => state.social);
export const useSettings = () => useAppStore((state) => state.settings);
export const useUI = () => useAppStore((state) => state.ui);

/**
 * Selective hooks for performance optimization
 */
export const useAuthUser = () => useAppStore((state) => state.auth.user);
export const useIsAuthenticated = () => useAppStore((state) => state.auth.isAuthenticated);

/**
 * Store actions hooks
 */
export const useAuthActions = () => useAppStore((state) => ({
  login: state.auth.login,
  logout: state.auth.logout,
  refreshAuth: state.auth.refreshAuth,
  updateProfile: state.auth.updateProfile,
}));

export const useTasksActions = () => useAppStore((state) => ({
  createTask: state.tasks.createTask,
  updateTask: state.tasks.updateTask,
  deleteTask: state.tasks.deleteTask,
  startTask: state.tasks.startTask,
  completeTask: state.tasks.completeTask,
  setSelectedDate: state.tasks.setSelectedDate,
  setViewMode: state.tasks.setViewMode,
  goToPreviousWeek: state.tasks.goToPreviousWeek,
  goToNextWeek: state.tasks.goToNextWeek,
  goToCurrentWeek: state.tasks.goToCurrentWeek,
}));

export const useUIActions = () => useAppStore((state) => ({
  showModal: state.ui.showModal,
  hideModal: state.ui.hideModal,
  setLoading: state.ui.setLoading,
  addError: state.ui.addError,
  clearError: state.ui.clearError,
  clearAllErrors: state.ui.clearAllErrors,
}));

/**
 * Store selectors hooks - missing functions that components expect
 */
export const useFocusSelectors = () => useAppStore((state) => ({
  getSessionById: (id: string) => {
    const sessions = state.focus.sessions;
    return sessions.byId[id];
  },
  getSessionsForDateRange: (start: Date, end: Date) => {
    const sessions = state.focus.sessions;
    return sessions.allIds
      .map(id => sessions.byId[id])
      .filter(Boolean)
      .filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= start && sessionDate <= end;
      });
  },
  getCategoryById: (id: string) => {
    const categories = state.focus.categories;
    return categories.byId[id];
  },
  getActiveSession: () => {
    return state.focus.currentSession.session;
  },
  getChartData: (period: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    const sessions = state.focus.sessions;
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
      
      groupedData[key] = (groupedData[key] || 0) + (session.duration || 0);
    });
    
    return Object.entries(groupedData).map(([dateStr, value]) => ({
      date: new Date(dateStr),
      value,
      label: dateStr,
    }));
  },
  getProductivityInsights: () => {
    const sessions = state.focus.sessions;
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
    const totalSessions = sessions.allIds.length;
    const completionRate = (completedSessions.length / Math.max(totalSessions, 1)) * 100;
    const averageSessionLength = completedSessions.reduce((sum, session) => sum + (session.duration || 0), 0) / completedSessions.length;
    
    // Find best time of day
    const hourCounts: Record<number, number> = {};
    completedSessions.forEach(session => {
      const hour = new Date(session.startTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + (session.duration || 0);
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
      dayCounts[day] = (dayCounts[day] || 0) + (session.duration || 0);
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
      weeklyTrend: 'stable' as const,
      suggestions,
    };
  },
}));

export const useTasksSelectors = () => useAppStore((state) => ({
  getTaskById: (id: string) => {
    const tasks = state.tasks.tasks;
    return tasks.byId[id];
  },
  getTasksForDate: (date: Date) => {
    const tasks = state.tasks.tasks;
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return tasks.allIds
      .map(id => tasks.byId[id])
      .filter(Boolean)
      .filter(task => {
        const taskDate = new Date(task.date);
        return taskDate >= startOfDay && taskDate <= endOfDay;
      }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  },
  getActiveTask: () => {
    const tasks = state.tasks.tasks;
    return tasks.allIds
      .map(id => tasks.byId[id])
      .filter(Boolean)
      .find(task => task.status === 'active') || null;
  },
  getTasksForDateRange: (start: Date, end: Date) => {
    const tasks = state.tasks.tasks;
    
    return tasks.allIds
      .map(id => tasks.byId[id])
      .filter(Boolean)
      .filter(task => {
        const taskDate = new Date(task.date);
        return taskDate >= start && taskDate <= end;
      }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  },
  getTaskProgress: (id: string) => {
    const task = state.tasks.tasks.byId[id];
    if (!task) {
      return {
        completed: false,
        focusTimeSpent: 0,
        estimatedTime: 0,
        actualTime: 0,
      };
    }
    
    return task.progress || {
      completed: false,
      focusTimeSpent: 0,
      estimatedTime: 0,
      actualTime: 0,
    };
  },
}));

/**
 * Store utilities
 */
export const getStoreState = () => useAppStore.getState();
export const subscribeToStore = useAppStore.subscribe;

/**
 * Store initialization
 */
export function initializeStore() {
  try {
    console.log('🔧 Initializing store...');
    const state = getStoreState();
    console.log('✅ Store initialized successfully');
    
    // Auto-login a test user in development mode
    if (__DEV__) {
      setTimeout(() => {
        try {
          const currentState = getStoreState();
          if (currentState && currentState.auth && !currentState.auth.user) {
            console.log('🔧 Auto-logging in test user for development...');
            currentState.auth.login({ email: 'test@example.com', password: 'password123' }).catch(console.error);
          }
        } catch (error) {
          console.warn('Could not auto-login:', error);
        }
      }, 1000);
    }
  } catch (error) {
    console.error('❌ Error initializing store:', error);
    throw error;
  }
}

// Initialize store on module load
try {
  initializeStore();
} catch (error) {
  console.error('❌ Failed to initialize store:', error);
}