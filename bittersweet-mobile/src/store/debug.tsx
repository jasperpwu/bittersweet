/**
 * Debug component to test store functionality
 */

import React from 'react';
import { View, Text, Button } from 'react-native';
import { useAppStore, useTasksSelectors, useTasks } from './index';

export function StoreDebugComponent() {
  const store = useAppStore();
  const tasks = useTasks();
  
  // Try to get selectors safely
  let selectors;
  try {
    selectors = useTasksSelectors();
  } catch (error) {
    console.error('Error getting selectors:', error);
    selectors = null;
  }

  const testStore = () => {
    console.log('Store state:', {
      auth: store.auth ? 'exists' : 'missing',
      tasks: store.tasks ? 'exists' : 'missing',
      focus: store.focus ? 'exists' : 'missing',
      ui: store.ui ? 'exists' : 'missing',
    });
    
    console.log('Tasks slice:', {
      tasks: tasks.tasks ? 'exists' : 'missing',
      selectedDate: tasks.selectedDate,
      viewMode: tasks.viewMode,
    });
    
    if (selectors) {
      console.log('Selectors:', {
        getTasksForDate: typeof selectors.getTasksForDate,
        getTaskById: typeof selectors.getTaskById,
      });
      
      // Test getTasksForDate
      try {
        const tasksForToday = selectors.getTasksForDate(new Date());
        console.log('Tasks for today:', tasksForToday);
      } catch (error) {
        console.error('Error calling getTasksForDate:', error);
      }
    } else {
      console.log('Selectors are null');
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Store Debug Component</Text>
      <Button title="Test Store" onPress={testStore} />
    </View>
  );
}