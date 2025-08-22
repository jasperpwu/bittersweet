import { ScrollView, SafeAreaView } from 'react-native';
import { StatusBar } from '../../src/components/ui/StatusBar';
import { UserProfile } from '../../src/components/home/UserProfile';
import { DailyGoals } from '../../src/components/home/DailyGoals';
import { useHomeStore } from '../../src/store/slices/homeSlice';

export default function HomeScreen() {
  const {
    user,
    dailyGoals,
    notificationCount,
  } = useHomeStore();

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
          user={user}
          onNotificationPress={handleNotificationPress}
          notificationCount={notificationCount}
        />

        {/* Daily Goals Section - Circular progress with gradient background */}
        <DailyGoals progress={dailyGoals} />
      </ScrollView>
    </SafeAreaView>
  );
}