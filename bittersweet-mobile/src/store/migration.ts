/**
 * Store Migration Utility
 * Handles conversion from normalized structures to simple arrays
 * Requirements: 2.1, 2.2
 */

import { AppStore, FocusSession, Category, Task, RewardTransaction, UnlockableApp } from '../types/store';

// Migration version tracking
export const MIGRATION_VERSION = 2;
export const MIGRATION_KEY = 'bittersweet-migration-version';

// Legacy normalized structure interface
interface LegacyNormalizedState<T> {
    byId: Record<string, T>;
    allIds: string[];
    loading?: boolean;
    error?: string | null;
    lastUpdated?: Date | null;
}

interface LegacyFocusSlice {
    currentSession?: {
        session?: FocusSession;
        isRunning?: boolean;
        remainingTime?: number;
    };
    sessions?: LegacyNormalizedState<FocusSession>;
    categories?: LegacyNormalizedState<Category>;
    tags?: LegacyNormalizedState<any>;
    settings?: any;
    stats?: any;
}

interface LegacyTasksSlice {
    tasks?: LegacyNormalizedState<Task>;
    selectedDate?: Date | string;
    viewMode?: string;
    currentWeekStart?: Date | string;
}

interface LegacyRewardsSlice {
    balance?: number;
    totalEarned?: number;
    totalSpent?: number;
    transactions?: LegacyNormalizedState<RewardTransaction>;
    unlockableApps?: LegacyNormalizedState<UnlockableApp>;
}

interface LegacyStore {
    focus?: LegacyFocusSlice;
    tasks?: LegacyTasksSlice;
    rewards?: LegacyRewardsSlice;
    settings?: any;
    ui?: any;
    // Legacy slices that might exist
    homeSlice?: any;
    focusSlice?: any;
    tasksSlice?: any;
    rewardsSlice?: any;
}

/**
 * Convert normalized state to simple array
 */
function normalizedToArray<T>(normalized: LegacyNormalizedState<T> | undefined): T[] {
    if (!normalized || !normalized.byId || !normalized.allIds) {
        return [];
    }

    return normalized.allIds
        .map(id => normalized.byId[id])
        .filter(item => item !== undefined && item !== null);
}

/**
 * Ensure date fields are proper Date objects
 */
function ensureDate(value: any): Date {
    if (value instanceof Date) {
        return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? new Date() : date;
    }
    return new Date();
}

/**
 * Migrate focus slice from normalized to simple structure
 */
function migrateFocusSlice(legacy: LegacyFocusSlice | undefined): Partial<AppStore['focus']> {
    if (!legacy) {
        return {
            currentSession: null,
            sessions: [],
            categories: [],
            isRunning: false,
            timeRemaining: 0,
        };
    }

    // Migrate sessions
    const sessions = normalizedToArray(legacy.sessions).map(session => ({
        ...session,
        startTime: ensureDate(session.startTime),
        endTime: session.endTime ? ensureDate(session.endTime) : undefined,
        createdAt: ensureDate(session.createdAt),
        updatedAt: ensureDate(session.updatedAt),
        pauseHistory: (session.pauseHistory || []).map(pause => ({
            startTime: ensureDate(pause.startTime),
            endTime: ensureDate(pause.endTime),
        })),
    }));

    // Migrate categories
    const categories = normalizedToArray(legacy.categories).map(category => ({
        ...category,
        createdAt: ensureDate(category.createdAt),
        updatedAt: ensureDate(category.updatedAt),
    }));

    // Migrate current session
    let currentSession: FocusSession | null = null;
    let isRunning = false;
    let timeRemaining = 0;

    if (legacy.currentSession?.session) {
        currentSession = {
            ...legacy.currentSession.session,
            startTime: ensureDate(legacy.currentSession.session.startTime),
            endTime: legacy.currentSession.session.endTime
                ? ensureDate(legacy.currentSession.session.endTime)
                : undefined,
            createdAt: ensureDate(legacy.currentSession.session.createdAt),
            updatedAt: ensureDate(legacy.currentSession.session.updatedAt),
            pauseHistory: (legacy.currentSession.session.pauseHistory || []).map(pause => ({
                startTime: ensureDate(pause.startTime),
                endTime: ensureDate(pause.endTime),
            })),
        };
        isRunning = legacy.currentSession.isRunning || false;
        timeRemaining = legacy.currentSession.remainingTime || 0;
    }

    // Migrate settings with defaults
    const settings = {
        defaultDuration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsUntilLongBreak: 4,
        soundEnabled: true,
        vibrationEnabled: true,
        autoStartBreaks: false,
        autoStartSessions: false,
        ...legacy.settings,
    };

    return {
        currentSession,
        sessions,
        categories,
        settings,
        isRunning,
        timeRemaining,
    };
}

