import { View, Text, SafeAreaView } from 'react-native';

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <View className="flex-1 items-center justify-center">
        <Text className="text-dark-text-primary font-poppins-semibold text-headline-20">
          Settings Screen
        </Text>
        <Text className="text-dark-text-secondary font-poppins-regular text-body-14 mt-2">
          App settings coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}