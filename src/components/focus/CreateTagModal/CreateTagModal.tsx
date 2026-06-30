import React, { FC, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { EmojiPickerOverlay } from '../../ui/EmojiPicker/EmojiPicker';
import { ColorPickerOverlay } from '../TagColorPicker/TagColorPicker';
import { ActivityTypePicker } from '../ActivityTypePicker/ActivityTypePicker';
import { useAppStore } from '../../../store';
import { useSubscriptionGate } from '../../../hooks/useSubscriptionGate';
import { inferActivityType } from '../../../utils/inferActivityType';
import type { ActivityType } from '../../../utils/focusRating';
import type { SessionTag } from '../../../types/models';

interface CreateTagModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called with the freshly created tag after a successful create. */
  onCreated?: (tag: SessionTag) => void;
  /** Called when the subscription gate blocks tag creation. */
  onUpgradeNeeded?: () => void;
}

/**
 * Self-contained "Create New Tag" modal — the same experience as the home
 * screen's new-tag flow (emoji + name + color + optional activity type),
 * extracted so it can be reused from any tag selector.
 */
export const CreateTagModal: FC<CreateTagModalProps> = ({
  visible,
  onClose,
  onCreated,
  onUpgradeNeeded,
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const createTag = useAppStore((s) => s.focus.createTag);
  const { canCreateTag } = useSubscriptionGate();

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState('#6592E9');
  const [activityType, setActivityType] = useState<ActivityType | undefined>(undefined);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Tracks whether the user has manually picked an activity type this session;
  // once they have, name-based inference stops overriding their choice.
  const activityTouched = useRef(false);

  const reset = () => {
    setName('');
    setEmoji('');
    setColor('#6592E9');
    setActivityType(undefined);
    setShowEmojiPicker(false);
    setShowColorPicker(false);
  };

  // Reset the "touched" flag each time the modal opens.
  useEffect(() => {
    if (visible) activityTouched.current = false;
  }, [visible]);

  // Debounced inference of the activity type from the tag name. Only fills the
  // picker until the user makes their own choice.
  useEffect(() => {
    if (!visible || activityTouched.current) return;
    const current = name;
    const timer = setTimeout(() => {
      if (activityTouched.current) return;
      setActivityType(inferActivityType(current) ?? undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [name, visible]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!canCreateTag) {
      handleClose();
      onUpgradeNeeded?.();
      return;
    }
    if (name.trim() && emoji) {
      const newTag = createTag({
        name: name.trim(),
        icon: emoji,
        color,
        activityType,
      });
      reset();
      onClose();
      onCreated?.(newTag);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          onPress={handleClose}>
          <Pressable
            onPress={() => {}}
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-light-bg dark:bg-dark-bg">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between border-b border-light-border p-6 dark:border-gray-700">
              <Typography variant="headline-20" color="primary">
                {t('home.createNewTagTitle')}
              </Typography>
              <Pressable
                onPress={handleClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-light-border/50 dark:bg-gray-700">
                <Ionicons
                  name="close"
                  size={20}
                  color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'}
                />
              </Pressable>
            </View>

            {/* New Tag Form */}
            <View className="p-6">
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
                  autoFocus={true}
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
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: color,
                    }}
                  />
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Activity type (optional) — improves focus-rating accuracy */}
              <View className="mt-4">
                <Typography variant="body-14" color="primary" className="mb-1">
                  Activity type (optional)
                </Typography>
                <Typography variant="body-12" color="secondary" className="mb-3">
                  Helps suggest a focus rating from your motion.
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
                    ✨ Suggested from name — tap to change
                  </Typography>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View
              className="flex-row border-t border-light-border p-4 dark:border-gray-700"
              style={{ gap: 12 }}>
              <Pressable
                onPress={handleClose}
                className="flex-1 items-center rounded-2xl bg-gray-600 py-4 active:opacity-80">
                <Typography variant="subtitle-16" color="white">
                  {t('common.cancel')}
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={!name.trim() || !emoji}
                className={`flex-1 items-center rounded-2xl py-4 ${
                  name.trim() && emoji ? 'bg-blue-600 active:opacity-80' : 'bg-gray-500 opacity-50'
                }`}>
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  {t('home.createTag')}
                </Typography>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      {/* Emoji Picker Overlay (on top of the New Tag overlay) */}
      {showEmojiPicker && (
        <EmojiPickerOverlay
          title={t('home.chooseEmojiNewTag')}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={(picked) => {
            setEmoji(picked);
            setShowEmojiPicker(false);
          }}
        />
      )}

      {/* Color Picker Overlay (on top of the New Tag overlay) */}
      {showColorPicker && (
        <ColorPickerOverlay
          title={t('home.chooseColor')}
          selectedColor={color}
          onSelectColor={setColor}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </Modal>
  );
};
