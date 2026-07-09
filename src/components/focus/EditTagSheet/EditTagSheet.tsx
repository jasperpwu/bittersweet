import React, { FC, useEffect, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  Pressable,
  TextInput,
  Keyboard,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { BottomSheet } from '../../ui/BottomSheet';
import { EmojiPickerOverlay } from '../../ui/EmojiPicker/EmojiPicker';
import { ColorPickerOverlay } from '../TagColorPicker/TagColorPicker';
import { ActivityTypePicker } from '../ActivityTypePicker/ActivityTypePicker';
import { useAppStore, useFocus } from '../../../store';
import { inferActivityType } from '../../../utils/inferActivityType';
import type { ActivityType } from '../../../utils/focusRating';

interface EditTagSheetProps {
  visible: boolean;
  /** Id of the tag being edited; null when nothing is open. */
  tagId: string | null;
  onClose: () => void;
}

/**
 * Edit-tag bottom sheet — the same emoji + name + color + activity-type form as
 * CreateTagModal, but seeded from an existing tag and saved via updateTag. Built
 * on the shared BottomSheet (grab handle, drag-to-dismiss) and stacks on top of
 * the home tag picker, mirroring how TodoEditModal stacks on TodoSheet. The
 * emoji/color pickers ride the sheet's `overlay` slot so they cover the full
 * screen without a second native modal (matches CreateTagModal's overlays).
 */
export const EditTagSheet: FC<EditTagSheetProps> = ({ visible, tagId, onClose }) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const { height: screenHeight } = useWindowDimensions();
  const { tags } = useFocus();
  const updateTag = useAppStore((s) => s.focus.updateTag);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState('#6592E9');
  const [activityType, setActivityType] = useState<ActivityType | undefined>(undefined);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Tracks whether the user has manually picked an activity type this session;
  // once they have, name-based inference stops overriding their choice.
  const activityTouched = useRef(false);
  // Snapshot of the tag as seeded, so a Save writes only changed fields and a
  // dismiss can confirm before discarding unsaved edits.
  const initialRef = useRef({
    name: '',
    emoji: '',
    color: '#6592E9',
    activityType: undefined as ActivityType | undefined,
  });

  // Re-seed the form each time the sheet opens (or the target tag changes).
  useEffect(() => {
    if (!visible || !tagId) return;
    const tag = tags.byId[tagId];
    if (!tag) return;
    const seeded = {
      name: tag.name ?? '',
      emoji: tag.icon ?? '',
      color: tag.color ?? '#6592E9',
      activityType: tag.activityType,
    };
    setName(seeded.name);
    setEmoji(seeded.emoji);
    setColor(seeded.color);
    setActivityType(seeded.activityType);
    setShowEmojiPicker(false);
    setShowColorPicker(false);
    // Respect an already-set type; only auto-infer when the tag had none.
    activityTouched.current = !!tag.activityType;
    initialRef.current = seeded;
    // Seed only on open / tag change — pulling in `tags` would reset mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tagId]);

  // Debounced inference of the activity type from the name, until the user
  // makes their own choice.
  useEffect(() => {
    if (!visible || activityTouched.current) return;
    const current = name;
    const timer = setTimeout(() => {
      if (activityTouched.current) return;
      setActivityType(inferActivityType(current) ?? undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [name, visible]);

  const isDirty = () => {
    const init = initialRef.current;
    return (
      name.trim() !== init.name ||
      emoji !== init.emoji ||
      color !== init.color ||
      activityType !== init.activityType
    );
  };

  // Prompt before throwing away unsaved edits; Discard drives the actual close.
  const promptDiscard = () => {
    Alert.alert(t('home.discardTitle'), t('home.discardMessage'), [
      { text: t('home.keepEditing'), style: 'cancel' },
      { text: t('home.discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  // Guard for BottomSheet (swipe / backdrop / hardware back).
  const handleBeforeClose = (): boolean => {
    if (!isDirty()) return true;
    promptDiscard();
    return false;
  };

  const handleSave = () => {
    if (!tagId || !name.trim()) return;
    const init = initialRef.current;
    const updates: Record<string, unknown> = {};
    if (name.trim() !== init.name) updates.name = name.trim();
    if (emoji !== init.emoji) updates.icon = emoji;
    if (color !== init.color) updates.color = color;
    if (activityType !== init.activityType) updates.activityType = activityType ?? null;
    if (Object.keys(updates).length > 0) updateTag(tagId, updates);
    onClose();
  };

  return (
    <BottomSheet
      isVisible={visible}
      onClose={onClose}
      height={screenHeight * 0.58}
      scrollable
      beforeClose={handleBeforeClose}
      footer={
        <View className="border-t border-light-border px-6 pb-2 pt-3 dark:border-gray-700">
          <Pressable
            onPress={handleSave}
            disabled={!name.trim()}
            className={`items-center rounded-2xl py-4 ${
              name.trim() ? 'bg-blue-600 active:opacity-80' : 'bg-gray-500 opacity-50'
            }`}>
            <Typography variant="subtitle-16" color="white" className="font-semibold">
              {t('common.save')}
            </Typography>
          </Pressable>
        </View>
      }
      overlay={
        <>
          {showEmojiPicker && (
            <EmojiPickerOverlay
              title={t('home.chooseEmojiTag')}
              onClose={() => setShowEmojiPicker(false)}
              onEmojiSelect={(picked) => {
                setEmoji(picked);
                setShowEmojiPicker(false);
              }}
            />
          )}
          {showColorPicker && (
            <ColorPickerOverlay
              title={t('home.chooseColor')}
              selectedColor={color}
              onSelectColor={setColor}
              onClose={() => setShowColorPicker(false)}
            />
          )}
        </>
      }>
      {/* Header */}
      <View className="mb-6">
        <Typography variant="headline-20" color="primary">
          {t('home.editTag')}
        </Typography>
      </View>

      {/* Emoji + Name row */}
      <View className="mb-6 flex-row items-center" style={{ gap: 12 }}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowEmojiPicker(true);
          }}
          className="h-12 w-12 items-center justify-center rounded-xl border border-light-border bg-light-border/30 active:opacity-80 dark:border-gray-500 dark:bg-gray-700">
          {emoji ? (
            <Text className="text-2xl">{emoji}</Text>
          ) : (
            <Ionicons name="happy-outline" size={24} color="#6592E9" />
          )}
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('home.tagNamePlaceholder')}
          placeholderTextColor="#666"
          className="flex-1"
          style={{
            backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
            borderRadius: 12,
            padding: 14,
            fontSize: 16,
            color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
          }}
        />
      </View>

      {/* Color Selection */}
      <View>
        <Typography variant="body-14" color="primary" className="mb-3">
          {t('home.color')}
        </Typography>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowColorPicker(true);
          }}
          className="flex-row items-center justify-between rounded-xl border border-light-border bg-light-border/30 px-4 py-3 active:opacity-80 dark:border-gray-500 dark:bg-gray-700">
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color }} />
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Activity type (optional) — improves focus-rating accuracy */}
      <View className="mt-4">
        <Typography variant="body-14" color="primary" className="mb-1">
          {t('home.activityType')}
        </Typography>
        <Typography variant="body-12" color="secondary" className="mb-3">
          {t('home.activityTypeHint')}
        </Typography>
        <ActivityTypePicker
          value={activityType}
          onChange={(v) => {
            activityTouched.current = true;
            setActivityType(v);
          }}
        />
        {activityType && !activityTouched.current && (
          <Typography variant="body-12" color="secondary" className="mt-2">
            {t('home.suggestedFromName')}
          </Typography>
        )}
      </View>
    </BottomSheet>
  );
};