/**
 * Migrate tasks slice from normalized to simple structure
 */
function migrateTasksSlice(legacy: LegacyTasksSlice | undefined): Partial<AppStore['tasks']> {
    if (!legacy) {
        return {
            tasks: [],
            selectedDate: new Date(),
        };
    }

    // Migrate tasks
    const tasks = normalizedToArray(legacy.tasks).map(task => ({
        ...task,
        date: ensureDate(task.date),
        startTime: ensureDate(task.startTime),
        completedAt: task.completedAt ? ensureDate(task.completedAt) : undefined,
        createdAt: ensureDate(task.createdAt),
        updatedAt: ensureDate(task.updatedAt),
    }));

    // Migrate selected date
    const selectedDate = legacy.selectedDate ? ensureDate(legacy.selectedDate) : new Date();

    return {
        tasks,
        selectedDate,
    };
}

/**
 * Migrate rewards slice from normalized to simple structure
 */
function migrateRewardsSlice(legacy: LegacyRewardsSlice | undefined): Partial<AppStore['rewards']> {
    if (!legacy) {
        return {
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            transactions: [],
            unlockableApps: [],
        };
    }

    // Migrate transactions
    const transactions = normalizedToArray(legacy.transactions).map(transaction => ({
        ...transaction,
        createdAt: ensureDate(transaction.createdAt),
    }));

    // Migrate unlockable apps
    const unlockableApps = normalizedToArray(legacy.unlockableApps).map(app => ({
        ...app,
        lastUnlocked: app.lastUnlocked ? ensureDate(app.lastUnlocked) : undefined,
        createdAt: ensureDate(app.createdAt),
        updatedAt: ensureDate(app.updatedAt),
    }));

    return {
        balance: legacy.balance || 0,
        totalEarned: legacy.totalEarned || 0,
        totalSpent: legacy.totalSpent || 0,
        transactions,
        unlockableApps,
    };
}

/**
 * Migrate legacy homeSlice data to appropriate slices
 */
function migrateLegacyHomeSlice(homeSlice: any): {
    tasks: Task[];
    dailyGoals?: any;
} {
    if (!homeSlice) {
        return { tasks: [] };
    }

    const tasks: Task[] = [];

    // Migrate tasks from homeSlice
    if (Array.isArray(homeSlice.tasks)) {
        homeSlice.tasks.forEach((task: any) => {
            if (task && typeof task === 'object') {
                tasks.push({
                    id: task.id || `migrated-task-${Date.now()}-${Math.random()}`,
                    title: task.title || 'Untitled Task',
                    description: task.description,
                    categoryId: task.categoryId || 'default',
                    date: ensureDate(task.date || task.scheduledDate),
                    startTime: ensureDate(task.startTime || task.date),
                    duration: task.duration || task.estimatedTime || 30,
                    status: task.status || 'scheduled',
                    priority: task.priority || 'medium',
                    focusTimeSpent: task.focusTimeSpent || 0,
                    estimatedTime: task.estimatedTime || task.duration || 30,
                    completed: task.completed || false,
                    completedAt: task.completedAt ? ensureDate(task.completedAt) : undefined,
                    createdAt: ensureDate(task.createdAt),
                    updatedAt: ensureDate(task.updatedAt),
                });
            }
        });
    }

    return {
        tasks,
        dailyGoals: homeSlice.dailyGoals,
    };
}

/**
 * Main migration function
 */
