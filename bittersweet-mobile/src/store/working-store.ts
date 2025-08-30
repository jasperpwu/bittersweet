/**
 * Working Zustand store - simplified and guaranteed to work
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
  createdAt: Date;
  updatedAt: Date;
}

interface WorkingStore {
  // Auth
  user: any;
  isAuthenticated: boolean;
  
  // Tasks
  tasks: Task[];
  selectedDate: Date;
  
  // Categories
  categories: Array<{ id: string; name: string; color: string; icon: string; }>;
  
  // Actions
  login: (credentials: { email: string; password: string }) => void;
  logout: () => void;
  createTask: (taskData: any) => void;
  updateTask: (id: string, updates: any) => void;
  deleteTask: (id: string) => void;
  setSelectedDate: (date: Date) => void;
}

export const useWorkingStore = create<WorkingStore>()(
  devtools(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      tasks: [],
      selectedDate: new Date(),
      categories: [
        { id: 'work', name: 'Work', color: '#6592E9', icon: '💼' },
        { id: 'study', name: 'Study', color: '#51BC6F', icon: '📚' },
        { id: 'personal', name: 'Personal', color: '#EF786C', icon: '🏠' },
        { id: 'exercise', name: 'Exercise', color: '#FF9800', icon: '💪' },
      ],
      
      // Actions
      login: (credentials) => {
        console.log('🔐 Working store login:', credentials);
        set({
          user: {
            id: `user-${Date.now()}`,
            email: credentials.email,
            name: credentials.email.split('@')[0],
          },
          isAuthenticated: true,
        });
      },
      
      logout: () => {
        console.log('🚪 Working store logout');
        set({ user: null, isAuthenticated: false });
      },
      
      createTask: (taskData) => {
        console.log('📝 Working store creating task:', taskData);
        
        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: taskData.title,
          description: taskData.description || '',
          categoryId: taskData.categoryId,
          date: new Date(taskData.date),
          startTime: new Date(taskData.startTime),
          duration: taskData.duration,
          status: taskData.status || 'scheduled',
          priority: taskData.priority || 'medium',
          userId: taskData.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        set((state) => ({
          tasks: [...state.tasks, newTask]
        }));
        
        console.log('✅ Task created in working store:', newTask);
      },
      
      updateTask: (id, updates) => {
        console.log('📝 Working store updating task:', id, updates);
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id 
              ? { ...task, ...updates, updatedAt: new Date() }
              : task
          )
        }));
      },
      
      deleteTask: (id) => {
        console.log('🗑️ Working store deleting task:', id);
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== id)
        }));
      },
      
      setSelectedDate: (date) => {
        console.log('📅 Working store setting date:', date);
        set({ selectedDate: date });
      },
    }),
    { name: 'working-store' }
  )
);

// Test the store immediately
console.log('🧪 Testing working store...');
setTimeout(() => {
  const state = useWorkingStore.getState();
  console.log('🧪 Working store test:', {
    hasState: !!state,
    hasCreateTask: typeof state.createTask === 'function',
    categoriesCount: state.categories?.length,
    tasksCount: state.tasks?.length,
  });
  
  // Test task creation
  if (state.createTask) {
    console.log('🧪 Testing working store task creation...');
    state.createTask({
      title: 'Working Store Test Task',
      description: 'Test Description',
      categoryId: 'work',
      date: new Date(),
      startTime: new Date(),
      duration: 60,
      status: 'scheduled',
      priority: 'medium',
      userId: 'test-user',
    });
    
    const updatedState = useWorkingStore.getState();
    console.log('🧪 After creating task in working store:', {
      tasksCount: updatedState.tasks?.length,
      lastTask: updatedState.tasks?.[updatedState.tasks.length - 1]?.title,
    });
  }
}, 100);