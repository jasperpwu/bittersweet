import { useMemo } from 'react';
import { View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { Header } from '../../src/components/ui/Header';
import { DateSelector, Timeline } from '../../src/components/tasks';
import { useTasks, useTasksActions, useTasksSelectors } from '../../src/store';
import { generateWeekDatesFromStart } from '../../src/utils/dateUtils';

export default function TasksScreen() {
  const { selectedDate: rawSelectedDate, currentWeekStart } = useTasks();
  const selectors = useTasksSelectors();
  const actions = useTasksActions();
  
  if (__DEV__) {
    console.log('TasksScreen actions:', {
      hasActions: !!actions,
      setSelectedDateType: typeof actions.setSelectedDate,
      actionsKeys: Object.keys(actions),
    });
  }

  // Ensure selectedDate is always a Date object
  const selectedDate = useMemo(() => {
    if (!rawSelectedDate) return new Date();
    if (rawSelectedDate instanceof Date) return rawSelectedDate;
    // If it's a string, convert to Date
    if (typeof rawSelectedDate === 'string') return new Date(rawSelectedDate);
    return new Date();
  }, [rawSelectedDate]);

  // Debug logging
  if (__DEV__) {
    console.log('TasksScreen render:', {
      rawSelectedDate,
      selectedDate,
      selectedDateType: typeof selectedDate,
      isDateInstance: selectedDate instanceof Date,
      selectorsAvailable: !!selectors,
      getTasksForDateType: typeof selectors.getTasksForDate,
    });
  }

  // Generate week dates based on current week start
  const weekDates = useMemo(() => generateWeekDatesFromStart(currentWeekStart), [currentWeekStart]);

  // Get tasks for the selected date - with safety check
  const tasksForSelectedDate = useMemo(() => {
    if (!selectors.getTasksForDate || typeof selectors.getTasksForDate !== 'function') {
      console.warn('getTasksForDate is not available');
      return [];
    }
    return selectors.getTasksForDate(selectedDate);
  }, [selectedDate, selectors.getTasksForDate]);

  // Current time for the timeline indicator
  const currentTime = new Date();

  const handleDateSelect = (date: Date) => {
    if (__DEV__) {
      console.log('handleDateSelect called with:', date, 'setSelectedDate type:', typeof actions.setSelectedDate);
    }
    
    // Use the main store
    if (typeof actions.setSelectedDate === 'function') {
      actions.setSelectedDate(date);
    } else {
      console.warn('Main store setSelectedDate is not a function:', typeof actions.setSelectedDate);
    }
  };

  const handleTaskPress = (taskId: string) => {
    // TODO: Navigate to task details or start task
    console.log('Task pressed:', taskId);
  };

  const handleAddTask = () => {
    router.push('/(modals)/task-creation');
  };

  const handlePreviousWeek = () => {
    if (typeof actions.goToPreviousWeek === 'function') {
      actions.goToPreviousWeek();
    }
  };

  const handleNextWeek = () => {
    if (typeof actions.goToNextWeek === 'function') {
      actions.goToNextWeek();
    }
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
            onPreviousWeek={handlePreviousWeek}
            onNextWeek={handleNextWeek}
            currentWeekStart={currentWeekStart}
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