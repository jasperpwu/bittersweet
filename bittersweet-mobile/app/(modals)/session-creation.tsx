import { useState } from 'react';
import { Alert, View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Header } from '../../src/components/ui/Header';
import { SessionForm } from '../../src/components/forms/TaskForm';
import { useFocusActions } from '../../src/store';
import { CreateSessionInput } from '../../src/types/models';

// Configure screen options to hide the default header
export const unstable_settings = {
  headerShown: false,
};

export default function SessionCreationModal() {
  const [isLoading, setIsLoading] = useState(false);
  const { createSession } = useFocusActions();

  console.log('🧪 Store status:', {
    hasCreateSession: typeof createSession === 'function',
  });

  const handleSubmit = async (sessionData: CreateSessionInput) => {
    if (!createSession) {
      Alert.alert('Error', 'Session creation is not available. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('✅ Creating session:', sessionData);
      const newSession = createSession(sessionData);
      
      // Navigate back to journal with session info for scrolling
      if (newSession && newSession.id) {
        router.replace({
          pathname: '/(tabs)/journal',
          params: {
            sessionId: newSession.id,
            sessionDate: sessionData.startTime.toISOString(),
          },
        });
      } else {
        router.back();
      }
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create session. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <StatusBar style="light" backgroundColor="#1B1C30" />

      <Header
        title="Create focus session"
        leftAction={{
          icon: 'arrow-back',
          onPress: handleCancel,
        }}
        rightAction={{
          icon: 'settings-outline',
          onPress: () => {
            // TODO: Implement settings action
            console.log('Settings pressed');
          },
        }}
        useSafeArea={false}
      />

      <SessionForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </SafeAreaView>
  );
}