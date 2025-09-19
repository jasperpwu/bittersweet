/**
 * Unified Zustand store - Focus-centric architecture
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { FocusSession, SessionTag, CreateSessionInput, FamilyActivitySelection, UnlockSession, UnlockTransaction, BlocklistSettings } from '../types/models';
import { FamilyControlsModule } from '../modules/BitterSweetFamilyControls';
import { FocusGoal } from './types';
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
    
    // Tags for organizing sessions (keyed by tag name)
    tags: { 
      byName: Record<string, SessionTag>; 
      allNames: string[]; 
      loading: boolean; 
      error: string | null; 
      lastUpdated: Date | null;
    };
    
    // Goals for focus tracking
    goals: { 
      byId: Record<string, FocusGoal>; 
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
    createSession: (sessionData: CreateSessionInput) => FocusSession;
    updateSession: (id: string, updates: Partial<FocusSession>) => void;
    deleteSession: (id: string) => void;
    startSession: (id: string) => void;
    pauseSession: () => void;
    resumeSession: () => void;
    completeSession: (id?: string) => void;
    createCompletedSession: (params: { startTime: Date; endTime: Date; duration: number; targetDuration: number; tagName: string; notes?: string }) => FocusSession;
    
    // View actions
    setSelectedDate: (date: Date) => void;
    setViewMode: (mode: 'day' | 'week' | 'month') => void;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
    goToCurrentWeek: () => void;
    
    // Tag management
    createTag: (tag: Omit<SessionTag, 'usageCount'>) => void;
    updateTag: (name: string, updates: Partial<SessionTag>) => void;
    deleteTag: (name: string) => void;
    
    // Goal management
    addGoal: (goal: Omit<FocusGoal, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateGoal: (id: string, updates: Partial<FocusGoal>) => void;
    deleteGoal: (id: string) => void;
    getActiveGoals: () => FocusGoal[];
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
    earnFruits: (amount: number, source: string, metadata?: any) => void;
    spendFruits: (amount: number, purpose: string, metadata?: any) => void;
    unlockApp: (appId: string) => Promise<boolean>;
  };

  // Blocklist
  blocklist: {
    // Settings and blocked apps
    settings: BlocklistSettings;

    // Current unlock sessions
    activeSessions: {
      byId: Record<string, UnlockSession>;
      allIds: string[];
    };

    // Unlock history
    transactions: {
      byId: Record<string, UnlockTransaction>;
      allIds: string[];
    };

    // Runtime state
    isAuthorized: boolean;
    authorizationStatus: 'notDetermined' | 'denied' | 'approved';
    lastAuthCheck: Date | null;

    // Actions
    checkAuthorizationStatus: () => Promise<boolean>;
    requestAuthorization: () => Promise<boolean>;
    updateBlockedApps: (selection: FamilyActivitySelection, metadata?: { applicationCount?: number; categoryCount?: number; webDomainCount?: number }) => Promise<void>;
    updateSettings: (settings: Partial<BlocklistSettings>) => void;
    requestUnlock: (appTokens: any[], duration: number) => Promise<UnlockSession | null>;
    endUnlock: (sessionId: string) => void;
    checkActiveUnlocks: () => void;
    getDailyUnlockCount: () => number;
    getRemainingUnlocks: () => number;
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
          byName: {}, 
          allNames: [], 
          loading: false, 
          error: null, 
          lastUpdated: null 
        },
        goals: { 
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
          
          // Calculate duration from startTime and endTime
          const duration = Math.round(
            (sessionData.endTime.getTime() - sessionData.startTime.getTime()) / (1000 * 60)
          );
          
          const session: FocusSession = {
            id: sessionId,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            duration: duration,
            isPaused: false,
            totalPauseTime: 0,
            tagName: sessionData.tagName,
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
          
          // Update tag usage count
          const tagName = sessionData.tagName;
          if (tagName) {
            const tag = get().focus.tags.byName[tagName];
            if (tag) {
              set((state) => ({
                focus: {
                  ...state.focus,
                  tags: {
                    ...state.focus.tags,
                    byName: {
                      ...state.focus.tags.byName,
                      [tagName]: { ...tag, usageCount: tag.usageCount + 1 }
                    }
                  }
                }
              }));
            }
          }
          
          // Calculate and award fruits (1 fruit per 5 minutes)
          const fruitsEarned = Math.floor(duration / 5);
          if (fruitsEarned > 0) {
            get().rewards.earnFruits(fruitsEarned, 'focus_session', {
              sessionId: sessionId,
              duration: duration,
            });
            console.log('🍎 Fruits earned:', fruitsEarned, 'for session:', sessionId);
          }
          
          console.log('✅ Focus session created:', session);
          return session;
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
          
          // Get the session being deleted to check if it had rewards
          const sessionToDelete = get().focus.sessions.byId[sessionId];
          
          set((state) => {
            // Remove the session
            const { [sessionId]: removed, ...remainingSessions } = state.focus.sessions.byId;
            
            // Remove corresponding reward transactions
            const filteredTransactions = state.rewards.transactions.filter((transaction: any) => {
              // Remove transactions that are related to this session
              return !(transaction.metadata?.sessionId === sessionId || 
                      (transaction.type === 'earn' && transaction.source === 'focus_session' && 
                       transaction.metadata?.sessionId === sessionId));
            });
            
            // Calculate fruits to deduct if session had earned rewards
            let fruitsToDeduct = 0;
            const removedTransactions = state.rewards.transactions.filter((transaction: any) => 
              transaction.metadata?.sessionId === sessionId && 
              transaction.type === 'earn' && 
              transaction.source === 'focus_session'
            );
            
            removedTransactions.forEach((transaction: any) => {
              fruitsToDeduct += transaction.amount;
            });
            
            return {
              focus: {
                ...state.focus,
                sessions: {
                  ...state.focus.sessions,
                  byId: remainingSessions,
                  allIds: state.focus.sessions.allIds.filter(id => id !== sessionId),
                }
              },
              rewards: {
                ...state.rewards,
                transactions: filteredTransactions,
                balance: state.rewards.balance - fruitsToDeduct,
                totalEarned: state.rewards.totalEarned - fruitsToDeduct,
              }
            };
          });
          
          if (sessionToDelete) {
            console.log('🗑️ Session deleted and corresponding rewards removed:', sessionId);
          }
        },
        
        startSession: (sessionId) => {
          console.log('▶️ Starting session:', sessionId);
          const session = get().focus.sessions.byId[sessionId];
          if (session) {
            set((state) => ({
              focus: {
                ...state.focus,
                currentSession: {
                  session: session,
                  isRunning: true,
                  remainingTime: session.duration * 60, // Convert to seconds
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
              const actualDuration = session.duration; // Use the actual duration
              
              // Session is already completed, no need to update status
              // Duration is already set when creating the session
              
              // Calculate and award fruits (1 fruit per 5 minutes)
              const fruitsEarned = Math.floor(actualDuration / 5);
              if (fruitsEarned > 0) {
                get().rewards.earnFruits(fruitsEarned, 'focus_session', {
                  sessionId: id,
                  duration: actualDuration,
                });
                console.log('🍎 Fruits earned:', fruitsEarned, 'for session:', id);
              }
              
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
        
        createCompletedSession: (params: { startTime: Date; endTime: Date; duration: number; targetDuration: number; tagName: string; notes?: string }) => {
          console.log('📝 Creating completed session:', params);
          const sessionId = generateId();
          
          const completedSession: FocusSession = {
            id: sessionId,
            startTime: params.startTime,
            endTime: params.endTime,
            duration: params.duration,
            isPaused: false,
            totalPauseTime: 0,
            tagName: params.tagName,
            notes: params.notes,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            focus: {
              ...state.focus,
              sessions: {
                ...state.focus.sessions,
                byId: { ...state.focus.sessions.byId, [sessionId]: completedSession },
                allIds: [...state.focus.sessions.allIds, sessionId],
              }
            }
          }));
          
          // Update tag usage count
          const tagName = params.tagName;
          if (tagName) {
            const tag = get().focus.tags.byName[tagName];
            if (tag) {
              set((state) => ({
                focus: {
                  ...state.focus,
                  tags: {
                    ...state.focus.tags,
                    byName: {
                      ...state.focus.tags.byName,
                      [tagName]: { ...tag, usageCount: tag.usageCount + 1 }
                    }
                  }
                }
              }));
            }
          }
          
          // Calculate and award fruits (1 fruit per 5 minutes)
          const fruitsEarned = Math.floor(params.duration / 5);
          if (fruitsEarned > 0) {
            get().rewards.earnFruits(fruitsEarned, 'focus_session', {
              sessionId: sessionId,
              duration: params.duration,
            });
            console.log('🍎 Fruits earned:', fruitsEarned, 'for completed session:', sessionId);
          }
          
          console.log('✅ Completed focus session created:', completedSession);
          return completedSession;
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
        
        // Goal management
        addGoal: (goalData) => {
          console.log('🎯 Creating goal:', goalData);
          const goalId = generateId();
          const goal: FocusGoal = {
            ...goalData,
            id: goalId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            focus: {
              ...state.focus,
              goals: {
                ...state.focus.goals,
                byId: { ...state.focus.goals.byId, [goalId]: goal },
                allIds: [...state.focus.goals.allIds, goalId],
              }
            }
          }));
        },
        
        updateGoal: (goalId, updates) => {
          console.log('🎯 Updating goal:', goalId, updates);
          set((state) => {
            const existingGoal = state.focus.goals.byId[goalId];
            if (existingGoal) {
              return {
                focus: {
                  ...state.focus,
                  goals: {
                    ...state.focus.goals,
                    byId: {
                      ...state.focus.goals.byId,
                      [goalId]: { ...existingGoal, ...updates, updatedAt: new Date() }
                    }
                  }
                }
              };
            }
            return state;
          });
        },
        
        deleteGoal: (goalId) => {
          console.log('🗑️ Deleting goal:', goalId);
          set((state) => {
            const { [goalId]: removed, ...remainingGoals } = state.focus.goals.byId;
            return {
              focus: {
                ...state.focus,
                goals: {
                  ...state.focus.goals,
                  byId: remainingGoals,
                  allIds: state.focus.goals.allIds.filter(id => id !== goalId),
                }
              }
            };
          });
        },
        
        getActiveGoals: () => {
          return Object.values(get().focus.goals.byId).filter((goal: FocusGoal) => goal.isActive);
        },
        
        // Tag management
        createTag: (tagData) => {
          console.log('🏷️ Creating tag:', tagData);
          const tag: SessionTag = {
            ...tagData,
            usageCount: 0,
          };
          
          set((state) => ({
            focus: {
              ...state.focus,
              tags: {
                ...state.focus.tags,
                byName: { ...state.focus.tags.byName, [tag.name]: tag },
                allNames: [...state.focus.tags.allNames, tag.name],
              }
            }
          }));
        },
        
        updateTag: (tagName, updates) => {
          console.log('🏷️ Updating tag:', tagName, updates);
          set((state) => {
            const existingTag = state.focus.tags.byName[tagName];
            if (existingTag) {
              // If the name is being changed, we need to update the key
              const updatedTag = { ...existingTag, ...updates };
              const newTagName = updates.name || tagName;
              
              if (newTagName !== tagName) {
                // Name changed - remove old key and add with new key
                const { [tagName]: removed, ...remainingTags } = state.focus.tags.byName;
                return {
                  focus: {
                    ...state.focus,
                    tags: {
                      ...state.focus.tags,
                      byName: {
                        ...remainingTags,
                        [newTagName]: updatedTag
                      },
                      allNames: state.focus.tags.allNames.map(name => name === tagName ? newTagName : name)
                    }
                  }
                };
              } else {
                // Name unchanged - just update in place
                return {
                  focus: {
                    ...state.focus,
                    tags: {
                      ...state.focus.tags,
                      byName: {
                        ...state.focus.tags.byName,
                        [tagName]: updatedTag
                      }
                    }
                  }
                };
              }
            }
            return state;
          });
        },
        
        deleteTag: (tagName) => {
          console.log('🗑️ Deleting tag:', tagName);
          const tag = get().focus.tags.byName[tagName];
          
          if (tag) {
            // Find all sessions associated with this tag
            const sessions = get().focus.sessions;
            const sessionsToDelete = sessions.allIds
              .map(sessionId => sessions.byId[sessionId])
              .filter(Boolean)
              .filter(session => session.tagName === tagName);
            
            console.log(`🗑️ Deleting tag ${tagName} and ${sessionsToDelete.length} associated sessions`);
            
            set((state) => {
              // Delete all sessions associated with this tag
              const remainingSessions = { ...state.focus.sessions.byId };
              const remainingSessionIds = [...state.focus.sessions.allIds];
              
              sessionsToDelete.forEach(session => {
                delete remainingSessions[session.id];
                const index = remainingSessionIds.indexOf(session.id);
                if (index > -1) {
                  remainingSessionIds.splice(index, 1);
                }
              });
              
              // Delete the tag
              const { [tagName]: removed, ...remainingTags } = state.focus.tags.byName;
              
              return {
                focus: {
                  ...state.focus,
                  sessions: {
                    ...state.focus.sessions,
                    byId: remainingSessions,
                    allIds: remainingSessionIds,
                  },
                  tags: {
                    ...state.focus.tags,
                    byName: remainingTags,
                    allNames: state.focus.tags.allNames.filter(name => name !== tagName),
                  }
                }
              };
            });
            
            console.log(`✅ Tag ${tagName} and ${sessionsToDelete.length} sessions deleted`);
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
        earnFruits: (amount, source, metadata) => {
          set((state) => ({
            rewards: {
              ...state.rewards,
              balance: state.rewards.balance + amount,
              totalEarned: state.rewards.totalEarned + amount,
              transactions: [...state.rewards.transactions, { id: generateId(), amount, source, metadata, type: 'earn', timestamp: new Date() }]
            }
          }));
        },
        spendFruits: (amount, purpose, metadata) => {
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
      },

      // Blocklist state
      blocklist: {
        settings: {
          isEnabled: false,
          blockedApps: {
            applicationTokens: [],
            categoryTokens: [],
            webDomainTokens: []
          },
          unlockCostPerMinute: 1, // 1 fruit per minute
          maxUnlockDuration: 60, // 60 minutes max
          allowedUnlocksPerDay: 5,
          scheduleEnabled: false,
        },
        activeSessions: {
          byId: {},
          allIds: []
        },
        transactions: {
          byId: {},
          allIds: []
        },
        isAuthorized: false,
        authorizationStatus: 'notDetermined',
        lastAuthCheck: null,

        // Blocklist actions
        checkAuthorizationStatus: async () => {
          try {
            console.log('🔍 Checking current Family Controls authorization status...');
            const status = await FamilyControlsModule.getAuthorizationStatus();
            const isAuthorized = status === 'approved';

            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized,
                authorizationStatus: status,
                lastAuthCheck: new Date()
              }
            }));

            console.log('🔍 Current authorization status:', status, 'isAuthorized:', isAuthorized);
            return isAuthorized;
          } catch (error) {
            console.error('❌ Failed to check authorization status:', error);
            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized: false,
                authorizationStatus: 'unknown',
                lastAuthCheck: new Date()
              }
            }));
            return false;
          }
        },

        requestAuthorization: async () => {
          try {
            console.log('🔐 Requesting Family Controls authorization...');
            const authorized = await FamilyControlsModule.requestAuthorization();

            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized: authorized,
                authorizationStatus: authorized ? 'approved' : 'denied',
                lastAuthCheck: new Date()
              }
            }));

            console.log('🔐 Authorization result:', authorized);
            return authorized;
          } catch (error) {
            console.error('❌ Failed to request authorization:', error);
            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized: false,
                authorizationStatus: 'denied',
                lastAuthCheck: new Date()
              }
            }));
            return false;
          }
        },

        updateBlockedApps: async (selection: FamilyActivitySelection, metadata?: { applicationCount?: number; categoryCount?: number; webDomainCount?: number }) => {
          try {
            console.log('📱 Store: updateBlockedApps called');
            console.log('📱 Store: selection token:', selection);
            console.log('📱 Store: metadata:', metadata);

            // Apply restrictions using native module with the string token
            console.log('📱 Store: Calling FamilyControlsModule.applyRestrictions...');
            const success = await FamilyControlsModule.applyRestrictions(selection);
            console.log('📱 Store: applyRestrictions result:', success);

            if (success) {
              // Convert string token to legacy format for storage/display
              const legacySelection = {
                applicationTokens: metadata?.applicationCount ? [{
                  id: selection,
                  bundleIdentifier: 'selected.apps',
                  displayName: `${metadata.applicationCount} Selected Apps`
                }] : [],
                categoryTokens: metadata?.categoryCount ? [{
                  id: selection,
                  bundleIdentifier: 'selected.categories',
                  displayName: `${metadata.categoryCount} Selected Categories`
                }] : [],
                webDomainTokens: metadata?.webDomainCount ? [{
                  id: selection,
                  bundleIdentifier: 'selected.domains',
                  displayName: `${metadata.webDomainCount} Selected Domains`
                }] : []
              };

              console.log('📱 Store: Generated legacySelection:', legacySelection);
              console.log('📱 Store: Updating store state...');

              set((state) => {
                console.log('📱 Store: Current state before update:', state.blocklist.settings.blockedApps);
                const newState = {
                  blocklist: {
                    ...state.blocklist,
                    settings: {
                      ...state.blocklist.settings,
                      blockedApps: legacySelection
                    }
                  }
                };
                console.log('📱 Store: New state after update:', newState.blocklist.settings.blockedApps);
                return newState;
              });

              // Verify the update
              console.log('📱 Store: Verifying update...');
              const updatedState = get();
              console.log('📱 Store: Final state:', updatedState.blocklist.settings.blockedApps);

              // Skip monitoring for now to avoid Swift crash
              // TODO: Implement proper monitoring once blocking is working
              console.log('📱 Store: Skipping monitoring to avoid crash (will implement later)');

              console.log('✅ Store: Blocked apps updated successfully');
            } else {
              throw new Error('Failed to apply restrictions via native module');
            }
          } catch (error) {
            console.error('❌ Store: Failed to update blocked apps:', error);
            throw error;
          }
        },

        updateSettings: (settingsUpdate: Partial<BlocklistSettings>) => {
          console.log('⚙️ Updating blocklist settings:', settingsUpdate);
          set((state) => ({
            blocklist: {
              ...state.blocklist,
              settings: {
                ...state.blocklist.settings,
                ...settingsUpdate
              }
            }
          }));
        },

        requestUnlock: async (appTokens: any[], duration: number) => {
          try {
            const { blocklist, rewards } = get();
            const totalCost = duration * blocklist.settings.unlockCostPerMinute;

            // Check if user has enough fruits
            if (rewards.balance < totalCost) {
              console.log('❌ Insufficient fruits for unlock');
              return null;
            }

            // Check daily unlock limit
            const dailyCount = blocklist.getDailyUnlockCount();
            if (dailyCount >= blocklist.settings.allowedUnlocksPerDay) {
              console.log('❌ Daily unlock limit exceeded');
              return null;
            }

            // Check maximum duration
            if (duration > blocklist.settings.maxUnlockDuration) {
              console.log('❌ Duration exceeds maximum allowed');
              return null;
            }

            console.log('🔓 Creating unlock session:', { duration, cost: totalCost });

            const sessionId = generateId();
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

            const unlockSession: UnlockSession = {
              id: sessionId,
              appTokens,
              startTime,
              endTime,
              duration,
              cost: totalCost,
              isActive: true,
              remainingTime: duration * 60
            };

            // Create unlock transaction
            const transaction: UnlockTransaction = {
              id: generateId(),
              sessionId,
              appTokens,
              duration,
              cost: totalCost,
              timestamp: new Date(),
              status: 'completed'
            };

            // Update state
            set((state) => ({
              blocklist: {
                ...state.blocklist,
                activeSessions: {
                  byId: { ...state.blocklist.activeSessions.byId, [sessionId]: unlockSession },
                  allIds: [...state.blocklist.activeSessions.allIds, sessionId]
                },
                transactions: {
                  byId: { ...state.blocklist.transactions.byId, [transaction.id]: transaction },
                  allIds: [...state.blocklist.transactions.allIds, transaction.id]
                }
              }
            }));

            // Spend fruits
            get().rewards.spendFruits(totalCost, 'app_unlock', { sessionId, duration, appTokens });

            // Call native module to temporarily remove restrictions
            const unlockSuccess = await FamilyControlsModule.temporaryUnlock(
              appTokens.map(token => token.id),
              duration
            );

            if (!unlockSuccess) {
              // Refund fruits if unlock failed
              get().rewards.earnFruits(totalCost, 'refund', { reason: 'unlock_failed', sessionId });
              console.log('❌ Native unlock failed, refunding fruits');
              return null;
            }

            console.log('✅ Unlock session created:', unlockSession);
            return unlockSession;
          } catch (error) {
            console.error('❌ Failed to create unlock session:', error);
            return null;
          }
        },

        endUnlock: (sessionId: string) => {
          console.log('🔒 Ending unlock session:', sessionId);
          const session = get().blocklist.activeSessions.byId[sessionId];

          if (session && session.isActive) {
            set((state) => ({
              blocklist: {
                ...state.blocklist,
                activeSessions: {
                  ...state.blocklist.activeSessions,
                  byId: {
                    ...state.blocklist.activeSessions.byId,
                    [sessionId]: { ...session, isActive: false, remainingTime: 0 }
                  }
                }
              }
            }));

            // Call native module to reapply restrictions
            FamilyControlsModule.reapplyRestrictions();

            console.log('🔒 Unlock session ended:', sessionId);
          }
        },

        checkActiveUnlocks: () => {
          const now = new Date();
          const { activeSessions } = get().blocklist;

          Object.values(activeSessions.byId).forEach(session => {
            if (session.isActive && now >= session.endTime) {
              console.log('⏰ Auto-ending expired unlock session:', session.id);
              get().blocklist.endUnlock(session.id);
            }
          });
        },

        getDailyUnlockCount: () => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const { transactions } = get().blocklist;
          return Object.values(transactions.byId).filter(transaction =>
            transaction.timestamp >= today && transaction.status === 'completed'
          ).length;
        },

        getRemainingUnlocks: () => {
          const { settings } = get().blocklist;
          const dailyCount = get().blocklist.getDailyUnlockCount();
          return Math.max(0, settings.allowedUnlocksPerDay - dailyCount);
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
export const useBlocklist = () => useAppStore((state) => state.blocklist);

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
  createCompletedSession: state.focus.createCompletedSession,
  setSelectedDate: state.focus.setSelectedDate,
  setViewMode: state.focus.setViewMode,
  goToPreviousWeek: state.focus.goToPreviousWeek,
  goToNextWeek: state.focus.goToNextWeek,
  goToCurrentWeek: state.focus.goToCurrentWeek,
  createTag: state.focus.createTag,
  updateTag: state.focus.updateTag,
  deleteTag: state.focus.deleteTag,
  addGoal: state.focus.addGoal,
  updateGoal: state.focus.updateGoal,
  deleteGoal: state.focus.deleteGoal,
  getActiveGoals: state.focus.getActiveGoals,
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
  earnFruits: state.rewards.earnFruits,
  spendFruits: state.rewards.spendFruits,
  unlockApp: state.rewards.unlockApp,
}));

export const useBlocklistActions = () => useAppStore((state) => ({
  checkAuthorizationStatus: state.blocklist.checkAuthorizationStatus,
  requestAuthorization: state.blocklist.requestAuthorization,
  updateBlockedApps: state.blocklist.updateBlockedApps,
  updateSettings: state.blocklist.updateSettings,
  requestUnlock: state.blocklist.requestUnlock,
  endUnlock: state.blocklist.endUnlock,
  checkActiveUnlocks: state.blocklist.checkActiveUnlocks,
  getDailyUnlockCount: state.blocklist.getDailyUnlockCount,
  getRemainingUnlocks: state.blocklist.getRemainingUnlocks,
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
  getTagByName: (name: string) => state.focus.tags.byName[name],
  getAllTags: () => Object.values(state.focus.tags.byName),
  getCompletedSessions: () => Object.values(state.focus.sessions.byId)
      .filter(Boolean),
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
    
    // Initialize default tags if none exist
    console.log('🔧 Checking tags state:', state.focus.tags);
    if (!state.focus.tags.allNames || state.focus.tags.allNames.length === 0) {
      console.log('🏷️ Initializing default tags...');
      const defaultTags = [
        { name: 'Work', icon: '💼' },
        { name: 'Study', icon: '📚' },
        { name: 'Reading', icon: '📖' },
        { name: 'Exercise', icon: '🏃' },
        { name: 'Creative', icon: '🎨' },
        { name: 'Personal', icon: '👤' },
      ];
      
      defaultTags.forEach(tag => {
        state.focus.createTag({ ...tag, isDefault: true });
      });
    }
    
    // Store is already using tagName for sessions, no migration needed
    
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