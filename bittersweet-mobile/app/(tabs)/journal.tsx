import { useState, useMemo } from 'react';
import { View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { Header } from '../../src/components/ui/Header';
import { DateSelector, Timeline } from '../../src/components/journal';
import { useFocus } from '../../src/store';
import { generateExtendedWeekDates } from '../../src/utils/dateUtils';

export default function JournalScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { sessions } = useFocus();

  // Generate week dates for the date selector
  const weekDates = useMemo(() => generateExtendedWeekDates(), []);

  // Current time for the timeline indicator
  const currentTime = new Date();

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddSession = () => {
    router.push('/(modals)/session-creation');
  };

  const handleSessionPress = (sessionId: string) => {
    // TODO: Navigate to session details or edit session
    console.log('Session pressed:', sessionId);
  };

  // Convert store sessions to component format and filter for selected date
  const sessionsForSelectedDate = useMemo(() => {
    // Safety check to handle undefined sessions
    if (!sessions || !sessions.allIds || !sessions.byId) {
      console.warn('Sessions data is not properly initialized:', sessions);
      return [];
    }
    
    return sessions.allIds
      .map(id => {
        const session = sessions.byId[id];
        if (!session) return null;
        
        return {
          id: session.id,
          startTime: new Date(session.startTime),
          endTime: new Date(session.endTime),
          duration: Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60)),
          tags: session.tagIds || [], // Changed from session.tags to session.tagIds to match the store structure
          notes: session.notes || '',
        };
      })
      .filter(session => {
        if (!session) return false;
        
        // Filter for selected date
        const sessionDate = session.startTime.toDateString();
        const selectedDateString = selectedDate.toDateString();
        return sessionDate === selectedDateString;
      })
      .filter((session): session is NonNullable<typeof session> => session !== null);
  }, [sessions, selectedDate]);


  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <StatusBar variant="dark" />
      
      <Header
        title="Journal"
        rightAction={{
          icon: 'add',
          onPress: handleAddSession,
        }}
        useSafeArea={false}
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
            sessions={sessionsForSelectedDate}
            currentTime={currentTime}
            onSessionPress={handleSessionPress}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}