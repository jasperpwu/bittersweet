/**
 * Demo script to test core domain slices functionality
 */

import { useAppStore } from './index';

export async function runStoreDemo() {
  console.log('🚀 Starting store demo...');
  
  const store = useAppStore.getState();
  
  try {
    // Test 1: User Authentication
    console.log('\n📝 Test 1: User Authentication');
    console.log('Initial auth state:', {
      isAuthenticated: store.auth.isAuthenticated,
      user: store.auth.user?.email || 'None',
    });
    
    // Login user
    await store.auth.login({
      email: 'demo@bittersweet.app',
      password: 'password123',
    });
    
    console.log('After login:', {
      isAuthenticated: store.auth.isAuthenticated,
      user: store.auth.user?.email || 'None',
      hasToken: !!store.auth.authToken,
    });
    
    // Test 2: Focus Categories
    console.log('\n📝 Test 2: Focus Categories');
    const categories = store.focus.categories;
    console.log('Categories count:', categories.allIds.length);
    
    if (categories.allIds.length > 0) {
      const firstCategory = categories.byId[categories.allIds[0]];
      console.log('First category:', {
        name: firstCategory.name,
        color: firstCategory.color,
        icon: firstCategory.icon,
      });
    }
    
    // Test 3: Create a Task
    console.log('\n📝 Test 3: Create a Task');
    const workCategoryId = categories.allIds.find(id => 
      categories.byId[id].name === 'Work'
    );
    
    if (workCategoryId) {
      store.tasks.createTask({
        title: 'Complete project documentation',
        description: 'Write comprehensive documentation for the new feature',
        categoryId: workCategoryId,
        date: new Date(),
        startTime: new Date(),
        duration: 60,
        status: 'scheduled',
        priority: 'high',
        userId: store.auth.user!.id,
      });
      
      const tasks = store.tasks.tasks;
      console.log('Tasks created:', tasks.allIds.length);
      
      if (tasks.allIds.length > 0) {
        const firstTask = tasks.byId[tasks.allIds[0]];
        console.log('First task:', {
          title: firstTask.title,
          duration: firstTask.duration,
          status: firstTask.status,
          progress: firstTask.progress,
        });
      }
    }
    
    // Test 4: Start Focus Session
    console.log('\n📝 Test 4: Start Focus Session');
    if (workCategoryId) {
      store.focus.startSession({
        targetDuration: 25,
        categoryId: workCategoryId,
        tagIds: [],
        description: 'Working on documentation',
      });
      
      const currentSession = store.focus.currentSession;
      console.log('Focus session started:', {
        isRunning: currentSession.isRunning,
        targetDuration: currentSession.session?.targetDuration,
        remainingTime: currentSession.remainingTime,
      });
      
      // Simulate session completion after 2 seconds
      setTimeout(() => {
        console.log('\n📝 Test 5: Complete Focus Session');
        store.focus.completeSession();
        
        const sessions = store.focus.sessions;
        console.log('Sessions completed:', sessions.allIds.length);
        
        if (sessions.allIds.length > 0) {
          const completedSession = sessions.byId[sessions.allIds[0]];
          console.log('Completed session:', {
            status: completedSession.status,
            duration: completedSession.duration,
            seedsEarned: completedSession.seedsEarned,
          });
        }
        
        // Check rewards balance
        console.log('Rewards balance:', store.rewards.balance);
        
        console.log('\n✅ Store demo completed successfully!');
      }, 2000);
    }
    
  } catch (error) {
    console.error('❌ Store demo failed:', error);
  }
}

// Export for testing
export { testStoreImplementation } from './test-store';