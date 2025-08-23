import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  name: string;
  avatar?: string;
  level?: number;
}

interface Task {
  id: string;
  title: string;
  category: string;
  duration: number; // in minutes
  startTime: string; // e.g., "09:00"
  isCompleted: boolean;
  isActive: boolean;
  progress?: number; // 0-1
}

interface DailyGoalsProgress {
  focusTime: {
    current: number;
    target: number;
  };
  sessions: {
    current: number;
    target: number;
  };
}

interface HomeState {
  user: User;
  currentTask: Task | null;
  todaysTasks: Task[];
  dailyGoals: DailyGoalsProgress;
  notificationCount: number;
}

interface HomeActions {
  updateUser: (user: Partial<User>) => void;
  setCurrentTask: (task: Task | null) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  addTask: (task: Omit<Task, 'id'>) => void;
  removeTask: (taskId: string) => void;
  updateDailyGoals: (goals: Partial<DailyGoalsProgress>) => void;
  setNotificationCount: (count: number) => void;
  completeTask: (taskId: string) => void;
  startTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
}

const initialState: HomeState = {
  user: {
    id: '1',
    name: 'Artiom',
    avatar: undefined,
    level: 5,
  },
  currentTask: {
    id: '1',
    title: 'Angular tutorial',
    category: 'Code',
    duration: 50,
    startTime: '09:00',
    isCompleted: false,
    isActive: true,
  },
  todaysTasks: [
    {
      id: '1',
      title: 'Angular tutorial',
      category: 'Code',
      duration: 50,
      startTime: '09:00',
      isCompleted: false,
      isActive: true,
    },
    {
      id: '2',
      title: 'UX articles reading',
      category: 'Reading',
      duration: 85, // 1h 25 mins
      startTime: '10:30',
      isCompleted: false,
      isActive: false,
    },
    {
      id: '3',
      title: 'Meditation',
      category: 'Meditation',
      duration: 60,
      startTime: '14:00',
      isCompleted: false,
      isActive: false,
    },
    {
      id: '4',
      title: 'Quick warm up',
      category: 'Sport',
      duration: 50,
      startTime: '16:00',
      isCompleted: false,
      isActive: false,
    },
  ],
  dailyGoals: {
    focusTime: {
      current: 180, // 3 hours in minutes
      target: 240, // 4 hours in minutes
    },
    sessions: {
      current: 3,
      target: 5,
    },
  },
  notificationCount: 3,
};

export const useHomeStore = create<HomeState & HomeActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      updateUser: (user) => {
        set((state) => ({
          user: { ...state.user, ...user },
        }));
      },

      setCurrentTask: (task) => {
        set({ currentTask: task });
      },

      updateTask: (taskId, updates) => {
        set((state) => ({
          todaysTasks: state.todaysTasks.map((task) =>
            task.id === taskId ? { ...task, ...updates } : task
          ),
          currentTask:
            state.currentTask?.id === taskId
              ? { ...state.currentTask, ...updates }
              : state.currentTask,
        }));
      },

      addTask: (taskData) => {
        const newTask: Task = {
          ...taskData,
          id: Date.now().toString(),
        };
        set((state) => ({
          todaysTasks: [...state.todaysTasks, newTask],
        }));
      },

      removeTask: (taskId) => {
        set((state) => ({
          todaysTasks: state.todaysTasks.filter((task) => task.id !== taskId),
          currentTask:
            state.currentTask?.id === taskId ? null : state.currentTask,
        }));
      },

      updateDailyGoals: (goals) => {
        set((state) => ({
          dailyGoals: { ...state.dailyGoals, ...goals },
        }));
      },

      setNotificationCount: (count) => {
        set({ notificationCount: count });
      },

      completeTask: (taskId) => {
        const { todaysTasks, dailyGoals } = get();
        const task = todaysTasks.find((t) => t.id === taskId);

        if (task && !task.isCompleted) {
          get().updateTask(taskId, {
            isCompleted: true,
            isActive: false,
            progress: 1,
          });

          // Update daily goals
          const completedTasks = todaysTasks.filter(t => t.isCompleted).length + 1;
          const newTimeSpent = dailyGoals.timeSpent + task.duration;
          const newPercentage = Math.round((completedTasks / dailyGoals.total) * 100);

          get().updateDailyGoals({
            completed: completedTasks,
            percentage: newPercentage,
            timeSpent: newTimeSpent,
          });

          // Clear current task if it's the completed one
          if (get().currentTask?.id === taskId) {
            get().setCurrentTask(null);
          }
        }
      },

      startTask: (taskId) => {
        const { todaysTasks } = get();
        const task = todaysTasks.find((t) => t.id === taskId);

        if (task && !task.isCompleted) {
          // Stop any currently active task
          todaysTasks.forEach((t) => {
            if (t.isActive) {
              get().updateTask(t.id, { isActive: false });
            }
          });

          // Start the selected task
          get().updateTask(taskId, { isActive: true });
          get().setCurrentTask({ ...task, isActive: true });
        }
      },

      pauseTask: (taskId) => {
        get().updateTask(taskId, { isActive: false });

        if (get().currentTask?.id === taskId) {
          get().setCurrentTask(null);
        }
      },
    }),
    {
      name: 'home-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        todaysTasks: state.todaysTasks,
        dailyGoals: state.dailyGoals,
        notificationCount: state.notificationCount,
      }),
    }
  )
);

export type { User, Task, DailyGoalsProgress, HomeState, HomeActions };