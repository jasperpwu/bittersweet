/**
 * Unified Zustand store - Focus-centric architecture
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { FocusSession, SessionTag, CreateSessionInput } from '../types/models';
import { persistenceConfig } from './middleware/persistence';

interface AppStore {
  // Focus sessions and tags
  focus: {
    // Sessions (includes both planned and active sessions)
    sessions: { 
      byId: Record<string, FocusSession>; 
      allIds: string[]; 
      loading: boolean; 
      error: string | null; 
      lastUpdated: Date | null;
    };
    
    // Tags for organizing sessions
    tags: { 
      byId: Record<string, SessionTag>; 
      allIds: string[]; 
      loading: boolean; 
      error: string | null; 
      lastUpdated: Date | null;
    };
    
    // Current active session
    currentSession: { 
      session: FocusSession | null; 
      isRunning: boolean; 
      remainingTime: number; 
      startedAt: Date | null;
    };
    
    // View state (for calendar/list views)
    selectedDate: Date;
    viewMode: 'day' | 'week' | 'month';
    currentWeekStart: Date;
    
    // Settings
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
    
    // Actions
    createSession: (sessionData: CreateSessionInput) => void;
    updateSession: (id: string, updates: Partial<FocusSession>) => void;
    deleteSession: (id: string) => void;
    startSession: (id: string) => void;
    pauseSession: () => void;
    resumeSession: () => void;
    completeSession: (id?: string) => void;
    
    // View actions
    setSelectedDate: (date: Date) => void;
    setViewMode: (mode: 'day' | 'week' | 'month') => void;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
    goToCurrentWeek: () => void;
    
    // Tag management
    createTag: (tag: Omit<SessionTag, 'id' | 'usageCount'>) => void;
    updateTag: (id: string, updates: Partial<SessionTag>) => void;
    deleteTag: (id: string) => void;
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
    updateTheme: (theme: 'dark' | 'light') => void;
    updateLanguage: (language: string) => void;
    updateNotifications: (settings: { enabled: boolean; sound: boolean; vibration: boolean }) => void;
  };
  
  // Rewards
  rewards: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
    transactions: any[];
    unlockableApps: any[];
    earnSeeds: (amount: number, source: string, metadata?: any) => void;
    spendSeeds: (amount: number, purpose: string, metadata?: any) => void;
    unlockApp: (appId: string) => Promise<boolean>;
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

const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
};

export const useAppStore = create<AppStore>()(
  persist(
    devtools(
      (set, get) => ({
      // Focus state (merged with tasks)
      focus: {
        sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        tags: { 
          byId: {}, 
          allIds: [], 
          loading: false, 
          error: null, 
          lastUpdated: null 
        },
        currentSession: { session: null, isRunning: false, remainingTime: 0, startedAt: null },
        selectedDate: new Date(),
        viewMode: 'day',
        currentWeekStart: getWeekStart(),
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
        
        // Session actions
        createSession: (sessionData) => {
          console.log('📝 Creating focus session:', sessionData);
          const sessionId = generateId();
          
          // Calculate target duration from startTime and endTime
          const targetDuration = Math.round(
            (sessionData.endTime.getTime() - sessionData.startTime.getTime()) / (1000 * 60)
          );
          
          const session: FocusSession = {
            id: sessionId,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            targetDuration: targetDuration,
            duration: 0,
            status: 'scheduled',
            isPaused: false,
            totalPauseTime: 0,
            tagIds: sessionData.tags,
            notes: sessionData.notes,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            focus: {
              ...state.focus,
              sessions: {
                ...state.focus.sessions,
                byId: { ...state.focus.sessions.byId, [sessionId]: session },
                allIds: [...state.focus.sessions.allIds, sessionId],
              }
            }
          }));
          
          // Update tag usage counts
          sessionData.tags.forEach(tagName => {
            const tag = get().focus.tags.byId[tagName];
            if (tag) {
              set((state) => ({
                focus: {
                  ...state.focus,
                  tags: {
                    ...state.focus.tags,
                    byId: {
                      ...state.focus.tags.byId,
                      [tagName]: { ...tag, usageCount: tag.usageCount + 1 }
                    }
                  }
                }
              }));
            }
          });
          
          console.log('✅ Focus session created:', session);
        },
        
        updateSession: (sessionId, updates) => {
          console.log('📝 Updating session:', sessionId, updates);
          set((state) => {
            const existingSession = state.focus.sessions.byId[sessionId];
            if (existingSession) {
              return {
                focus: {
                  ...state.focus,
                  sessions: {
                    ...state.focus.sessions,
                    byId: {
                      ...state.focus.sessions.byId,
                      [sessionId]: {
                        ...existingSession,
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
        
        deleteSession: (sessionId) => {
          console.log('🗑️ Deleting session:', sessionId);
          set((state) => {
            const { [sessionId]: removed, ...remainingSessions } = state.focus.sessions.byId;
            return {
              focus: {
                ...state.focus,
                sessions: {
                  ...state.focus.sessions,
                  byId: remainingSessions,
                  allIds: state.focus.sessions.allIds.filter(id => id !== sessionId),
                }
              }
            };
          });
        },
        
        startSession: (sessionId) => {
          console.log('▶️ Starting session:', sessionId);
          const session = get().focus.sessions.byId[sessionId];
          if (session) {
            get().focus.updateSession(sessionId, { status: 'active' });
            set((state) => ({
              focus: {
                ...state.focus,
                currentSession: {
                  session: { ...session, status: 'active' },
                  isRunning: true,
                  remainingTime: session.targetDuration * 60, // Convert to seconds
                  startedAt: new Date(),
                }
              }
            }));
          }
        },
        
        pauseSession: () => {
          console.log('⏸️ Pausing session');
          const { currentSession } = get().focus;
          if (currentSession.session && currentSession.isRunning) {
            set((state) => ({
              focus: {
                ...state.focus,
                currentSession: {
                  ...state.focus.currentSession,
                  isRunning: false,
                }
              }
            }));
            
            get().focus.updateSession(currentSession.session.id, {
              status: 'paused',
              isPaused: true,
              pausedAt: new Date(),
            });
          }
        },
        
        resumeSession: () => {
          console.log('▶️ Resuming session');
          const { currentSession } = get().focus;
          if (currentSession.session && !currentSession.isRunning) {
            set((state) => ({
              focus: {
                ...state.focus,
                currentSession: {
                  ...state.focus.currentSession,
                  isRunning: true,
                }
              }
            }));
            
            get().focus.updateSession(currentSession.session.id, {
              status: 'active',
              isPaused: false,
              resumedAt: new Date(),
            });
          }
        },
        
        completeSession: (sessionId) => {
          const id = sessionId || get().focus.currentSession.session?.id;
          if (id) {
            console.log('✅ Completing session:', id);
            const session = get().focus.sessions.byId[id];
            if (session) {
              const actualDuration = session.targetDuration; // Could calculate actual time
              get().focus.updateSession(id, {
                status: 'completed',
                duration: actualDuration,
              });
              
              // Clear current session if it's the one being completed
              if (get().focus.currentSession.session?.id === id) {
                set((state) => ({
                  focus: {
                    ...state.focus,
                    currentSession: {
                      session: null,
                      isRunning: false,
                      remainingTime: 0,
                      startedAt: null,
                    }
                  }
                }));
              }
            }
          }
        },
        
        // View actions
        setSelectedDate: (date) => {
          console.log('📅 Setting selected date:', date);
          set((state) => ({
            focus: { ...state.focus, selectedDate: date }
          }));
        },
        
        setViewMode: (mode) => {
          console.log('👁️ Setting view mode:', mode);
          set((state) => ({
            focus: { ...state.focus, viewMode: mode }
          }));
        },
        
        goToPreviousWeek: () => {
          console.log('⬅️ Going to previous week');
          set((state) => {
            const newWeekStart = new Date(state.focus.currentWeekStart);
            newWeekStart.setDate(newWeekStart.getDate() - 7);
            return {
              focus: { ...state.focus, currentWeekStart: newWeekStart }
            };
          });
        },
        
        goToNextWeek: () => {
          console.log('➡️ Going to next week');
          set((state) => {
            const newWeekStart = new Date(state.focus.currentWeekStart);
            newWeekStart.setDate(newWeekStart.getDate() + 7);
            return {
              focus: { ...state.focus, currentWeekStart: newWeekStart }
            };
          });
        },
        
        goToCurrentWeek: () => {
          console.log('📍 Going to current week');
          set((state) => ({
            focus: { ...state.focus, currentWeekStart: getWeekStart() }
          }));
        },
        
        // Tag management
        createTag: (tagData) => {
          console.log('🏷️ Creating tag:', tagData);
          const tagId = generateId();
          const tag: SessionTag = {
            ...tagData,
            id: tagId,
            usageCount: 0,
          };
          
          set((state) => ({
            focus: {
              ...state.focus,
              tags: {
                ...state.focus.tags,
                byId: { ...state.focus.tags.byId, [tagId]: tag },
                allIds: [...state.focus.tags.allIds, tagId],
              }
            }
          }));
        },
        
        updateTag: (tagId, updates) => {
          console.log('🏷️ Updating tag:', tagId, updates);
          set((state) => {
            const existingTag = state.focus.tags.byId[tagId];
            if (existingTag) {
              return {
                focus: {
                  ...state.focus,
                  tags: {
                    ...state.focus.tags,
                    byId: {
                      ...state.focus.tags.byId,
                      [tagId]: { ...existingTag, ...updates }
                    }
                  }
                }
              };
            }
            return state;
          });
        },
        
        deleteTag: (tagId) => {
          console.log('🗑️ Deleting tag:', tagId);
          const tag = get().focus.tags.byId[tagId];
          if (tag && !tag.isDefault) { // Don't delete default tags
            set((state) => {
              const { [tagId]: removed, ...remainingTags } = state.focus.tags.byId;
              return {
                focus: {
                  ...state.focus,
                  tags: {
                    ...state.focus.tags,
                    byId: remainingTags,
                    allIds: state.focus.tags.allIds.filter(id => id !== tagId),
                  }
                }
              };
            });
          }
        },
      },
      
      // UI state
      ui: {
        isHydrated: true,
        modals: {},
        loading: { global: false, actions: {} },
        errors: [],
        showModal: (type: string, data?: any) => {
          set((state) => ({
            ui: {
              ...state.ui,
              modals: { ...state.ui.modals, [type]: data || {} }
            }
          }));
        },
        hideModal: (type: string) => {
          set((state) => {
            const { [type]: removed, ...remainingModals } = state.ui.modals;
            return {
              ui: { ...state.ui, modals: remainingModals }
            };
          });
        },
        setLoading: (action: string, loading: boolean) => {
          set((state) => ({
            ui: {
              ...state.ui,
              loading: {
                ...state.ui.loading,
                actions: { ...state.ui.loading.actions, [action]: loading }
              }
            }
          }));
        },
        addError: (error: any) => {
          set((state) => ({
            ui: { ...state.ui, errors: [...state.ui.errors, error] }
          }));
        },
        clearError: (errorId: string) => {
          set((state) => ({
            ui: {
              ...state.ui,
              errors: state.ui.errors.filter((_, index) => index.toString() !== errorId)
            }
          }));
        },
        clearAllErrors: () => {
          set((state) => ({
            ui: { ...state.ui, errors: [] }
          }));
        },
        isModalVisible: (type: string) => {
          return !!get().ui.modals[type];
        },
        getModalData: (type: string) => {
          return get().ui.modals[type] || null;
        },
        isLoading: (action?: string) => {
          const { loading } = get().ui;
          if (action) {
            return loading.actions[action] || false;
          }
          return loading.global;
        },
        getErrors: () => {
          return get().ui.errors;
        },
      },
      
      // Settings state
      settings: {
        theme: 'dark',
        language: 'en',
        notifications: { enabled: true, sound: true, vibration: true },
        updateTheme: (theme) => {
          set((state) => ({
            settings: { ...state.settings, theme }
          }));
        },
        updateLanguage: (language) => {
          set((state) => ({
            settings: { ...state.settings, language }
          }));
        },
        updateNotifications: (notifications) => {
          set((state) => ({
            settings: { ...state.settings, notifications }
          }));
        },
      },
      
      // Rewards state
      rewards: {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        transactions: [],
        unlockableApps: [],
        earnSeeds: (amount, source, metadata) => {
          set((state) => ({
            rewards: {
              ...state.rewards,
              balance: state.rewards.balance + amount,
              totalEarned: state.rewards.totalEarned + amount,
              transactions: [...state.rewards.transactions, { id: generateId(), amount, source, metadata, type: 'earn', timestamp: new Date() }]
            }
          }));
        },
        spendSeeds: (amount, purpose, metadata) => {
          set((state) => ({
            rewards: {
              ...state.rewards,
              balance: state.rewards.balance - amount,
              totalSpent: state.rewards.totalSpent + amount,
              transactions: [...state.rewards.transactions, { id: generateId(), amount, purpose, metadata, type: 'spend', timestamp: new Date() }]
            }
          }));
        },
        unlockApp: async (appId) => {
          const app = get().rewards.unlockableApps.find(app => app.id === appId);
          if (app) {
            set((state) => ({
              rewards: {
                ...state.rewards,
                balance: state.rewards.balance - app.price,
                totalSpent: state.rewards.totalSpent + app.price,
                transactions: [...state.rewards.transactions, { id: generateId(), amount: app.price, purpose: 'unlock', metadata: { appId }, type: 'spend', timestamp: new Date() }],
                unlockableApps: state.rewards.unlockableApps.filter(a => a.id !== appId)
              }
            }));
            return true;
          }
          return false;
        }
      }
    }),
      { name: 'bittersweet-store' }
    ),
    persistenceConfig
  )
);

/**
 * Typed hooks for accessing store slices
 */