export function migrateStore(legacyState: any): Partial<AppStore> {
    if (!legacyState || typeof legacyState !== 'object') {
        if (process.env.NODE_ENV === 'development') {
            console.log('🔄 No legacy state to migrate, using defaults');
        }
        return {};
    }

    if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Starting store migration from normalized to simplified structure');
        console.log('📊 Legacy state structure:', {
            hasHomeSlice: !!legacyState.homeSlice,
            hasFocusSlice: !!legacyState.focus || !!legacyState.focusSlice,
            hasTasksSlice: !!legacyState.tasks || !!legacyState.tasksSlice,
            hasRewardsSlice: !!legacyState.rewards || !!legacyState.rewardsSlice,
            hasSettings: !!legacyState.settings,
            topLevelKeys: Object.keys(legacyState),
        });
    }

    const migratedState: Partial<AppStore> = {};
    const migrationLog: string[] = [];

    try {
        // Handle legacy homeSlice first
        let legacyTasks: Task[] = [];
        if (legacyState.homeSlice) {
            if (process.env.NODE_ENV === 'development') {
                console.log('🔄 Migrating legacy homeSlice data');
            }
            const homeData = migrateLegacyHomeSlice(legacyState.homeSlice);
            legacyTasks = homeData.tasks;
            migrationLog.push(`Migrated ${legacyTasks.length} tasks from homeSlice`);
        }

        // Migrate focus slice
        const focusData = migrateFocusSlice(legacyState.focus || legacyState.focusSlice);
        if (focusData && Object.keys(focusData).length > 0) {
            migratedState.focus = focusData as any;
            const logMessage = `Migrated focus slice: ${focusData.sessions?.length || 0} sessions, ${focusData.categories?.length || 0} categories`;
            migrationLog.push(logMessage);

            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ ${logMessage}`);
                if (focusData.currentSession) {
                    console.log('📍 Active session found:', {
                        id: focusData.currentSession.id,
                        status: focusData.currentSession.status,
                        isRunning: focusData.isRunning,
                        timeRemaining: focusData.timeRemaining,
                    });
                }
            }
        }

        // Migrate tasks slice
        const tasksData = migrateTasksSlice(legacyState.tasks || legacyState.tasksSlice);
        if (tasksData && Object.keys(tasksData).length > 0) {
            // Merge with legacy homeSlice tasks
            if (legacyTasks.length > 0) {
                tasksData.tasks = [...(tasksData.tasks || []), ...legacyTasks];
                migrationLog.push(`Merged ${legacyTasks.length} tasks from homeSlice with ${(tasksData.tasks || []).length - legacyTasks.length} existing tasks`);
            }
            migratedState.tasks = tasksData as any;
            const logMessage = `Migrated tasks slice: ${tasksData.tasks?.length || 0} total tasks`;
            migrationLog.push(logMessage);

            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ ${logMessage}`);
            }
        }

        // Migrate rewards slice
        const rewardsData = migrateRewardsSlice(legacyState.rewards || legacyState.rewardsSlice);
        if (rewardsData && Object.keys(rewardsData).length > 0) {
            migratedState.rewards = rewardsData as any;
            const logMessage = `Migrated rewards slice: balance ${rewardsData.balance}, ${rewardsData.transactions?.length || 0} transactions, ${rewardsData.unlockableApps?.length || 0} apps`;
            migrationLog.push(logMessage);

            if (process.env.NODE_ENV === 'development') {
                console.log(`✅ ${logMessage}`);
            }
        }

        // Migrate settings
        if (legacyState.settings) {
            migratedState.settings = {
                settings: {
                    theme: 'system',
                    language: 'en',
                    notifications: {
                        enabled: true,
                        sessionReminders: true,
                        breakReminders: true,
                        dailyGoals: true,
                        weeklyReports: false,
                    },
                    privacy: {
                        shareStats: false,
                        allowFriendRequests: true,
                        showOnlineStatus: false,
                    },
                    focus: {
                        defaultDuration: 25,
                        breakDuration: 5,
                        longBreakDuration: 15,
                        sessionsUntilLongBreak: 4,
                        soundEnabled: true,
                        vibrationEnabled: true,
                        autoStartBreaks: false,
                        autoStartSessions: false,
                    },
                    ...legacyState.settings,
                },
            } as any;
            migrationLog.push('Migrated settings slice with defaults');

            if (process.env.NODE_ENV === 'development') {
                console.log('✅ Migrated settings slice');
            }
        }

        // UI slice is not migrated as it's runtime state
        migratedState.ui = {
            isHydrated: false,
            isLoading: false,
            errors: [],
        } as any;

        if (process.env.NODE_ENV === 'development') {
            console.log('✅ Store migration completed successfully');
            console.log('📋 Migration summary:', migrationLog);
        }

        return migratedState;

    } catch (error) {
        console.error('❌ Store migration failed:', error);
        console.error('📋 Migration log before failure:', migrationLog);

        // Return default state on migration failure
        const defaultState = createDefaultState();
        console.log('🔄 Falling back to default state due to migration failure');
        return defaultState;
    }
}

