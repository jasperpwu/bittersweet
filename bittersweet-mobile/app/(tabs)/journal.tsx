import { useState } from 'react';
import { View, SafeAreaView } from 'react-native';
import { CalendarView } from '../../src/components/journal/CalendarView';
import { ActivityList } from '../../src/components/journal/ActivityList';
import { Typography } from '../../src/components/ui/Typography';


// Mock data for demonstration
const mockCalendarDays = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(2024, 0, i + 1),
  focusMinutes: Math.floor(Math.random() * 120),
  sessionsCompleted: Math.floor(Math.random() * 5),
  isToday: i === 15,
  isSelected: i === 15,
}));

const mockEntries = [
  {
    id: '1',
    startTime: new Date(2024, 0, 15, 9, 0),
    endTime: new Date(2024, 0, 15, 9, 25),
    duration: 25,
    category: 'Work',
    tags: ['important', 'project'],
    description: 'Working on quarterly report',
    isManualEntry: false,
  },
  {
    id: '2',
    startTime: new Date(2024, 0, 15, 14, 0),
    endTime: new Date(2024, 0, 15, 14, 30),
    duration: 30,
    category: 'Study',
    tags: ['learning'],
    description: 'Reading React Native documentation',
    isManualEntry: true,
  },
];

export default function JournalScreen() {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleDaySelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleViewModeChange = (mode: 'week' | 'month') => {
    setViewMode(mode);
  };

  const handleEditEntry = (entry: any) => {
    console.log('Edit entry:', entry);
    // TODO: Implement edit functionality
  };

  const handleDeleteEntry = (entryId: string) => {
    console.log('Delete entry:', entryId);
    // TODO: Implement delete functionality
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-dark-bg">
      {/* Header */}
      <View className="px-4 py-4 border-b border-light-border dark:border-dark-border">
        <Typography variant="headline-24" color="primary">
          Time Journal
        </Typography>
        <Typography variant="body-14" color="secondary" className="mt-1">
          Track your focus sessions and productivity
        </Typography>
      </View>

      {/* Calendar View */}
      <CalendarView
        days={mockCalendarDays}
        onDaySelect={handleDaySelect}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      {/* Activity List */}
      <View className="flex-1">
        <View className="px-4 py-3 border-b border-light-border dark:border-dark-border">
          <Typography variant="subtitle-16" color="primary">
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Typography>
        </View>
        
        <ActivityList
          entries={mockEntries}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDeleteEntry}
          emptyMessage="No focus sessions recorded for this day"
        />
      </View>
    </SafeAreaView>
  );
}