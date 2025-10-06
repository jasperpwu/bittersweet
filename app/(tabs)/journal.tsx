import { useState, useMemo, useEffect } from 'react';
import { View, SafeAreaView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { Header } from '../../src/components/ui/Header';
import { DateSelector, Timeline } from '../../src/components/journal';
import { useFocus, useRewards, useFocusActions } from '../../src/store';
import { FruitCounter } from '../../src/components/rewards';
import { generateExtendedWeekDates } from '../../src/utils/dateUtils';

export default function JournalScreen() {
  const params = useLocalSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [scrollToSessionId, setScrollToSessionId] = useState<string | null>(null);
  const { sessions } = useFocus();
  const rewards = useRewards();
  const { deleteSession } = useFocusActions();

  // Handle navigation from session creation
  useEffect(() => {
    if (params.sessionId && params.sessionDate) {
      const sessionDate = new Date(params.sessionDate as string);
      setSelectedDate(sessionDate);
      setScrollToSessionId(params.sessionId as string);
      
      // Clear the params to avoid re-triggering
      router.setParams({ sessionId: undefined, sessionDate: undefined });
    }
  }, [params.sessionId, params.sessionDate]);

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
    const session = sessions.byId[sessionId];
    if (!session) return;
    
    // Format times for display
    const startTime = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const options = [];
    
    // Add delete button
    options.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => {
        deleteSession(sessionId);
      }
    });
    
    options.push({ text: 'Cancel', style: 'cancel' });
    
    // Create detailed message with start/end times and duration
    let message = `Start: ${startTime}\nEnd: ${endTime}\nDuration: ${session.targetDuration} minutes`;
    
    if (session.notes) {
      message += `\n\nNotes: ${session.notes}`;
    }
    
    Alert.alert(
      'Focus Session',
      message,
      options
    );
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
          tagName: session.tagName || '', // Use tagName directly
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
        leftComponent={<FruitCounter fruitCount={rewards.balance} size="small" />}
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
            scrollToSessionId={scrollToSessionId}
            onScrollComplete={() => setScrollToSessionId(null)}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}