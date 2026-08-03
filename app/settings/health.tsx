import React, { useState } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
  Text,
  TextInput,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/config/theme';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { TagColorPicker } from '../../src/components/focus';
import { DEFAULT_TAG_COLOR } from '../../src/config/tagColors';
import { useAppSettings } from '../../src/store/unified-store';
import { useAppStore } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useTagUpgradeFlow } from '../../src/hooks/useTagUpgradeFlow';
import {
  isHealthKitAvailable,
  requestWorkoutAuthorization,
} from '../../src/services/health/HealthKitService';
import { syncHealthKitWorkouts } from '../../src/services/health/syncHealthKitWorkouts';
import { useTranslation } from 'react-i18next';
import { directionalIcon } from '../../src/utils/directionalIcon';

// Workout-oriented emoji suggestions for the inline tag creator.
const WORKOUT_EMOJIS = ['🏋️', '💪', '🏃', '🧘', '🚴', '🏊', '⚽', '🤸'];

export default function HealthScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preferences, updatePreferences } = useAppSettings();
  const { triggerHaptic } = useDeviceIntegration();
  const tags = useAppStore((s) => s.focus.tags);
  const createTag = useAppStore((s) => s.focus.createTag);
  const { canCreateTag } = useSubscriptionGate();
  const { triggerUpgrade, upgradeModals } = useTagUpgradeFlow();

  const hk = preferences.healthKit;
  const [tagSheetVisible, setTagSheetVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Inline tag-creation state (within the tag picker sheet).
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState(t('health.defaultWorkoutName'));
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
      Alert.alert(t('health.unavailableTitle'), t('health.unavailableBody'), [
        { text: t('common.ok') },
      ]);
      return;
    }

    try {
      await requestWorkoutAuthorization();
      // iOS never tells us whether read access was granted, so we optimistically
      // enable. If access was denied the sync simply returns no workouts.
      // Stamp `enabledAt` and clear any stale `anchor` so the first import floors
      // at this moment — we only pull workouts recorded from connect onward, never
      // backfilling the user's workout history.
      await updatePreferences({
        healthKit: { ...hk, enabled: true, enabledAt: Date.now(), anchor: null },
      });
      // Kick off an initial import if a tag is already linked.
      if (hk.linkedTagId) runSync();
    } catch (e) {
      console.error('[HealthKit] authorization failed', e);
      Alert.alert(t('health.connFailedTitle'), t('health.connFailedBody'), [
        { text: t('common.ok') },
      ]);
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
    // Free tier is capped at 3 tags; route over-limit users to the paywall
    // instead of the inline create form. Keep the picker open — the paywall is
    // nested in its overlay so iOS presents it on top; closing here would make
    // it a sibling of a dismissing modal and it would fail to present.
    if (!canCreateTag) {
      triggerUpgrade();
      return;
    }
    triggerHaptic('light');
    // Reset to workout defaults each time the form is opened.
    setNewTagName(t('health.defaultWorkoutName'));
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
          t('health.syncCompleteTitle'),
          result.imported > 0
            ? t('health.syncImported', { count: result.imported })
            : t('health.syncNone'),
          [{ text: t('common.ok') }]
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
          <Ionicons
            name={directionalIcon('chevron-back')}
            size={24}
            color={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary}
          />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          {t('settings.tab.health')}
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pb-4 pt-2">
          <Typography variant="body-12" color="secondary">
            {t('health.intro')}
          </Typography>
        </View>

        <SettingsSection title={t('health.connection')}>
          <SettingsItem
            title={t('health.connect')}
            subtitle={t('health.connectSub')}
            hasToggle
            toggleValue={hk.enabled}
            onToggleChange={handleConnectToggle}
            isLast
          />
        </SettingsSection>

        {hk.enabled && (
          <>
            <SettingsSection title={t('health.linkedTag')}>
              <SettingsItem
                title={t('health.tag')}
                subtitle={t('health.tagSub')}
                hasChevron
                valueLabel={
                  linkedTag ? `${linkedTag.icon || '🎯'} ${linkedTag.name}` : t('health.choose')
                }
                onPress={() => {
                  triggerHaptic('light');
                  setTagSheetVisible(true);
                }}
                isLast
              />
            </SettingsSection>

            {/* Manual sync is a dev-only testing affordance. Regular users rely on
                the automatic foreground/cold-start sync in _layout.tsx. */}
            {__DEV__ && (
              <SettingsSection title={t('health.options')}>
                <SettingsItem
                  title={isSyncing ? t('health.syncing') : t('health.syncNow')}
                  subtitle={t('health.syncSub')}
                  onPress={isSyncing || !hk.linkedTagId ? undefined : runSync}
                  isLast
                />
              </SettingsSection>
            )}
          </>
        )}
      </ScrollView>

      {/* Tag picker */}
      <BottomSheet isVisible={tagSheetVisible} onClose={closeTagSheet} overlay={upgradeModals}>
        {creatingTag ? (
          // Inline tag creator — defaults to a workout emoji + "Workout" name.
          <View className="px-5 pb-6">
            <View className="mb-4 flex-row items-center">
              <Pressable onPress={() => setCreatingTag(false)} className="mr-2 active:opacity-70">
                <Ionicons
                  name={directionalIcon('chevron-back')}
                  size={22}
                  color={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary}
                />
              </Pressable>
              <Typography variant="headline-20" color="primary">
                {t('health.newWorkoutTag')}
              </Typography>
            </View>

            {/* Emoji selector */}
            <Typography variant="body-12" color="secondary" className="mb-2">
              {t('health.pickEmoji')}
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
                        ? colors.primary + '1A'
                        : isDark
                          ? colors.dark.input
                          : colors.light.input,
                    borderWidth: newTagEmoji === emoji ? 2 : 0,
                    borderColor: newTagColor,
                  }}>
                  <Text style={{ fontSize: 22 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* Tag name */}
            <Typography variant="body-12" color="secondary" className="mb-2">
              {t('health.tagName')}
            </Typography>
            <TextInput
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder={t('health.tagNamePlaceholder')}
              placeholderTextColor={
                isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary
              }
              maxLength={30}
              className="mb-5"
              style={{
                backgroundColor: isDark ? colors.dark.input : colors.light.input,
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary,
                borderWidth: 1,
                borderColor: isDark ? colors.dark.border : colors.light.screenBorder,
              }}
            />

            {/* Color selector */}
            <Typography variant="body-12" color="secondary" className="mb-2">
              {t('health.color')}
            </Typography>
            <ScrollView
              style={{ maxHeight: 180 }}
              className="mb-5"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}>
              <TagColorPicker
                selectedColor={newTagColor}
                onSelectColor={setNewTagColor}
                swatchSize={32}
              />
            </ScrollView>

            <Button
              variant="primary"
              size="large"
              fullWidth
              disabled={!newTagName.trim()}
              className="rounded-2xl py-4"
              onPress={handleCreateAndLinkTag}>
              <Typography variant="subtitle-16" color="white" className="font-semibold">
                {t('health.createLink')}
              </Typography>
            </Button>
          </View>
        ) : (
          <View className="px-5 pb-6">
            <Typography variant="headline-20" color="primary" className="mb-4">
              {t('health.chooseTag')}
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
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary}
                  />
                )}
              </Pressable>
            ))}

            {/* Create new tag inline */}
            <Pressable
              onPress={openCreateTagForm}
              className="flex-row items-center py-3 active:opacity-70">
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Typography
                variant="subtitle-14-medium"
                className="ml-2"
                style={{ color: colors.primary }}>
                {t('health.createNewTag')}
              </Typography>
            </Pressable>
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
