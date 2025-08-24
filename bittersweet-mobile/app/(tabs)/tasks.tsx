import { useMemo } from 'react';
import { View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { Header } from '../../src/components/ui/Header';
import { DateSelector, Timeline } from '../../src/components/tasks';
import { useTasks, useTasksActions, useTasksSelectors } from '../../src/store';
import { generateWeekDatesFromStart } from '../../src/utils/dateUtils';

export default function TasksScreen() {
  const tasksData = useTasks();
  const selectors = useTasksSelectors();
  const actions = useTasksActions();
  
  // Safely extract data with fallbacks
  const rawSelectedDate = tasksData?.selectedDate;
  const currentWeekStart = tasksData?.currentWeekStart || (() => {
    const today = new Date();
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  })();
  
  if (__DEV__) {
    console.log('TasksScreen render data:', {
      hasTasksData: !!tasksData,
      rawSelectedDate,
      rawSelectedDateType: typeof rawSelectedDate,
      currentWeekStart,
      hasActions: !!actions,
      setSelectedDateType: typeof actions.setSelectedDate,
      actionsKeys: Object.keys(actions),
    });
  }

  // Ensure selectedDate is always a Date object
  const selectedDate = useMemo(() => {
    if (!rawSelectedDate) {
      console.warn('rawSelectedDate is null/undefined, using current date');
      return new Date();
    }
    if (rawSelectedDate instanceof Date) {
      return rawSelectedDate;
    }
    // If it's a string, convert to Date
    if (typeof rawSelectedDate === 'string') {
      const parsed = new Date(rawSelectedDate);
      if (isNaN(parsed.getTime())) {
        console.warn('Invalid date string, using current date:', rawSelectedDate);
        return new Date();
      }
      return parsed;
    }
    console.warn('Unexpected selectedDate type, using current date:', typeof rawSelectedDate, rawSelectedDate);
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

  // Ensure currentWeekStart is a valid Date object
  const validCurrentWeekStart = useMemo(() => {
    if (!currentWeekStart) {
      console.warn('currentWeekStart is null/undefined, using calculated week start');
      const today = new Date();
      const currentDay = today.getDay();
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);
      return weekStart;
    }
    if (currentWeekStart instanceof Date) {
      return currentWeekStart;
    }
    if (typeof currentWeekStart === 'string') {
      const parsed = new Date(currentWeekStart);
      if (isNaN(parsed.getTime())) {
        console.warn('Invalid currentWeekStart string, using calculated week start:', currentWeekStart);
        const today = new Date();
        const currentDay = today.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
      }
      return parsed;
    }
    console.warn('Unexpected currentWeekStart type, using calculated week start:', typeof currentWeekStart, currentWeekStart);
    const today = new Date();
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }, [currentWeekStart]);

  // Generate week dates based on current week start
  const weekDates = useMemo(() => generateWeekDatesFromStart(validCurrentWeekStart), [validCurrentWeekStart]);

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
            currentWeekStart={validCurrentWeekStart}
          />
        </View>

        {/* Timeline */}
        <View className="flex-1 px-5 pt-4">
          <Timeline
            tasks={tasksForSelectedDate}
            currentTime={currentTime}
            onTaskPress={handleTaskPress}
            onAddTask={handleAddTask}
          />
        </View>
      </View>
    </View>
  );
}