import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6592E9',
        tabBarInactiveTintColor: '#8A8A8A',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1B1C30',
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
        name="index"
        options={{
          title: 'Focus',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 50 }}>
              <Ionicons name="time-outline" size={24} color={color} />
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
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 50 }}>
              <Ionicons name="list-outline" size={24} color={color} />
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
        name="focus"
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
          title: 'Statistics',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', height: 50 }}>
              <Ionicons name="bar-chart-outline" size={24} color={color} />
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
      {/* Hide unused tabs */}
      <Tabs.Screen
        name="add-task"
        options={{
          href: null, // This hides the tab
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          href: null, // This hides the tab
        }}
      />
    </Tabs>
  );
}
