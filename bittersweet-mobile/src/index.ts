// Main src index file
export * from './components';
export * from './utils';
export * from './config';

// Selective exports to avoid conflicts
export { AuthService, FocusService } from './services/api';

// Export hooks with specific naming to avoid conflicts
export * from './hooks/focus';
export * from './hooks/common';
export { useAuth as useAuthHook } from './hooks/auth';

// Export store with priority (this will override any conflicting names)
export * from './store';

export type { User, FocusSession as FocusSessionType, Reward } from './types/models';