/**
 * Check if migration is needed
 */
export function needsMigration(state: any): boolean {
    if (!state || typeof state !== 'object') {
        return false;
    }

    // Check for normalized structures
    const hasNormalizedStructures =
        (state.focus?.sessions?.byId && state.focus?.sessions?.allIds) ||
        (state.focus?.categories?.byId && state.focus?.categories?.allIds) ||
        (state.tasks?.tasks?.byId && state.tasks?.tasks?.allIds) ||
        (state.rewards?.transactions?.byId && state.rewards?.transactions?.allIds) ||
        state.homeSlice ||
        state.focusSlice ||
        state.tasksSlice ||
        state.rewardsSlice;

    return Boolean(hasNormalizedStructures);
}

/**
 * Validate migrated data integrity
 */
export function validateMigratedData(state: Partial<AppStore>): {
    isValid: boolean;
    issues: string[];
} {
    const issues: string[] = [];

    // Validate focus slice
    if (state.focus) {
        if (!Array.isArray(state.focus.sessions)) {
            issues.push('Focus sessions is not an array');
        }
        if (!Array.isArray(state.focus.categories)) {
            issues.push('Focus categories is not an array');
        }

        // Validate session data
        state.focus.sessions?.forEach((session, index) => {
            if (!session.id) issues.push(`Session ${index} missing id`);
            if (!(session.startTime instanceof Date)) issues.push(`Session ${index} startTime is not a Date`);
            if (!session.categoryId) issues.push(`Session ${index} missing categoryId`);
        });

        // Validate category data
        state.focus.categories?.forEach((category, index) => {
            if (!category.id) issues.push(`Category ${index} missing id`);
            if (!category.name) issues.push(`Category ${index} missing name`);
        });
    }

    // Validate tasks slice
    if (state.tasks) {
        if (!Array.isArray(state.tasks.tasks)) {
            issues.push('Tasks is not an array');
        }

        state.tasks.tasks?.forEach((task, index) => {
            if (!task.id) issues.push(`Task ${index} missing id`);
            if (!task.title) issues.push(`Task ${index} missing title`);
            if (!(task.date instanceof Date)) issues.push(`Task ${index} date is not a Date`);
        });
    }

    // Validate rewards slice
    if (state.rewards) {
        if (!Array.isArray(state.rewards.transactions)) {
            issues.push('Reward transactions is not an array');
        }
        if (typeof state.rewards.balance !== 'number') {
            issues.push('Reward balance is not a number');
        }
    }

    return {
        isValid: issues.length === 0,
        issues,
    };
}

/**
 * Create default store state for new installations
 */
export function createDefaultState(): Partial<AppStore> {
    return {
        focus: {
            currentSession: null,
            sessions: [],
            categories: [],
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
            isRunning: false,
            timeRemaining: 0,
        } as any,
        tasks: {
            tasks: [],
            selectedDate: new Date(),
        } as any,
        rewards: {
            balance: 0,
            totalEarned: 0,
            totalSpent: 0,
            transactions: [],
            unlockableApps: [],
        } as any,
        settings: {
            settings: {
                theme: 'system',
                language: 'en',
                notifications: {
                    enabled: true,
                    sessionReminders: true,
                    breakReminders: true,
                    dailyGoals: true,
                    weeklyReports: false,
                },
                privacy: {
                    shareStats: false,
                    allowFriendRequests: true,
                    showOnlineStatus: false,
                },
                focus: {
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
        } as any,
        ui: {
            isHydrated: false,
            isLoading: false,
            errors: [],
        } as any,
    };
}