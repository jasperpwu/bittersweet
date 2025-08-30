/**
 * Minimal working store to replace the complex one
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

interface MinimalStore {
  // Auth
  user: any;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  
  // Tasks
  tasks: Task[];
  selectedDate: Date;
  viewMode: 'day' | 'week' | 'month';
  currentWeekStart: Date;
  
  // Task actions
  createTask: (taskData: any) => void;
  updateTask: (id: string, updates: any) => void;
  deleteTask: (id: string) => void;
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  
  // Focus categories (minimal)
  categories: Array<{ id: string; name: string; color: string; icon: string; }>;
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

export const useMinimalStore = create<MinimalStore>()(
  devtools(
    (set, get) => ({
      // Auth state
      user: null,
      isAuthenticated: false,
      
      // Tasks state
      tasks: [],
      selectedDate: new Date(),
      viewMode: 'day',
      currentWeekStart: getWeekStart(),
      
      // Categories
      categories: [
        { id: 'work', name: 'Work', color: '#6592E9', icon: '💼' },
        { id: 'study', name: 'Study', color: '#51BC6F', icon: '📚' },
        { id: 'personal', name: 'Personal', color: '#EF786C', icon: '🏠' },
        { id: 'exercise', name: 'Exercise', color: '#FF9800', icon: '💪' },
      ],
      
      // Auth actions
      login: async (credentials) => {
        console.log('🔐 Minimal store login:', credentials);
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
        console.log('🚪 Minimal store logout');
        set({
          user: null,
          isAuthenticated: false,
        });
      },
      
      // Task actions
      createTask: (taskData) => {
        console.log('📝 Minimal store creating task:', taskData);
        
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
        
        console.log('✅ Task created successfully in minimal store:', newTask);
      },
      
      updateTask: (id, updates) => {
        console.log('📝 Updating task:', id, updates);
        set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === id 
              ? { ...task, ...updates, updatedAt: new Date() }
              : task
          )
        }));
      },
      
      deleteTask: (id) => {
        console.log('🗑️ Deleting task:', id);
        set((state) => ({
          tasks: state.tasks.filter(task => task.id !== id)
        }));
      },
      
      setSelectedDate: (date) => {
        console.log('📅 Setting selected date:', date);
        set({ selectedDate: date });
      },
      
      setViewMode: (mode) => {
        console.log('👁️ Setting view mode:', mode);
        set({ viewMode: mode });
      },
      
      goToPreviousWeek: () => {
        console.log('⬅️ Going to previous week');
        set((state) => {
          const newWeekStart = new Date(state.currentWeekStart);
          newWeekStart.setDate(newWeekStart.getDate() - 7);
          return { currentWeekStart: newWeekStart };
        });
      },
      
      goToNextWeek: () => {
        console.log('➡️ Going to next week');
        set((state) => {
          const newWeekStart = new Date(state.currentWeekStart);
          newWeekStart.setDate(newWeekStart.getDate() + 7);
          return { currentWeekStart: newWeekStart };
        });
      },
      
      goToCurrentWeek: () => {
        console.log('📍 Going to current week');
        set({ currentWeekStart: getWeekStart() });
      },
    }),
    { name: 'minimal-store' }
  )
);

// Test the store immediately
console.log('🧪 Testing minimal store...');
setTimeout(() => {
  const state = useMinimalStore.getState();
  console.log('🧪 Minimal store state:', {
    hasState: !!state,
    hasUser: !!state.user,
    tasksLength: state.tasks?.length,
    hasCreateTask: typeof state.createTask === 'function',
    categoriesLength: state.categories?.length,
  });
  
  // Test creating a task
  if (state.createTask) {
    console.log('🧪 Testing task creation...');
    state.createTask({
      title: 'Test Task',
      description: 'Test Description',
      categoryId: 'work',
      date: new Date(),
      startTime: new Date(),
      duration: 60,
      status: 'scheduled',
      priority: 'medium',
      userId: 'test-user',
    });
    
    const updatedState = useMinimalStore.getState();
    console.log('🧪 After creating task:', {
      tasksLength: updatedState.tasks?.length,
      lastTask: updatedState.tasks?.[updatedState.tasks.length - 1]?.title,
    });
  }
}, 100);