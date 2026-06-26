import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  View,
  TextInput,
  Pressable,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography, DatePicker, TimePicker, Slider } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { showToast } from '../../ui/Toast';
import { HorizontalTagSelector } from '../../focus/TagSelector';
import { useFocus, useTodoActions } from '../../../store';
import { colors } from '../../../config/theme';
import { ensureTodoNotificationPermission } from '../../../services/notifications/todos';
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
  const [startTimeEnabled, setStartTimeEnabled] = useState(false);
  const [startAt, setStartAt] = useState<Date>(new Date());
  const [deadlineEnabled, setDeadlineEnabled] = useState(false);
  const [deadlineTimeEnabled, setDeadlineTimeEnabled] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<Date>(new Date());
  const [durationEnabled, setDurationEnabled] = useState(false);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [notes, setNotes] = useState('');

  // Signature of the form as last seeded — compared against the live form to
  // tell whether there are unsaved changes worth confirming before discard.
  const initialSigRef = useRef('');

  // Re-seed the form whenever the modal opens (or the target todo changes).
  useEffect(() => {
    if (!isVisible) return;
    const seed: FormState = todo
      ? {
          name: todo.name,
          tagId: todo.tagId,
          startEnabled: !!todo.startAt,
          // Legacy todos have no startHasTime flag but always carried a time.
          startTimeEnabled: todo.startAt ? (todo.startHasTime ?? true) : false,
          startAt: todo.startAt ? new Date(todo.startAt) : roundedNow(),
          deadlineEnabled: !!todo.deadlineAt,
          deadlineTimeEnabled: !!todo.deadlineAt && !!todo.deadlineHasTime,
          deadlineAt: todo.deadlineAt ? new Date(todo.deadlineAt) : endOfToday(),
          durationEnabled: todo.durationMinutes != null,
          duration: todo.durationMinutes ?? DEFAULT_DURATION,
          notes: todo.notes ?? '',
        }
      : {
          name: '',
          tagId: initialTagId ?? activeTags[0]?.id ?? '',
          startEnabled: false,
          startTimeEnabled: false,
          startAt: roundedNow(),
          deadlineEnabled: false,
          deadlineTimeEnabled: false,
          deadlineAt: endOfToday(),
          durationEnabled: false,
          duration: DEFAULT_DURATION,
          notes: '',
        };
    setName(seed.name);
    setTagId(seed.tagId);
    setStartEnabled(seed.startEnabled);
    setStartTimeEnabled(seed.startTimeEnabled);
    setStartAt(seed.startAt);
    setDeadlineEnabled(seed.deadlineEnabled);
    setDeadlineTimeEnabled(seed.deadlineTimeEnabled);
    setDeadlineAt(seed.deadlineAt);
    setDurationEnabled(seed.durationEnabled);
    setDuration(seed.duration);
    setNotes(seed.notes);
    initialSigRef.current = formSignature(seed);
    // Re-seed only when the modal opens or the target todo changes — pulling in
    // activeTags/initialTagId would reset the form mid-edit when tags update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, todo]);

  const isDirty = () =>
    formSignature({
      name,
      tagId,
      startEnabled,
      startTimeEnabled,
      startAt,
      deadlineEnabled,
      deadlineTimeEnabled,
      deadlineAt,
      durationEnabled,
      duration,
      notes,
    }) !== initialSigRef.current;

  // Prompt before throwing away unsaved edits; the Discard button drives the
  // actual close. Returns false to tell BottomSheet to keep the sheet open.
  const promptDiscard = () => {
    Alert.alert(t('todos.discardTitle'), t('todos.discardMessage'), [
      { text: t('todos.keepEditing'), style: 'cancel' },
      { text: t('todos.discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  // Guard for BottomSheet (swipe / backdrop / hardware back): allow the close
  // only when there's nothing unsaved.
  const handleBeforeClose = (): boolean => {
    if (!isDirty()) return true;
    promptDiscard();
    return false;
  };

  // Guard for the explicit close (X) button.
  const handleClosePress = () => {
    if (isDirty()) promptDiscard();
    else onClose();
  };

  const canSave = name.trim().length > 0 && tagId.length > 0;

  // When the user sets a start, make sure we can actually deliver the reminder.
  // Requests the system prompt if it hasn't been shown; points permanently-denied
  // users at Settings so the start time isn't silently useless.
  const ensureNotifications = async () => {
    const result = await ensureTodoNotificationPermission();
    if (result === 'denied') {
      Alert.alert(t('todos.notifPermTitle'), t('todos.notifPermMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('todos.openSettings'), onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    if (startEnabled) ensureNotifications();
    const payload = {
      name: name.trim(),
      tagId,
      startAt: startEnabled ? startAt : undefined,
      startHasTime: startEnabled ? startTimeEnabled : undefined,
      deadlineAt: deadlineEnabled ? deadlineAt : undefined,
      deadlineHasTime: deadlineEnabled ? deadlineTimeEnabled : undefined,
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
      'bottom'
    );
  };

  const placeholder = isDark ? colors.dark.textSecondary : colors.light.textSecondary;

  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      height={screenHeight * 0.85}
      scrollable
      beforeClose={handleBeforeClose}>
      {/* Header */}
      <View className="mb-4 flex-row items-center justify-between">
        <Typography variant="headline-20" color="primary">
          {todo ? t('todos.editTitle') : t('todos.newTitle')}
        </Typography>
        <Pressable onPress={handleClosePress} className="p-1 active:opacity-70" hitSlop={8}>
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
        className="mb-5 rounded-xl bg-black/5 px-4 py-3 text-light-text-primary dark:bg-white/5 dark:text-dark-text-primary"
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

      {/* Start: date always, time optional */}
      <Pressable
        onPress={() => setStartEnabled((v) => !v)}
        className="mb-2 flex-row items-center justify-between active:opacity-70">
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
        <View className="mb-5 gap-3">
          <DatePicker value={startAt} onChange={setStartAt} />
          <Pressable
            onPress={() => setStartTimeEnabled((v) => !v)}
            className="flex-row items-center justify-between active:opacity-70">
            <Typography variant="body-12" color="secondary">
              {t('todos.setTime')}
            </Typography>
            <Ionicons
              name={startTimeEnabled ? 'checkbox' : 'square-outline'}
              size={20}
              color={startTimeEnabled ? colors.primary : placeholder}
            />
          </Pressable>
          {startTimeEnabled && <TimePicker value={startAt} onChange={setStartAt} />}
        </View>
      )}

      {/* Deadline: date always, time optional */}
      <Pressable
        onPress={() => setDeadlineEnabled((v) => !v)}
        className="mb-2 flex-row items-center justify-between active:opacity-70">
        <Typography variant="body-14" color="primary">
          {t('todos.deadlineLabel')}
        </Typography>
        <Ionicons
          name={deadlineEnabled ? 'checkbox' : 'square-outline'}
          size={22}
          color={deadlineEnabled ? colors.primary : placeholder}
        />
      </Pressable>
      {deadlineEnabled && (
        <View className="mb-5 gap-3">
          <DatePicker value={deadlineAt} onChange={setDeadlineAt} />
          <Pressable
            onPress={() => setDeadlineTimeEnabled((v) => !v)}
            className="flex-row items-center justify-between active:opacity-70">
            <Typography variant="body-12" color="secondary">
              {t('todos.setTime')}
            </Typography>
            <Ionicons
              name={deadlineTimeEnabled ? 'checkbox' : 'square-outline'}
              size={20}
              color={deadlineTimeEnabled ? colors.primary : placeholder}
            />
          </Pressable>
          {deadlineTimeEnabled && <TimePicker value={deadlineAt} onChange={setDeadlineAt} />}
        </View>
      )}

      {/* Duration (optional) */}
      <Pressable
        onPress={() => setDurationEnabled((v) => !v)}
        className="mb-2 flex-row items-center justify-between active:opacity-70">
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
        className="mb-5 min-h-[80px] rounded-xl bg-black/5 px-4 py-3 text-light-text-primary dark:bg-white/5 dark:text-dark-text-primary"
        style={{ textAlignVertical: 'top' }}
      />

      {/* Save */}
      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        className={`items-center rounded-xl py-3.5 ${canSave ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'}`}>
        <Typography variant="subtitle-16" color="white">
          {t('common.save')}
        </Typography>
      </Pressable>

      {/* Delete (edit mode only) */}
      {todo && (
        <Pressable
          onPress={handleDelete}
          className="mt-3 flex-row items-center justify-center rounded-xl py-3.5 active:opacity-70">
          <Ionicons
            name="trash-outline"
            size={18}
            color={colors.error}
            style={{ marginRight: 6 }}
          />
          <Typography variant="subtitle-16" style={{ color: colors.error }}>
            {t('common.delete')}
          </Typography>
        </Pressable>
      )}
    </BottomSheet>
  );
};

interface FormState {
  name: string;
  tagId: string;
  startEnabled: boolean;
  startTimeEnabled: boolean;
  startAt: Date;
  deadlineEnabled: boolean;
  deadlineTimeEnabled: boolean;
  deadlineAt: Date;
  durationEnabled: boolean;
  duration: number;
  notes: string;
}

// Stable string capturing only what a Save would persist, so two states that
// save identically compare equal. Disabled sections collapse to null and the
// hidden date/time of those sections is ignored.
function formSignature(s: FormState): string {
  return JSON.stringify({
    name: s.name.trim(),
    tagId: s.tagId,
    start: s.startEnabled ? { t: s.startAt.getTime(), hasTime: s.startTimeEnabled } : null,
    deadline: s.deadlineEnabled
      ? { t: s.deadlineAt.getTime(), hasTime: s.deadlineTimeEnabled }
      : null,
    duration: s.durationEnabled ? s.duration : null,
    notes: s.notes.trim(),
  });
}

function roundedNow(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d;
}
