import { ScrollView, SafeAreaView } from 'react-native';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { UserProfile } from '../../src/components/home/UserProfile';
import { CurrentTask } from '../../src/components/home/CurrentTask';
import { DailyGoals } from '../../src/components/home/DailyGoals';
import { TasksList } from '../../src/components/home/TasksList';
import { useHomeStore } from '../../src/store/slices/homeSlice';

export default function HomeScreen() {
  const {
    user,
    currentTask,
    todaysTasks,
    dailyGoals,
    notificationCount,
    startTask,
    pauseTask,
  } = useHomeStore();

  const handleNotificationPress = () => {
    console.log('Notification pressed');
    // TODO: Navigate to notifications screen
  };

  const handleTaskPress = (taskId: string) => {
    const task = todaysTasks.find(t => t.id === taskId);
    if (task) {
      if (task.isActive) {
        pauseTask(taskId);
      } else if (task.isCompleted) {
        console.log('Task already completed');
      } else {
        startTask(taskId);
      }
    }
  };

  const handleCurrentTaskPlay = () => {
    if (currentTask) {
      startTask(currentTask.id);
    } else {
      // Find the next incomplete task
      const nextTask = todaysTasks.find(t => !t.isCompleted && !t.isActive);
      if (nextTask) {
        startTask(nextTask.id);
      }
    }
  };

  const handleCurrentTaskPause = () => {
    if (currentTask) {
      pauseTask(currentTask.id);
    }
  };

  const handleViewAllTasks = () => {
    console.log('View all tasks pressed');
    // TODO: Navigate to tasks screen
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Status Bar with dark background integration */}
      <StatusBar variant="dark" backgroundColor="#1B1C30" />
      
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingBottom: 32,
          flexGrow: 1,
        }}
        bounces={true}
        alwaysBounceVertical={false}
      >
        {/* User Profile Section - Top section with avatar and greeting */}
        <UserProfile
          user={user}
          onNotificationPress={handleNotificationPress}
          notificationCount={notificationCount}
        />

        {/* Current Task Section - Active task display with controls */}
        <CurrentTask
          task={currentTask}
          onPlayPress={handleCurrentTaskPlay}
          onPausePress={handleCurrentTaskPause}
        />

        {/* Daily Goals Section - Circular progress with gradient background */}
        <DailyGoals progress={dailyGoals} />

        {/* Today's Tasks Section - Task list with "View all" link */}
        <TasksList
          tasks={todaysTasks}
          onTaskPress={handleTaskPress}
          onViewAllPress={handleViewAllTasks}
        />
      </ScrollView>
    </SafeAreaView>
  );
}