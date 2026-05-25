import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, useColorScheme } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6592E9',
        tabBarInactiveTintColor: isDark ? '#8A8A8A' : '#8B7355',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#1B1C30' : '#F5E6D3',
          borderTopWidth: 0,
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarShowLabel: false,
        tabBarItemStyle: {
          height: 50,
        },
      }}>
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 50 }}>
              <Ionicons name="book-outline" size={24} color={color} />
              {focused && (
                <View 
                  style={{
                    width: 14,
                    height: 4,
                    backgroundColor: '#6592E9',
                    borderRadius: 100,
                    marginTop: 6,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 50 }}>
              <Ionicons name="play" size={30} color={color} />
              {focused && (
                <View 
                  style={{
                    width: 14,
                    height: 4,
                    backgroundColor: '#6592E9',
                    borderRadius: 100,
                    marginTop: 2,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 50 }}>
              <Ionicons name="trophy-outline" size={24} color={color} />
              {focused && (
                <View 
                  style={{
                    width: 14,
                    height: 4,
                    backgroundColor: '#6592E9',
                    borderRadius: 100,
                    marginTop: 6,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 50 }}>
              <Ionicons name="settings-outline" size={24} color={color} />
              {focused && (
                <View 
                  style={{
                    width: 14,
                    height: 4,
                    backgroundColor: '#6592E9',
                    borderRadius: 100,
                    marginTop: 6,
                  }}
                />
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
