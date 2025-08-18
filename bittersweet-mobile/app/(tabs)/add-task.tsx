import { View, Text, SafeAreaView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AddTaskScreen() {
  const handleCreateTask = () => {
    router.push('/(modals)/task-creation');
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-primary rounded-full items-center justify-center mb-4">
            <Ionicons name="add" size={40} color="#FFFFFF" />
          </View>
          <Text className="text-dark-text-primary font-poppins-semibold text-headline-20 text-center">
            Create New Task
          </Text>
          <Text className="text-dark-text-secondary font-poppins-regular text-body-14 mt-2 text-center">
            Start a new focus session or add a task to your schedule
          </Text>
        </View>

        <Pressable
          onPress={handleCreateTask}
          className="bg-primary px-8 py-4 rounded-xl active:opacity-80"
        >
          <Text className="text-white font-poppins-semibold text-subtitle-16">
            Create Task
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}