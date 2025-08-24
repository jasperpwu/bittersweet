/**
 * Test file to verify store implementation
 */

import { useAppStore } from './index';

// Test basic store functionality
export function testStoreImplementation() {
  console.log('🧪 Testing store implementation...');
  
  try {
    const store = useAppStore.getState();
    
    // Test auth slice
    console.log('Auth slice:', {
      user: store.auth.user,
      isAuthenticated: store.auth.isAuthenticated,
      hasLoginAction: typeof store.auth.login === 'function',
    });
    
    // Test focus slice
    console.log('Focus slice:', {
      sessionsCount: store.focus.sessions.allIds.length,
      categoriesCount: store.focus.categories.allIds.length,
      hasStartSessionAction: typeof store.focus.startSession === 'function',
    });
    
    // Test tasks slice
    console.log('Tasks slice:', {
      tasksCount: store.tasks.tasks.allIds.length,
      selectedDate: store.tasks.selectedDate,
      viewMode: store.tasks.viewMode,
      hasCreateTaskAction: typeof store.tasks.createTask === 'function',
    });
    
    // Test UI slice
    console.log('UI slice:', {
      isHydrated: store.ui.isHydrated,
      modalsCount: Object.keys(store.ui.modals).length,
      errorsCount: store.ui.errors.length,
      hasShowModalAction: typeof store.ui.showModal === 'function',
    });
    
    console.log('✅ Store implementation test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Store implementation test failed:', error);
    return false;
  }
}