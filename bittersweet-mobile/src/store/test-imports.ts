/**
 * Test file to check if all imports work correctly
 */

// Test individual slice imports
import { createAuthSlice } from './slices/authSlice';
import { createFocusSlice } from './slices/focusSlice';
import { createTasksSlice } from './slices/tasksSlice';
import { createRewardsSlice } from './slices/rewardsSlice';
import { createSocialSlice } from './slices/socialSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createUISlice } from './slices/uiSlice';

// Test middleware imports
import { 
  createStoreMiddleware,
  performanceMiddleware,
  errorHandlingMiddleware,
  loggingMiddleware
} from './middleware';

// Test utility imports
import { createNormalizedState } from './utils/entityManager';
import { storeEventBus, createEventEmitter, createEventListener } from './utils/eventBus';

// Test types import
import { RootStore } from './types';

console.log('All imports successful:', {
  createAuthSlice: typeof createAuthSlice,
  createFocusSlice: typeof createFocusSlice,
  createTasksSlice: typeof createTasksSlice,
  createRewardsSlice: typeof createRewardsSlice,
  createSocialSlice: typeof createSocialSlice,
  createSettingsSlice: typeof createSettingsSlice,
  createUISlice: typeof createUISlice,
  createStoreMiddleware: typeof createStoreMiddleware,
  createNormalizedState: typeof createNormalizedState,
  storeEventBus: typeof storeEventBus,
});

export { 
  createAuthSlice,
  createFocusSlice,
  createTasksSlice,
  createRewardsSlice,
  createSocialSlice,
  createSettingsSlice,
  createUISlice,
};