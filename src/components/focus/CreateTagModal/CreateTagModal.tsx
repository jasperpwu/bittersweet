import React, { FC, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Keyboard, useColorScheme, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { Button } from '../../ui/Button';
import { BottomSheet } from '../../ui/BottomSheet';
import { colors } from '../../../config/theme';
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
 * Self-contained "Create New Tag" bottom sheet — emoji + name + color + optional
 * activity type. Built on the shared BottomSheet (grab handle, drag-to-dismiss)
 * so it matches EditTagSheet; the emoji/color pickers ride the sheet's `overlay`
 * slot so they cover the full screen without a second native modal.
 */
export const CreateTagModal: FC<CreateTagModalProps> = ({
  visible,
  onClose,
  onCreated,
  onUpgradeNeeded,
}) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const { height: screenHeight } = useWindowDimensions();
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

  const canSubmit = !!name.trim() && !!emoji;

  return (
    <BottomSheet
      isVisible={visible}
      onClose={handleClose}
      height={screenHeight * 0.58}
      scrollable
      footer={
        <View className="border-t border-light-border px-6 pb-2 pt-3 dark:border-dark-border">
          <Button
            variant="primary"
            size="large"
            fullWidth
            disabled={!canSubmit}
            className="rounded-2xl py-4"
            onPress={handleCreate}>
            <Typography variant="subtitle-16" color="white" className="font-semibold">
              {t('home.createTag')}
            </Typography>
          </Button>
        </View>
      }
      overlay={
        <>
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
          {t('home.createNewTagTitle')}
        </Typography>
      </View>

      {/* Emoji + Name row */}
      <View className="mb-6 flex-row items-center" style={{ gap: 12 }}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setShowEmojiPicker(true);
          }}
          className="h-12 w-12 items-center justify-center rounded-xl border border-light-border bg-light-border/30 active:opacity-80 dark:border-dark-border dark:bg-dark-card">
          {emoji ? (
            <Text className="text-2xl">{emoji}</Text>
          ) : (
            <Ionicons name="happy-outline" size={24} color={colors.primary} />
          )}
        </Pressable>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('home.tagNamePlaceholder')}
          placeholderTextColor={colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary}
          className="flex-1"
          style={{
            backgroundColor: colorScheme === 'dark' ? colors.dark.input : colors.light.input,
            borderRadius: 12,
            padding: 14,
            fontSize: 16,
            color: colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary,
            borderWidth: 1,
            borderColor: colorScheme === 'dark' ? colors.dark.border : colors.light.screenBorder,
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
          className="flex-row items-center justify-between rounded-xl border border-light-border bg-light-border/30 px-4 py-3 active:opacity-80 dark:border-dark-border dark:bg-dark-card">
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color }} />
          <Ionicons name="chevron-forward" size={18} color={colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary} />
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