export const useFocus = () => useAppStore((state) => state.focus);
export const useSettings = () => useAppStore((state) => state.settings);
export const useUI = () => useAppStore((state) => state.ui);
export const useRewards = () => useAppStore((state) => state.rewards);

/**
 * Store actions hooks
 */
export const useFocusActions = () => useAppStore((state) => ({
  createSession: state.focus.createSession,
  updateSession: state.focus.updateSession,
  deleteSession: state.focus.deleteSession,
  startSession: state.focus.startSession,
  pauseSession: state.focus.pauseSession,
  resumeSession: state.focus.resumeSession,
  completeSession: state.focus.completeSession,
  setSelectedDate: state.focus.setSelectedDate,
  setViewMode: state.focus.setViewMode,
  goToPreviousWeek: state.focus.goToPreviousWeek,
  goToNextWeek: state.focus.goToNextWeek,
  goToCurrentWeek: state.focus.goToCurrentWeek,
  createTag: state.focus.createTag,
  updateTag: state.focus.updateTag,
  deleteTag: state.focus.deleteTag,
}));

export const useUIActions = () => useAppStore((state) => ({
  showModal: state.ui.showModal,
  hideModal: state.ui.hideModal,
  setLoading: state.ui.setLoading,
  addError: state.ui.addError,
  clearError: state.ui.clearError,
  clearAllErrors: state.ui.clearAllErrors,
}));

