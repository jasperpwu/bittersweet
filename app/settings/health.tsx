import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { useAppSettings } from '../../src/store/unified-store';
import { useAppStore } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import {
  isHealthKitAvailable,
  requestWorkoutAuthorization,
} from '../../src/services/health/HealthKitService';
import { syncHealthKitWorkouts } from '../../src/services/health/syncHealthKitWorkouts';

export default function HealthScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preferences, updatePreferences } = useAppSettings();
  const { triggerHaptic } = useDeviceIntegration();
  const tags = useAppStore((s) => s.focus.tags);

  const hk = preferences.healthKit;
  const [tagSheetVisible, setTagSheetVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeTags = tags.allIds
    .map((id) => tags.byId[id])
    .filter((tag) => tag && !tag.deletedAt)
    .map((tag) => ({ id: tag.id, name: tag.name, icon: tag.icon || '🎯' }));

  const linkedTag = hk.linkedTagId ? tags.byId[hk.linkedTagId] : undefined;

  const handleConnectToggle = async (value: boolean) => {
    triggerHaptic('light');

    if (!value) {
      await updatePreferences({ healthKit: { ...hk, enabled: false } });
      return;
    }

    if (!isHealthKitAvailable()) {
      Alert.alert('Apple Health Unavailable', 'Apple Health is not available on this device.', [
        { text: 'OK' },
      ]);
      return;
    }

    try {
      await requestWorkoutAuthorization();
      // iOS never tells us whether read access was granted, so we optimistically
      // enable. If access was denied the sync simply returns no workouts.
      await updatePreferences({ healthKit: { ...hk, enabled: true } });
      // Kick off an initial import if a tag is already linked.
      if (hk.linkedTagId) runSync();
    } catch (e) {
      console.error('[HealthKit] authorization failed', e);
      Alert.alert('Connection Failed', 'Could not connect to Apple Health.', [{ text: 'OK' }]);
    }
  };

  const handlePickTag = async (tagId: string) => {
    triggerHaptic('light');
    setTagSheetVisible(false);
    await updatePreferences({ healthKit: { ...hk, linkedTagId: tagId } });
    if (hk.enabled) runSync();
  };

  const handleSkipUserEnteredToggle = async (value: boolean) => {
    triggerHaptic('light');
    await updatePreferences({ healthKit: { ...hk, skipUserEntered: value } });
  };

  const runSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncHealthKitWorkouts();
      triggerHaptic('light');
      if (result) {
        Alert.alert(
          'Sync Complete',
          result.imported > 0
            ? `Imported ${result.imported} workout${result.imported === 1 ? '' : 's'}.`
            : 'No new workouts to import.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] flex-row items-center px-5">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#5D4E37'} />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          Apple Health
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-4 pt-2">
          <Typography variant="body-12" color="secondary">
            Connect Apple Health to turn finished workouts into focus sessions. Workouts logged by
            popular fitness apps such as SmartGym and Peloton are supported too. Imported workouts
            appear under the tag you choose and do not earn fruit.
          </Typography>
        </View>

        <SettingsSection title="Connection">
          <SettingsItem
            title="Connect Apple Health"
            subtitle="Sync Apple Fitness workouts as sessions"
            hasToggle
            toggleValue={hk.enabled}
            onToggleChange={handleConnectToggle}
            isLast
          />
        </SettingsSection>

        {hk.enabled && (
          <>
            <SettingsSection title="Linked tag">
              <SettingsItem
                title="Tag"
                subtitle="Workouts are filed under this tag"
                hasChevron
                valueLabel={linkedTag ? `${linkedTag.icon || '🎯'} ${linkedTag.name}` : 'Choose'}
                onPress={() => {
                  triggerHaptic('light');
                  setTagSheetVisible(true);
                }}
                isLast
              />
            </SettingsSection>

            <SettingsSection title="Options">
              <SettingsItem
                title="Skip manual workouts"
                subtitle="Ignore workouts hand-logged in the Health app"
                hasToggle
                toggleValue={hk.skipUserEntered}
                onToggleChange={handleSkipUserEnteredToggle}
              />
              <SettingsItem
                title={isSyncing ? 'Syncing…' : 'Sync now'}
                subtitle="Check Apple Health for new workouts"
                onPress={isSyncing || !hk.linkedTagId ? undefined : runSync}
                isLast
              />
            </SettingsSection>
          </>
        )}
      </ScrollView>

      {/* Tag picker */}
      <BottomSheet isVisible={tagSheetVisible} onClose={() => setTagSheetVisible(false)}>
        <View className="px-5 pb-6">
          <Typography variant="headline-20" color="primary" className="mb-4">
            Choose a tag
          </Typography>
          {activeTags.length === 0 ? (
            <Typography variant="body-12" color="secondary">
              Create a tag first to link your workouts.
            </Typography>
          ) : (
            activeTags.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => handlePickTag(tag.id)}
                className="flex-row items-center border-b border-light-border py-3 active:opacity-70 dark:border-dark-border">
                <Typography variant="subtitle-14-medium" color="primary" className="flex-1">
                  {tag.icon} {tag.name}
                </Typography>
                {hk.linkedTagId === tag.id && (
                  <Ionicons name="checkmark" size={20} color={isDark ? '#FFFFFF' : '#5D4E37'} />
                )}
              </Pressable>
            ))
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
