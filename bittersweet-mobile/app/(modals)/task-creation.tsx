import { useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Header } from '../../src/components/ui/Header';
import { TaskForm, CreateTaskInput } from '../../src/components/forms/TaskForm';
import { useTasksActions } from '../../src/store';

// Configure screen options to hide the default header
export const unstable_settings = {
  headerShown: false,
};

export default function TaskCreationModal() {
  const [isLoading, setIsLoading] = useState(false);
  const { createTask } = useTasksActions();

  console.log('🧪 Store status:', {
    hasCreateTask: typeof createTask === 'function',
  });

  const handleSubmit = async (taskData: CreateTaskInput) => {
    if (!createTask) {
      Alert.alert('Error', 'Task creation is not available. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      // Use a fallback user ID for development
      const userId = 'focus-user-' + Date.now();

      // Convert CreateTaskInput to the format expected by the store
      const taskForStore = {
        title: taskData.title,
        description: taskData.description,
        categoryId: taskData.category, // This is already the category ID
        date: taskData.startTime, // Use startTime as the task date
        startTime: taskData.startTime,
        duration: Math.round((taskData.endTime.getTime() - taskData.startTime.getTime()) / (1000 * 60)), // Convert to minutes
        status: 'scheduled' as const,
        priority: taskData.priority,
        userId: userId,
      };

      console.log('✅ Creating task:', taskForStore);
      createTask(taskForStore);

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
        error instanceof Error ? error.message : 'Failed to create task. Please try again.',
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