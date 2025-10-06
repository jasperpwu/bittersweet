/**
 * Optimized DateSelector component with unified store integration
 * Addresses Requirements: 8.1, 8.4, 8.5, 9.5, 10.4, 10.5
 */

import React, { FC, memo, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useTasks, useTasksActions } from '../../store';

interface DateItem {
  date: Date;
  isToday: boolean;
  isSelected: boolean;
  key: string;
}

interface OptimizedDateSelectorProps {
  testID?: string;
}

const DateItemComponent: FC<{
  item: DateItem;
  onPress: (date: Date) => void;
}> = memo(({ item, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(item.date);
  }, [item.date, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.dateItem,
        item.isSelected && styles.selectedDateItem,
        item.isToday && !item.isSelected && styles.todayDateItem,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${item.date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      })}`}
      accessibilityState={{ selected: item.isSelected }}
    >
      <Typography 
        variant="body-12" 
        color={item.isSelected ? 'white' : 'secondary'}
        style={styles.weekdayText}
      >
        {item.date.toLocaleDateString('en-US', { weekday: 'short' })}
      </Typography>
      <Typography 
        variant="subtitle-14-semibold" 
        color={item.isSelected ? 'white' : 'white'}
      >
        {item.date.getDate()}
      </Typography>
    </Pressable>
  );
});

DateItemComponent.displayName = 'DateItemComponent';

export const OptimizedDateSelector: FC<OptimizedDateSelectorProps> = memo(({ 
  testID = 'date-selector' 
}) => {
  const { selectedDate, currentWeekStart } = useTasks();
  const { setSelectedDate, goToPreviousWeek, goToNextWeek } = useTasksActions();

  // Memoized week dates calculation
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentWeekStart]);

  // Memoized date items for FlashList
  const dateItems = useMemo((): DateItem[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);

    return weekDates.map((date) => {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      
      return {
        date,
        isToday: normalizedDate.getTime() === today.getTime(),
        isSelected: normalizedDate.getTime() === selected.getTime(),
        key: date.toISOString(),
      };
    });
  }, [weekDates, selectedDate]);

  // Memoized week label
  const weekLabel = useMemo(() => {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    
    const today = new Date();
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - daysFromMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    
    if (currentWeekStart.toDateString() === thisWeekStart.toDateString()) {
      return 'This Week';
    }
    
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(today.getDate() - daysFromMonday - 7);
    lastWeekStart.setHours(0, 0, 0, 0);
    
    if (currentWeekStart.toDateString() === lastWeekStart.toDateString()) {
      return 'Last Week';
    }
    
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
    
    if (startMonth === endMonth) {
      return `${startMonth} ${currentWeekStart.getDate()}-${endOfWeek.getDate()}`;
    } else {
      return `${startMonth} ${currentWeekStart.getDate()} - ${endMonth} ${endOfWeek.getDate()}`;
    }
  }, [currentWeekStart]);

  // Optimized callbacks
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, [setSelectedDate]);

  const handlePreviousWeek = useCallback(() => {
    goToPreviousWeek();
  }, [goToPreviousWeek]);

  const handleNextWeek = useCallback(() => {
    goToNextWeek();
  }, [goToNextWeek]);

  // FlashList render item
  const renderDateItem = useCallback(({ item }: { item: DateItem }) => (
    <DateItemComponent item={item} onPress={handleDateSelect} />
  ), [handleDateSelect]);

  // FlashList key extractor
  const keyExtractor = useCallback((item: DateItem) => item.key, []);

  // FlashList item layout (fixed size for performance)
  const getItemLayout = useCallback((data: DateItem[] | null | undefined, index: number) => ({
    length: 64, // Fixed item width
    offset: 64 * index,
    index,
  }), []);

  return (
    <View style={styles.container} testID={testID}>
      {/* Week Navigation Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handlePreviousWeek}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>
        
        <Typography variant="subtitle-16" color="primary" style={styles.weekLabel}>
          {weekLabel}
        </Typography>
        
        <Pressable
          onPress={handleNextWeek}
          style={styles.navButton}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Optimized Date List */}
      <View style={styles.dateListContainer}>
        <FlashList
          data={dateItems}
          renderItem={renderDateItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          horizontal
          showsHorizontalScrollIndicator={false}
          estimatedItemSize={64}
          contentContainerStyle={styles.dateListContent}
          testID={`${testID}-list`}
        />
      </View>
    </View>
  );
});

OptimizedDateSelector.displayName = 'OptimizedDateSelector';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  navButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#374151', // gray-700
  },
  weekLabel: {
    fontWeight: '600',
  },
  dateListContainer: {
    height: 80,
    paddingHorizontal: 16,
  },
  dateListContent: {
    paddingHorizontal: 4,
  },
  dateItem: {
    marginRight: 16,
    padding: 12,
    borderRadius: 12,
    minWidth: 64,
    alignItems: 'center',
    backgroundColor: '#374151', // gray-700
  },
  selectedDateItem: {
    backgroundColor: '#6592E9', // primary
  },
  todayDateItem: {
    backgroundColor: '#4B5563', // gray-600
  },
  weekdayText: {
    marginBottom: 4,
  },
});

export default OptimizedDateSelector;