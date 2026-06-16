import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert, Text, TextInput, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { TagColorPicker } from '../../src/components/focus';
import { DEFAULT_TAG_COLOR } from '../../src/config/tagColors';
import { useAppSettings } from '../../src/store/unified-store';
import { useAppStore } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import {
  isHealthKitAvailable,
  requestWorkoutAuthorization,
} from '../../src/services/health/HealthKitService';
import { syncHealthKitWorkouts } from '../../src/services/health/syncHealthKitWorkouts';

// Workout-oriented emoji suggestions for the inline tag creator.
const WORKOUT_EMOJIS = ['🏋️', '💪', '🏃', '🧘', '🚴', '🏊', '⚽', '🤸'];

export default function HealthScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preferences, updatePreferences } = useAppSettings();
  const { triggerHaptic } = useDeviceIntegration();
  const tags = useAppStore((s) => s.focus.tags);
  const createTag = useAppStore((s) => s.focus.createTag);

  const hk = preferences.healthKit;
  const [tagSheetVisible, setTagSheetVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Inline tag-creation state (within the tag picker sheet).
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('Workout');
  const [newTagEmoji, setNewTagEmoji] = useState('🏋️');
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);

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
    closeTagSheet();
    await updatePreferences({ healthKit: { ...hk, linkedTagId: tagId } });
    if (hk.enabled) runSync();
  };

  const closeTagSheet = () => {
    setTagSheetVisible(false);
    setCreatingTag(false);
  };

  const openCreateTagForm = () => {
    triggerHaptic('light');
    // Reset to workout defaults each time the form is opened.
    setNewTagName('Workout');
    setNewTagEmoji('🏋️');
    setNewTagColor(DEFAULT_TAG_COLOR);
    setCreatingTag(true);
  };

  const handleCreateAndLinkTag = async () => {
    const name = newTagName.trim();
    if (!name || !newTagEmoji) return;
    triggerHaptic('light');
    const tag = createTag({ name, icon: newTagEmoji, color: newTagColor });
    closeTagSheet();
    await updatePreferences({ healthKit: { ...hk, linkedTagId: tag.id } });
    if (hk.enabled) runSync();
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
            appear under the tag you choose and earn fruit like a focus session. Workouts you log by
            hand in the Health app are skipped.
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
      <BottomSheet isVisible={tagSheetVisible} onClose={closeTagSheet}>
        {creatingTag ? (
          // Inline tag creator — defaults to a workout emoji + "Workout" name.
          <View className="px-5 pb-6">
            <View className="mb-4 flex-row items-center">
              <Pressable onPress={() => setCreatingTag(false)} className="mr-2 active:opacity-70">
                <Ionicons name="chevron-back" size={22} color={isDark ? '#FFFFFF' : '#5D4E37'} />
              </Pressable>
              <Typography variant="headline-20" color="primary">
                New workout tag
              </Typography>
            </View>

            {/* Emoji selector */}
            <Typography variant="body-12" color="secondary" className="mb-2">
              Pick an emoji
            </Typography>
            <View className="mb-5 flex-row flex-wrap" style={{ gap: 10 }}>
              {WORKOUT_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => setNewTagEmoji(emoji)}
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor:
                      newTagEmoji === emoji
                        ? isDark
                          ? '#3A3A4E'
                          : '#E0D4C0'
                        : isDark
                          ? '#2A2A2A'
                          : '#F0E0CC',
                    borderWidth: newTagEmoji === emoji ? 2 : 0,
                    borderColor: newTagColor,
                  }}>
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* Tag name */}
            <Typography variant="body-12" color="secondary" className="mb-2">
              Tag name
            </Typography>
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder="e.g. Workout"
              placeholderTextColor={isDark ? '#575757' : '#A0A0A0'}
              maxLength={30}
              className="mb-5"
              style={{
                backgroundColor: isDark ? '#2A2A2A' : '#F0E0CC',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: isDark ? '#FFFFFF' : '#5D4E37',
                borderWidth: 1,
                borderColor: isDark ? '#444' : '#D4C4A8',
              }}
            />

            {/* Color selector */}
            <Typography variant="body-12" color="secondary" className="mb-2">
              Color
            </Typography>
            <ScrollView
              style={{ maxHeight: 180 }}
              className="mb-5"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}>
              <TagColorPicker selectedColor={newTagColor} onSelectColor={setNewTagColor} swatchSize={32} />
            </ScrollView>

            <Pressable
              onPress={handleCreateAndLinkTag}
              disabled={!newTagName.trim()}
              className={`items-center rounded-2xl py-4 ${newTagName.trim() ? 'bg-blue-600 active:opacity-80' : 'bg-gray-500 opacity-50'}`}>
              <Typography variant="subtitle-16" color="white" className="font-semibold">
                Create & link tag
              </Typography>
            </Pressable>
          </View>
        ) : (
          <View className="px-5 pb-6">
            <Typography variant="headline-20" color="primary" className="mb-4">
              Choose a tag
            </Typography>
            {activeTags.map((tag) => (
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
            ))}

            {/* Create new tag inline */}
            <Pressable
              onPress={openCreateTagForm}
              className="flex-row items-center py-3 active:opacity-70">
              <Ionicons name="add-circle-outline" size={20} color="#6592E9" />
              <Typography variant="subtitle-14-medium" className="ml-2" style={{ color: '#6592E9' }}>
                Create new tag
              </Typography>
            </Pressable>
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
