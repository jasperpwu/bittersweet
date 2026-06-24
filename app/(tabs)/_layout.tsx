import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, useColorScheme } from 'react-native';
import { useAppStore } from '../../src/store';
import { Typography } from '../../src/components/ui/Typography';
import { useTranslation } from 'react-i18next';

const ActiveDot = () => (
  <View
    style={{
      width: 14,
      height: 4,
      backgroundColor: '#6592E9',
      borderRadius: 100,
      marginTop: 2,
    }}
  />
);

export default function TabLayout() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isGroveActive = useAppStore(
    (s) => s.grove?.profile !== null && s.grove?.isActive !== false
  );
  const pendingRequestCount = useAppStore((s) => s.grove?.pendingRequestCount ?? 0);
  const pendingChallengeCount = useAppStore((s) => s.grove?.pendingChallengeCount ?? 0);
  const groveBadgeCount = pendingRequestCount + pendingChallengeCount;

  return (
    <Tabs
      screenOptions={{
        freezeOnBlur: false,
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
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontFamily: 'Poppins-Medium',
          fontSize: 10,
        },
        tabBarItemStyle: {
          height: 50,
        },
      }}>
      <Tabs.Screen
        name="journal"
        options={{
          title: t('tabs.journal'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={24} color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Typography
                variant="tiny-10"
                style={{ color, fontFamily: 'Poppins-Medium' }}
              >
                {t('tabs.journal')}
              </Typography>
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.focus'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="play" size={30} color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Typography
                variant="tiny-10"
                style={{ color, fontFamily: 'Poppins-Medium' }}
              >
                {t('tabs.focus')}
              </Typography>
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('tabs.goals'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="stats-chart-outline" size={24} color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Typography
                variant="tiny-10"
                style={{ color, fontFamily: 'Poppins-Medium' }}
              >
                {t('tabs.goals')}
              </Typography>
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="grove"
        options={{
          title: t('tabs.grove'),
          href: isGroveActive ? '/(tabs)/grove' : null,
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="people-outline" size={24} color={color} />
              {groveBadgeCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#FF3B30',
                  }}
                />
              )}
            </View>
          ),
          tabBarLabel: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Typography
                variant="tiny-10"
                style={{ color, fontFamily: 'Poppins-Medium' }}
              >
                {t('tabs.grove')}
              </Typography>
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={24} color={color} />
          ),
          tabBarLabel: ({ focused, color }) => (
            <View style={{ alignItems: 'center' }}>
              <Typography
                variant="tiny-10"
                style={{ color, fontFamily: 'Poppins-Medium' }}
              >
                {t('tabs.settings')}
              </Typography>
              {focused && <ActiveDot />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
