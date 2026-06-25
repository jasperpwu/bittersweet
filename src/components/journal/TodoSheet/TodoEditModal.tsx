import React, { FC, useEffect, useMemo, useState } from 'react';
import { View, TextInput, Pressable, ScrollView, useColorScheme, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Modal, Typography, DatePicker, TimePicker, Slider } from '../../ui';
import { showToast } from '../../ui/Toast';
import { HorizontalTagSelector } from '../../focus/TagSelector';
import { useFocus, useTodoActions } from '../../../store';
import { colors } from '../../../config/theme';
import type { Todo } from '../../../store/types';

interface TodoEditModalProps {
  isVisible: boolean;
  onClose: () => void;
  todo: Todo | null; // null => create mode
  initialTagId?: string | null; // preselect tag in create mode (e.g. active filter)
}

const DEFAULT_DURATION = 25;

export const TodoEditModal: FC<TodoEditModalProps> = ({
  isVisible,
  onClose,
  todo,
  initialTagId,
}) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { height: screenHeight } = useWindowDimensions();
  const { tags } = useFocus();
  const { createTodo, updateTodo, deleteTodo, restoreTodo } = useTodoActions();

  const activeTags = useMemo(
    () => tags.allIds.map((id) => tags.byId[id]).filter((tg) => tg && !tg.deletedAt),
    [tags]
  );

  const [name, setName] = useState('');
  const [tagId, setTagId] = useState('');
  const [startEnabled, setStartEnabled] = useState(false);
  const [startAt, setStartAt] = useState<Date>(new Date());
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [notes, setNotes] = useState('');

  // Re-seed the form whenever the modal opens (or the target todo changes).
  useEffect(() => {
    if (!isVisible) return;
    if (todo) {
      setName(todo.name);
      setTagId(todo.tagId);
      setStartEnabled(!!todo.startAt);
      setStartAt(todo.startAt ? new Date(todo.startAt) : roundedNow());
      setDurationEnabled(todo.durationMinutes != null);
      setDuration(todo.durationMinutes ?? DEFAULT_DURATION);
      setNotes(todo.notes ?? '');
    } else {
      setName('');
      setTagId(initialTagId ?? activeTags[0]?.id ?? '');
      setStartEnabled(false);
      setStartAt(roundedNow());
      setDurationEnabled(false);
      setDuration(DEFAULT_DURATION);
      setNotes('');
    }
    // Re-seed only when the modal opens or the target todo changes — pulling in
    // activeTags/initialTagId would reset the form mid-edit when tags update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, todo]);

  const canSave = name.trim().length > 0 && tagId.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      tagId,
      startAt: startEnabled ? startAt : undefined,
      durationMinutes: durationEnabled ? duration : undefined,
      notes: notes.trim() || undefined,
    };
    if (todo) {
      updateTodo(todo.id, payload);
    } else {
      createTodo(payload);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!todo) return;
    const id = todo.id;
    deleteTodo(id);
    onClose();
    showToast(
      t('todos.deleted'),
      'neutral',
      { label: t('todos.undo'), onPress: () => restoreTodo(id) },
      undefined,
      'bottom',
    );
  };

  const placeholder = isDark ? colors.dark.textSecondary : colors.light.textSecondary;

  return (
    <Modal isVisible={isVisible} onClose={onClose} size="large">
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: screenHeight * 0.7 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Typography variant="headline-20" color="primary">
            {todo ? t('todos.editTitle') : t('todos.newTitle')}
          </Typography>
          <Pressable onPress={onClose} className="p-1 active:opacity-70" hitSlop={8}>
            <Ionicons name="close" size={24} color={placeholder} />
          </Pressable>
        </View>

        {/* Name */}
        <Typography variant="body-12" color="secondary" className="mb-2">
          {t('todos.nameLabel')}
        </Typography>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('todos.namePlaceholder')}
          placeholderTextColor={placeholder}
          className="text-light-text-primary dark:text-dark-text-primary bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 mb-5"
          returnKeyType="done"
        />

        {/* Tag (required) */}
        <Typography variant="body-12" color="secondary" className="mb-2">
          {t('todos.tagLabel')}
        </Typography>
        <View className="mb-5">
          <HorizontalTagSelector
            tags={activeTags}
            selectedTags={tagId ? [tagId] : []}
            onTagSelect={(id) => setTagId(id)}
            maxSelections={1}
          />
        </View>

        {/* Start date + time (optional) */}
        <Pressable
          onPress={() => setStartEnabled((v) => !v)}
          className="flex-row items-center justify-between mb-2 active:opacity-70"
        >
          <Typography variant="body-14" color="primary">
            {t('todos.startLabel')}
          </Typography>
          <Ionicons
            name={startEnabled ? 'checkbox' : 'square-outline'}
            size={22}
            color={startEnabled ? colors.primary : placeholder}
          />
        </Pressable>
        {startEnabled && (
          <View className="flex-row gap-3 mb-5">
            <View className="flex-1">
              <DatePicker value={startAt} onChange={setStartAt} />
            </View>
            <View className="flex-1">
              <TimePicker value={startAt} onChange={setStartAt} />
            </View>
          </View>
        )}

        {/* Duration (optional) */}
        <Pressable
          onPress={() => setDurationEnabled((v) => !v)}
          className="flex-row items-center justify-between mb-2 active:opacity-70"
        >
          <Typography variant="body-14" color="primary">
            {t('todos.durationLabel')}
          </Typography>
          <Ionicons
            name={durationEnabled ? 'checkbox' : 'square-outline'}
            size={22}
            color={durationEnabled ? colors.primary : placeholder}
          />
        </Pressable>
        {durationEnabled && (
          <View className="mb-5 mt-1">
            <Slider
              value={duration}
              minimumValue={5}
              maximumValue={120}
              step={5}
              onValueChange={setDuration}
              label={t('todos.durationLabel')}
              unit="m"
            />
          </View>
        )}

        {/* Notes */}
        <Typography variant="body-12" color="secondary" className="mb-2">
          {t('todos.notesLabel')}
        </Typography>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder={t('todos.notesPlaceholder')}
          placeholderTextColor={placeholder}
          multiline
          className="text-light-text-primary dark:text-dark-text-primary bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3 mb-5 min-h-[80px]"
          style={{ textAlignVertical: 'top' }}
        />

        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          className={`py-3.5 rounded-xl items-center ${canSave ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'}`}
        >
          <Typography variant="subtitle-16" color="white">
            {t('common.save')}
          </Typography>
        </Pressable>

        {/* Delete (edit mode only) */}
        {todo && (
          <Pressable
            onPress={handleDelete}
            className="py-3.5 mt-3 rounded-xl items-center flex-row justify-center active:opacity-70"
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} style={{ marginRight: 6 }} />
            <Typography variant="subtitle-16" style={{ color: colors.error }}>
              {t('common.delete')}
            </Typography>
          </Pressable>
        )}
      </ScrollView>
    </Modal>
  );
};

function roundedNow(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}
