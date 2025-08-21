import { create } from 'zustand';
import { Task, TaskCategory } from '../../types/models';

// Mock categories
const mockCategories: TaskCategory[] = [
  { id: '1', name: 'Reading', icon: '📚', color: '#51BC6F' },
  { id: '2', name: 'Sport', icon: '🏃', color: '#FF9800' },
  { id: '3', name: 'Music', icon: '🎵', color: '#9C27B0' },
  { id: '4', name: 'Meditation', icon: '🧘', color: '#4CAF50' },
  { id: '5', name: 'Code', icon: '💻', color: '#EF786C' },
  { id: '6', name: 'IT', icon: '⚙️', color: '#6592E9' },
];

// Generate mock tasks for the current week
const generateMockTasks = (): Task[] => {
  const tasks: Task[] = [];
  const today = new Date();
  
  // Generate tasks for the next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const taskDate = new Date(today);
    taskDate.setDate(today.getDate() + dayOffset);
    
    // Generate 2-4 tasks per day
    const tasksPerDay = Math.floor(Math.random() * 3) + 2;
    
    for (let taskIndex = 0; taskIndex < tasksPerDay; taskIndex++) {
      const category = mockCategories[Math.floor(Math.random() * mockCategories.length)];
      const startHour = 8 + Math.floor(Math.random() * 7); // 8 AM to 3 PM
      const startMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
      const duration = (Math.floor(Math.random() * 4) + 1) * 30; // 30, 60, 90, 120 minutes
      
      const startTime = new Date(taskDate);
      startTime.setHours(startHour, startMinute, 0, 0);
      
      // Avoid overlapping tasks
      const existingTasksForDay = tasks.filter(t => 
        t.date.toDateString() === taskDate.toDateString()
      );
      
      const hasOverlap = existingTasksForDay.some(existingTask => {
        const existingEnd = new Date(existingTask.startTime.getTime() + existingTask.duration * 60000);
        const newEnd = new Date(startTime.getTime() + duration * 60000);
        
        return (startTime < existingEnd && newEnd > existingTask.startTime);
      });
      
      if (!hasOverlap) {
        const statuses: Task['status'][] = ['scheduled', 'active', 'completed'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        tasks.push({
          id: `task-${dayOffset}-${taskIndex}`,
          title: `${category.name} Session ${taskIndex + 1}`,
          category,
          date: taskDate,
          startTime,
          duration,
          workingSessions: Math.floor(Math.random() * 4) + 1,
          shortBreakDuration: 5,
          longBreakDuration: 15,
          status,
          progress: {
            completedSessions: status === 'completed' ? 1 : 0,
            totalSessions: 1,
            timeSpent: status === 'completed' ? duration * 60 : 0,
            isActive: status === 'active',
            currentSessionType: 'focus',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }
  
  return tasks.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
};

interface TasksState {
  tasks: Task[];
  selectedDate: Date;
  categories: TaskCategory[];
  
  // Actions
  setSelectedDate: (date: Date) => void;
  getTasksForDate: (date: Date) => Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: generateMockTasks(),
  selectedDate: new Date(),
  categories: mockCategories,
  
  setSelectedDate: (date: Date) => set({ selectedDate: date }),
  
  getTasksForDate: (date: Date) => {
    const { tasks } = get();
    return tasks.filter(task => 
      task.date.toDateString() === date.toDateString()
    );
  },
  
  addTask: (taskData) => set((state) => ({
    tasks: [
      ...state.tasks,
      {
        ...taskData,
        id: `task-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ]
  })),
  
  updateTask: (id: string, updates: Partial<Task>) => set((state) => ({
    tasks: state.tasks.map(task =>
      task.id === id
        ? { ...task, ...updates, updatedAt: new Date() }
        : task
    )
  })),
  
  deleteTask: (id: string) => set((state) => ({
    tasks: state.tasks.filter(task => task.id !== id)
  })),
}));