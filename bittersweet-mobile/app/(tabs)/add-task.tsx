import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Header } from '../../src/components/ui/Header';
import { TaskForm, CreateTaskInput } from '../../src/components/forms/TaskForm';

export default function AddTaskScreen() {
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
            onPress: () => {
              // Navigate back to the home tab after creating task
              router.push('/(tabs)');
            },
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
    // Navigate back to the home tab
    router.push('/(tabs)');
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#1B1C30" />
      
      <Header
        title="Create new task"
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
        isLoading={isLoading}
      />
    </>
  );
}