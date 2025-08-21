import { useMemo } from 'react';
import { View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { Header } from '../../src/components/ui/Header';
import { DateSelector, Timeline } from '../../src/components/tasks';
import { useTasksStore } from '../../src/store/slices/tasksSlice';
import { generateWeekDates } from '../../src/utils/dateUtils';

export default function TasksScreen() {
  const {
    selectedDate,
    setSelectedDate,
    getTasksForDate,
  } = useTasksStore();

  // Generate week dates starting from today
  const weekDates = useMemo(() => generateWeekDates(), []);

  // Get tasks for the selected date
  const tasksForSelectedDate = useMemo(() => 
    getTasksForDate(selectedDate), 
    [selectedDate, getTasksForDate]
  );

  // Current time for the timeline indicator
  const currentTime = new Date();

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleTaskPress = (taskId: string) => {
    // TODO: Navigate to task details or start task
    console.log('Task pressed:', taskId);
  };

  const handleAddTask = () => {
    router.push('/(modals)/task-creation');
  };

  return (
    <View className="flex-1 bg-dark-bg">
      <StatusBar variant="dark" />
      
      <Header
        title="Tasks"
        rightAction={{
          icon: 'add',
          onPress: handleAddTask,
        }}
      />

      <View className="flex-1">
        {/* Date Selector */}
        <View className="border-b border-dark-border" style={{ backgroundColor: '#1B1C30' }}>
          <DateSelector
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            weekDates={weekDates}
          />
        </View>

        {/* Timeline */}
        <View className="flex-1 px-5 pt-4">
          <Timeline
            tasks={tasksForSelectedDate}
            currentTime={currentTime}
            onTaskPress={handleTaskPress}
          />
        </View>
      </View>
    </View>
  );
}