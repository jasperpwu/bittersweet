import { ScrollView, SafeAreaView } from 'react-native';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { UserProfile } from '../../src/components/home/UserProfile';
import { DailyGoals } from '../../src/components/home/DailyGoals';
import { Typography } from '../../src/components/ui/Typography';
import { useAuth, useUserStats } from '../../src/store/unified-store';

export default function HomeScreen() {
  try {
    const { user } = useAuth();
    const { stats } = useUserStats();
    
    // Debug logging
    if (__DEV__) {
      console.log('HomeScreen - user:', user);
      console.log('HomeScreen - stats:', stats);
    }
  
    // Mock user for development if no user is logged in
    const mockUser = user || {
      id: 'mock-user',
      email: 'demo@bittersweet.app',
      name: 'Demo User',
      avatar: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      deviceInfo: {
        deviceId: 'mock-device',
        deviceName: 'Mock Device',
        platform: 'ios' as const,
        osVersion: '17.0',
        appVersion: '1.0.0',
        timezone: 'UTC',
        locale: 'en-US',
      },
      preferences: {
        theme: 'system' as const,
        language: 'en',
        notifications: {
          enabled: true,
          sessionReminders: true,
          breakReminders: true,
          dailyGoals: true,
          squadUpdates: true,
        },
        privacy: {
          shareStats: true,
          allowFriendRequests: true,
          showOnlineStatus: true,
        },
        focus: {
          defaultDuration: 25,
          breakDuration: 5,
          longBreakDuration: 15,
          sessionsUntilLongBreak: 4,
          soundEnabled: true,
          vibrationEnabled: true,
          autoStartBreaks: false,
          autoStartSessions: false,
        },
      },
      stats: {
        totalFocusTime: 180,
        totalSessions: 12,
        currentStreak: 3,
        longestStreak: 7,
        seedsEarned: 240,
        level: 2,
        experience: 450,
        lastActiveDate: new Date(),
      },
    };
  
  // Placeholder data until we implement the full home functionality
  const dailyGoals = {
    focusTime: { current: 180, target: 240 },
    sessions: { current: 3, target: 5 },
  };
  const notificationCount = 3;

  const handleNotificationPress = () => {
    console.log('Notification pressed');
    // TODO: Navigate to notifications screen
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
            user={mockUser}
            onNotificationPress={handleNotificationPress}
            notificationCount={notificationCount}
          />

          {/* Daily Goals Section - Circular progress with gradient background */}
          <DailyGoals progress={dailyGoals} />
        </ScrollView>
      </SafeAreaView>
    );
  } catch (error) {
    if (__DEV__) {
      console.error('HomeScreen error:', error);
    }
    
    return (
      <SafeAreaView className="flex-1 bg-dark-bg items-center justify-center">
        <Typography variant="headline-18" className="text-white mb-4">
          Something went wrong
        </Typography>
        <Typography variant="body-14" className="text-text-grey">
          Please restart the app
        </Typography>
      </SafeAreaView>
    );
  }
}