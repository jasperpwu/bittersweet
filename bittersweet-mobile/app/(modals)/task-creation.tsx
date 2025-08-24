import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Header } from '../../src/components/ui/Header';
import { TaskForm, CreateTaskInput } from '../../src/components/forms/TaskForm';

// Configure screen options to hide the default header
export const unstable_settings = {
  headerShown: false,
};

export default function TaskCreationModal() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (taskData: CreateTaskInput) => {
    setIsLoading(true);

    try {
      // TODO: Implement actual task creation logic
      // This would typically involve:
      // 1. Validating the data
      // 2. Saving to local storage or API
      // 3. Updating global state

      console.log('Creating task:', taskData);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        'Success',
        'Task created successfully!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert(
        'Error',
        'Failed to create task. Please try again.',
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
    <View className="flex-1 bg-dark-bg">
      <StatusBar style="light" backgroundColor="#1B1C30" />

      <Header
        title="Create new task"
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
      />

      <TaskForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isLoading}
      />
    </View>
  );
}