/**
 * Initialize store with mock data for development and testing
 */

import { useAppStore } from './index';
import { getMockData } from './mockData';

/**
 * Initializes the store with comprehensive mock data
 * Only adds mock data if the store is empty (preserves existing data)
 */
export const initializeStoreWithMockData = () => {
  const mockData = getMockData();
  const currentState = useAppStore.getState();

  try {
    console.log('🎭 Checking if store needs mock data initialization...');
    
    // Check if we already have data (tags or sessions)
    const hasExistingTags = (currentState.focus.tags.allIds || []).length > 0;
    const hasExistingSessions = (currentState.focus.sessions.allIds || []).length > 0;

    if (hasExistingTags || hasExistingSessions) {
      console.log('✅ Store already has data, skipping mock data initialization');
      console.log(`  - Existing tags: ${hasExistingTags ? (currentState.focus.tags.allIds || []).length : 0}`);
      console.log(`  - Existing sessions: ${hasExistingSessions ? (currentState.focus.sessions.allIds || []).length : 0}`);
      return true;
    }
    
    console.log('📊 Store is empty, initializing with mock data...');
    console.log('👤 Mock user:', mockData.user?.name || 'UNDEFINED');
    console.log('📊 Mock data keys:', Object.keys(mockData));

    // Initialize focus data
    const focusUpdates: any = {
      sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: new Date() },
      tags: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: new Date() },
      currentSession: {
        isRunning: false,
        session: null,
        startTime: null,
        elapsedTime: 0,
        remainingTime: 0,
      },
    };

    // Add tags
    console.log('🔖 Adding tags:', mockData.focusTags?.length || 0);
    if (mockData.focusTags) {
      mockData.focusTags.forEach(tag => {
        const tagId = tag.id || `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
        const tagWithId = { ...tag, id: tagId };
        focusUpdates.tags.byId[tagId] = tagWithId;
        focusUpdates.tags.allIds.push(tagId);
      });
    }

    // Add sessions
    console.log('⏱️  Adding sessions:', mockData.focusSessions?.length || 0);
    if (mockData.focusSessions) {
      mockData.focusSessions.forEach((session: any) => {
        // Ensure session uses tagId (not tagName)
        if (session.tagName && !session.tagId) {
          session.tagId = session.tagName;
          delete session.tagName;
        }
        focusUpdates.sessions.byId[session.id] = session;
        focusUpdates.sessions.allIds.push(session.id);
      });
    }

    useAppStore.setState((state) => ({
      focus: {
        ...state.focus,
        ...focusUpdates,
      },
    }));

    console.log('✅ Mock data initialization completed!');
    console.log('🎭 Demo user:', mockData.user?.name || 'N/A', `(${mockData.user?.email || 'N/A'})`);
    console.log('📊 Sample data loaded:');
    console.log(`  - ${(mockData.focusTags || []).length} focus tags`);
    console.log(`  - ${(mockData.focusSessions || []).length} focus sessions`);

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize mock data:', error);
    return false;
  }
};

/**
 * Check if the store should be initialized with mock data
 * This can be controlled via environment variables or other flags
 */
export const shouldInitializeMockData = (): boolean => {
  // Check if we're in development and want mock data
  if (process.env.NODE_ENV === 'development') {
    // You can add more sophisticated logic here, e.g.:
    // - Check AsyncStorage for a flag
    // - Check environment variables  
    // - Check if user is already logged in
    return true;
  }
  
  return false;
};

/**
 * Auto-initialize mock data if conditions are met
 * Waits for store to be properly hydrated before checking
 */
export const autoInitializeMockData = () => {
  if (!shouldInitializeMockData()) return;

  const doInit = () => {
    console.log('🔧 Store is hydrated, checking for mock data initialization...');
    initializeStoreWithMockData();
  };

  // Use zustand persist's hasHydrated API for a reliable hydration check
  if (useAppStore.persist.hasHydrated()) {
    doInit();
  } else {
    // Wait for hydration to finish via the official callback
    useAppStore.persist.onFinishHydration(doInit);
  }
};