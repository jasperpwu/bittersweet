/**
 * Simple test store to verify Zustand is working
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface SimpleStore {
  count: number;
  tasks: Array<{ id: string; title: string; }>;
  increment: () => void;
  createTask: (title: string) => void;
}

export const useSimpleStore = create<SimpleStore>()(
  devtools(
    (set, get) => ({
      count: 0,
      tasks: [],
      
      increment: () => set((state) => ({ count: state.count + 1 })),
      
      createTask: (title: string) => {
        const newTask = {
          id: `task-${Date.now()}`,
          title,
        };
        
        set((state) => ({
          tasks: [...state.tasks, newTask]
        }));
        
        console.log('✅ Task created in simple store:', newTask);
      },
    }),
    { name: 'simple-store' }
  )
);

// Test the store immediately
setTimeout(() => {
  const state = useSimpleStore.getState();
  console.log('🧪 Simple store test:', {
    hasState: !!state,
    count: state?.count,
    tasksLength: state?.tasks?.length,
    hasCreateTask: typeof state?.createTask === 'function'
  });
  
  // Test creating a task
  if (state?.createTask) {
    state.createTask('Test Task');
    const updatedState = useSimpleStore.getState();
    console.log('🧪 After creating task:', {
      tasksLength: updatedState?.tasks?.length,
      lastTask: updatedState?.tasks?.[updatedState.tasks.length - 1]
    });
  }
}, 100);