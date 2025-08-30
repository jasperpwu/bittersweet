/**
 * Enhanced Tasks slice with focus session linking and improved relationship management
 * Addresses Requirements: 2.1, 2.2, 3.3, 4.2, 4.3, 5.1, 5.2, 8.2, 9.2, 9.3, 9.4
 */

import { TasksSlice, Task, TaskProgress } from '../types';
import { createNormalizedState, EntityManager, updateNormalizedState } from '../utils/entityManager';
import { createEventEmitter, createEventListener, STORE_EVENTS } from '../utils/eventBus';

export function createTasksSlice(set: any, get: any, api: any): TasksSlice {
  if (__DEV__) {
    console.log('🔧 Creating tasks slice...');
  }
  
  const eventEmitter = createEventEmitter('tasks');
  const eventListener = createEventListener();
  
  // Listen for focus session completion to update task progress
  eventListener.on(STORE_EVENTS.FOCUS_SESSION_COMPLETED, (event) => {
    const { sessionId, duration } = event.payload;
    
    // Find task linked to this session
    const tasks = get().tasks.tasks;
    const linkedTask = tasks.allIds
      .map(id => tasks.byId[id])
      .filter(Boolean)
      .find(task => task.focusSessionIds.includes(sessionId));
    
    if (linkedTask) {
      // Update task progress with focus time
      const updatedProgress: TaskProgress = {
        ...linkedTask.progress,
        focusTimeSpent: linkedTask.progress.focusTimeSpent + duration,
        actualTime: linkedTask.progress.actualTime + duration,
      };
      
      get().tasks.updateTask(linkedTask.id, { progress: updatedProgress });
      
      if (__DEV__) {
        console.log(`✅ Task progress updated for ${linkedTask.title}: +${duration} minutes`);
      }
    }
  });
  
  const slice = {
    // Normalized State
    tasks: createNormalizedState<Task>(),
    
    // UI State
    selectedDate: new Date(),
    viewMode: 'day' as const,
    currentWeekStart: (() => {
      const today = new Date();
      const currentDay = today.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    })(),
    
    // Actions
    createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'focusSessionIds'>) => {
      const state = get();
      const currentUser = state?.auth?.user;
      
      // Allow task creation in development even without a logged-in user
      if (!currentUser && !__DEV__) {
        throw new Error('User must be logged in to create tasks');
      }
      
      // Validate task data
      if (!task.title || task.title.trim().length === 0) {
        throw new Error('Task title is required');
      }
      
      if (task.title.length > 200) {
        throw new Error('Task title cannot exceed 200 characters');
      }
      
      if (!task.categoryId) {
        throw new Error('Task category is required');
      }
      
      if (task.duration <= 0) {
        throw new Error('Task duration must be greater than 0');
      }
      
      if (task.duration > 480) {
        throw new Error('Task duration cannot exceed 8 hours');
      }
      
      // Check if category exists in focus store
      const category = get().focus?.getCategoryById(task.categoryId);
      if (!category) {
        throw new Error('Selected category does not exist');
      }
      
      const newTask: Task = {
        ...task,
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        userId: task.userId || currentUser?.id || 'unknown-user',
        progress: {
          completed: false,
          focusTimeSpent: 0,
          estimatedTime: task.duration,
          actualTime: 0,
        },
        focusSessionIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      set((state: any) => {
        state.tasks.tasks = updateNormalizedState(
          state.tasks.tasks,
          (manager) => manager.add(newTask)
        );
      });
      
      // Emit task created event
      eventEmitter.emit(STORE_EVENTS.TASK_CREATED, {
        taskId: newTask.id,
        title: newTask.title,
        categoryId: newTask.categoryId,
      });
      
      if (__DEV__) {
        console.log('✅ Task created:', newTask.title);
      }
    },
    
    updateTask: (id: string, updates: Partial<Task>) => {
      const currentTask = get().tasks.getTaskById(id);
      if (!currentTask) {
        throw new Error('Task not found');
      }
      
      const updatedTask = {
        ...updates,
        updatedAt: new Date(),
      };
      
      set((state: any) => {
        state.tasks.tasks = updateNormalizedState(
          state.tasks.tasks,
          (manager) => manager.update(id, updatedTask)
        );
      });
      
      // Emit task updated event
      eventEmitter.emit(STORE_EVENTS.TASK_UPDATED, {
        taskId: id,
        updates,
      });
      
      if (__DEV__) {
        console.log('✅ Task updated:', id);
      }
    },
    
    deleteTask: (id: string) => {
      const currentTask = get().tasks.getTaskById(id);
      if (!currentTask) {
        throw new Error('Task not found');
      }
      
      set((state: any) => {
        state.tasks.tasks = updateNormalizedState(
          state.tasks.tasks,
          (manager) => manager.remove(id)
        );
      });
      
      // Emit task deleted event
      eventEmitter.emit(STORE_EVENTS.TASK_DELETED, {
        taskId: id,
        title: currentTask.title,
      });
      
      if (__DEV__) {
        console.log('✅ Task deleted:', currentTask.title);
      }
    },
    
    startTask: (id: string) => {
      const currentTask = get().tasks.getTaskById(id);
      if (!currentTask) {
        throw new Error('Task not found');
      }
      
      if (currentTask.status === 'active') {
        throw new Error('Task is already active');
      }
      
      // Check if there's another active task
      const tasks = get().tasks.tasks;
      const activeTask = tasks.allIds
        .map(id => tasks.byId[id])
        .filter(Boolean)
        .find(task => task.status === 'active');
      
      if (activeTask) {
        throw new Error('Another task is already active. Complete or cancel it first.');
      }
      
      get().tasks.updateTask(id, { 
        status: 'active',
        progress: {
          ...currentTask.progress,
          // Reset actual time when starting
        }
      });
      
      // Emit task started event
      eventEmitter.emit(STORE_EVENTS.TASK_STARTED, {
        taskId: id,
        title: currentTask.title,
      });
      
      if (__DEV__) {
        console.log('✅ Task started:', currentTask.title);
      }
    },
    
    completeTask: (id: string) => {
      const currentTask = get().tasks.getTaskById(id);
      if (!currentTask) {
        throw new Error('Task not found');
      }
      
      const completedProgress: TaskProgress = {
        ...currentTask.progress,
        completed: true,
        completedAt: new Date(),
      };
      
      get().tasks.updateTask(id, { 
        status: 'completed',
        progress: completedProgress,
      });
      
      // Emit task completed event for cross-store communication
      eventEmitter.emit(STORE_EVENTS.TASK_COMPLETED, {
        taskId: id,
        focusTime: currentTask.progress.focusTimeSpent,
      });
      
      if (__DEV__) {
        console.log('✅ Task completed:', currentTask.title);
      }
    },
    
    // UI Actions
    setSelectedDate: (date: Date) => {
      if (__DEV__) {
        console.log('🔧 setSelectedDate called with:', date);
      }
      set((state: any) => ({
        ...state,
        tasks: {
          ...state.tasks,
          selectedDate: date,
        },
      }));
    },
    
    setViewMode: (mode: 'day' | 'week' | 'month') => {
      set((state: any) => ({
        ...state,
        tasks: {
          ...state.tasks,
          viewMode: mode,
        },
      }));
    },

    // Week Navigation Actions
    goToPreviousWeek: () => {
      set((state: any) => {
        const currentWeekStart = new Date(state.tasks.currentWeekStart);
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        
        return {
          ...state,
          tasks: {
            ...state.tasks,
            currentWeekStart,
          },
        };
      });
    },

    goToNextWeek: () => {
      set((state: any) => {
        const currentWeekStart = new Date(state.tasks.currentWeekStart);
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        
        return {
          ...state,
          tasks: {
            ...state.tasks,
            currentWeekStart,
          },
        };
      });
    },

    goToCurrentWeek: () => {
      set((state: any) => {
        const today = new Date();
        const currentDay = today.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);
        
        return {
          ...state,
          tasks: {
            ...state.tasks,
            currentWeekStart: weekStart,
          },
        };
      });
    },
    
    // Selectors
    getTaskById: (id: string) => {
      try {
        const tasks = get().tasks.tasks;
        return tasks.byId[id];
      } catch (error) {
        console.error('Error in getTaskById:', error);
        return undefined;
      }
    },
    
    getTasksForDate: (date: Date) => {
      try {
        const tasks = get().tasks.tasks;
        const manager = new EntityManager(tasks);
        
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        return tasks.allIds
          .map(id => tasks.byId[id])
          .filter(Boolean)
          .filter(task => {
            const taskDate = new Date(task.date);
            return taskDate >= startOfDay && taskDate <= endOfDay;
          }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      } catch (error) {
        console.error('Error in getTasksForDate:', error);
        return [];
      }
    },
    
    getActiveTask: () => {
      try {
        const tasks = get().tasks.tasks;
        return tasks.allIds
          .map(id => tasks.byId[id])
          .filter(Boolean)
          .find(task => task.status === 'active') || null;
      } catch (error) {
        console.error('Error in getActiveTask:', error);
        return null;
      }
    },
    
    getTasksForDateRange: (start: Date, end: Date) => {
      try {
        const tasks = get().tasks.tasks;
        const manager = new EntityManager(tasks);
        
        return tasks.allIds
          .map(id => tasks.byId[id])
          .filter(Boolean)
          .filter(task => {
            const taskDate = new Date(task.date);
            return taskDate >= start && taskDate <= end;
          }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      } catch (error) {
        console.error('Error in getTasksForDateRange:', error);
        return [];
      }
    },
    
    // Integration with Focus
    linkTaskToSession: (taskId: string, sessionId: string) => {
      const currentTask = get().tasks.getTaskById(taskId);
      if (!currentTask) {
        throw new Error('Task not found');
      }
      
      // Check if session exists in focus store
      const focusSession = get().focus?.getSessionById(sessionId);
      if (!focusSession) {
        throw new Error('Focus session not found');
      }
      
      // Add session ID to task if not already linked
      if (!currentTask.focusSessionIds.includes(sessionId)) {
        const updatedSessionIds = [...currentTask.focusSessionIds, sessionId];
        
        get().tasks.updateTask(taskId, {
          focusSessionIds: updatedSessionIds,
        });
        
        if (__DEV__) {
          console.log('✅ Task linked to focus session:', taskId, sessionId);
        }
      }
    },
    
    getTaskProgress: (id: string) => {
      const task = get().tasks.getTaskById(id);
      if (!task) {
        return {
          completed: false,
          focusTimeSpent: 0,
          estimatedTime: 0,
          actualTime: 0,
        };
      }
      
      return task.progress;
    },
  };
  
  if (__DEV__) {
    console.log('✅ Tasks slice created successfully');
    console.log('Tasks slice functions:', {
      setSelectedDate: typeof slice.setSelectedDate,
      setViewMode: typeof slice.setViewMode,
      createTask: typeof slice.createTask,
      updateTask: typeof slice.updateTask,
    });
  }
  
  return slice;
}