export const useSettingsActions = () => useAppStore((state) => ({
  updateTheme: state.settings.updateTheme,
  updateLanguage: state.settings.updateLanguage,
  updateNotifications: state.settings.updateNotifications,
}));

export const useRewardsActions = () => useAppStore((state) => ({
  earnSeeds: state.rewards.earnSeeds,
  spendSeeds: state.rewards.spendSeeds,
  unlockApp: state.rewards.unlockApp,
}));

/**
 * Store selectors hooks
 */
export const useFocusSelectors = () => useAppStore((state) => ({
  getSessionById: (id: string) => state.focus.sessions.byId[id],
  getSessionsForDate: (date: Date) => {
    const sessions = Object.values(state.focus.sessions.byId);
    return sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate.toDateString() === date.toDateString();
    });
  },
  getSessionsForDateRange: (startDate: Date, endDate: Date) => {
    const sessions = Object.values(state.focus.sessions.byId);
    return sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  },
  getActiveSession: () => state.focus.currentSession.session,
  getTagById: (id: string) => state.focus.tags.byId[id],
  getAllTags: () => Object.values(state.focus.tags.byId),
  getCompletedSessions: () => Object.values(state.focus.sessions.byId)
      .filter(Boolean)
      .filter(session => session.status === 'completed'),
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
    getStoreState();
    console.log('✅ Store initialized successfully');
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