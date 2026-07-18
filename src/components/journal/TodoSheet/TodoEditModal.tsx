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
import { Typography, DatePicker, TimePicker, Slider, Toggle } from '../../ui';
import { BottomSheet } from '../../ui/BottomSheet';
import { showToast } from '../../ui/Toast';
import { HorizontalTagSelector } from '../../focus/TagSelector';
import { CreateTagModal } from '../../focus';
import { useFocus, useTodoActions } from '../../../store';
import { colors } from '../../../config/theme';
import { ensureTodoNotificationPermission } from '../../../services/notifications/todos';
import type { Todo, TodoRecurrence } from '../../../store/types';

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
  const { t, i18n } = useTranslation();
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
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [startEnabled, setStartEnabled] = useState(false);
  const [startTimeEnabled, setStartTimeEnabled] = useState(false);
  const [startAt, setStartAt] = useState<Date>(new Date());
  const [repeat, setRepeat] = useState<RepeatChoice>('none');
  const [customFreq, setCustomFreq] = useState<'weekly' | 'monthly'>('weekly');
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([]);
  const [customMonthDay, setCustomMonthDay] = useState(1);
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
          ...repeatSeed(todo.recurrence, todo.startAt ? new Date(todo.startAt) : roundedNow()),
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
          ...repeatSeed(undefined, roundedNow()),
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
    setRepeat(seed.repeat);
    setCustomFreq(seed.customFreq);
    setCustomWeekdays(seed.customWeekdays);
    setCustomMonthDay(seed.customMonthDay);
    initialSigRef.current = formSignature(seed);
    // Re-seed only when the modal opens or the target todo changes — pulling in
    // activeTags/initialTagId would reset the form mid-edit when tags update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, todo]);

  const currentForm = (): FormState => ({
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
    repeat,
    customFreq,
    customWeekdays,
    customMonthDay,
  });

  const isDirty = () => formSignature(currentForm()) !== initialSigRef.current;

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
      recurrence: recurrenceOf(currentForm()) ?? undefined,
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
      {/* Header — close is provided by BottomSheet's built-in button */}
      <Typography variant="headline-20" color="primary" className="mb-4">
        {todo ? t('todos.editTitle') : t('todos.newTitle')}
      </Typography>

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
          onCreateTag={() => setShowCreateTag(true)}
        />
      </View>

      {/* Start: date always, time optional */}
      <View className="mb-4 rounded-xl bg-black/5 px-4 py-3 dark:bg-white/5">
        <Pressable
          onPress={() => setStartEnabled((v) => !v)}
          className="flex-row items-center justify-between active:opacity-70">
          <Typography variant="body-14" color="primary">
            {t('todos.startLabel')}
          </Typography>
          <Toggle value={startEnabled} onValueChange={setStartEnabled} />
        </Pressable>
        {startEnabled && (
          <View className="mt-3 gap-3">
            <DatePicker value={startAt} onChange={setStartAt} />
            <Pressable
              onPress={() => setStartTimeEnabled((v) => !v)}
              className="flex-row items-center justify-between active:opacity-70">
              <Typography variant="body-12" color="secondary">
                {t('todos.setTime')}
              </Typography>
              <Toggle value={startTimeEnabled} onValueChange={setStartTimeEnabled} size="small" />
            </Pressable>
            {startTimeEnabled && <TimePicker value={startAt} onChange={setStartAt} />}
          </View>
        )}

        {/* Repeat (requires a start date) */}
        {startEnabled && (
          <View className="mt-4">
            <Typography variant="body-14" color="primary" className="mb-2">
              {t('todos.repeatLabel')}
            </Typography>
            <View className="flex-row flex-wrap gap-2">
              {REPEAT_CHOICES.map((choice) => {
                const selected = repeat === choice;
                return (
                  <Pressable
                    key={choice}
                    onPress={() => setRepeat(choice)}
                    className={`rounded-full px-3.5 py-2 active:opacity-70 ${
                      selected ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
                    }`}>
                    <Typography variant="body-12" color={selected ? 'white' : 'primary'}>
                      {t(REPEAT_LABEL_KEYS[choice])}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
            {repeat === 'weekly' && (
              <Typography variant="body-12" color="secondary" className="mt-2">
                {t('todos.repeatWeeklyHint', {
                  day: startAt.toLocaleDateString(i18n.language, { weekday: 'long' }),
                })}
              </Typography>
            )}
            {repeat === 'monthly' && (
              <Typography variant="body-12" color="secondary" className="mt-2">
                {t('todos.repeatMonthlyHint', { day: startAt.getDate() })}
              </Typography>
            )}
            {repeat === 'custom' && (
              <View className="mt-3">
                <View className="mb-3 flex-row gap-2">
                  {(['weekly', 'monthly'] as const).map((freq) => {
                    const selected = customFreq === freq;
                    return (
                      <Pressable
                        key={freq}
                        onPress={() => setCustomFreq(freq)}
                        className={`rounded-full px-3.5 py-2 active:opacity-70 ${
                          selected ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
                        }`}>
                        <Typography variant="body-12" color={selected ? 'white' : 'primary'}>
                          {t(
                            freq === 'weekly' ? 'todos.repeatOnWeekdays' : 'todos.repeatOnMonthDay'
                          )}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </View>
                {customFreq === 'weekly' ? (
                  // Same weekday-chip pattern as the rest-days picker in settings.
                  <View className="flex-row gap-x-2">
                    {t('preferences.dayInitials')
                      .split(',')
                      .map((label, dayIndex) => {
                        const isSelected = customWeekdays.includes(dayIndex);
                        return (
                          <Pressable
                            key={dayIndex}
                            onPress={() =>
                              setCustomWeekdays((prev) =>
                                isSelected
                                  ? prev.filter((d) => d !== dayIndex)
                                  : [...prev, dayIndex].sort((a, b) => a - b)
                              )
                            }
                            className={`h-9 w-9 items-center justify-center rounded-full ${
                              isSelected ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
                            }`}>
                            <Typography
                              variant="body-12"
                              color={isSelected ? 'white' : 'primary'}
                              className="font-poppins-medium">
                              {label}
                            </Typography>
                          </Pressable>
                        );
                      })}
                  </View>
                ) : (
                  <Slider
                    value={customMonthDay}
                    minimumValue={1}
                    maximumValue={31}
                    step={1}
                    onValueChange={setCustomMonthDay}
                    label={t('todos.repeatMonthDayLabel')}
                  />
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Deadline: date always, time optional */}
      <View className="mb-4 rounded-xl bg-black/5 px-4 py-3 dark:bg-white/5">
        <Pressable
          onPress={() => setDeadlineEnabled((v) => !v)}
          className="flex-row items-center justify-between active:opacity-70">
          <Typography variant="body-14" color="primary">
            {t('todos.deadlineLabel')}
          </Typography>
          <Toggle value={deadlineEnabled} onValueChange={setDeadlineEnabled} />
        </Pressable>
        {deadlineEnabled && (
          <View className="mt-3 gap-3">
            <DatePicker value={deadlineAt} onChange={setDeadlineAt} />
            <Pressable
              onPress={() => setDeadlineTimeEnabled((v) => !v)}
              className="flex-row items-center justify-between active:opacity-70">
              <Typography variant="body-12" color="secondary">
                {t('todos.setTime')}
              </Typography>
              <Toggle
                value={deadlineTimeEnabled}
                onValueChange={setDeadlineTimeEnabled}
                size="small"
              />
            </Pressable>
            {deadlineTimeEnabled && <TimePicker value={deadlineAt} onChange={setDeadlineAt} />}
          </View>
        )}
      </View>

      {/* Duration (optional) */}
      <View className="mb-5 rounded-xl bg-black/5 px-4 py-3 dark:bg-white/5">
        <Pressable
          onPress={() => setDurationEnabled((v) => !v)}
          className="flex-row items-center justify-between active:opacity-70">
          <Typography variant="body-14" color="primary">
            {t('todos.durationLabel')}
          </Typography>
          <Toggle value={durationEnabled} onValueChange={setDurationEnabled} />
        </Pressable>
        {durationEnabled && (
          <View className="mt-3">
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
      </View>

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

      <CreateTagModal
        visible={showCreateTag}
        onClose={() => setShowCreateTag(false)}
        onCreated={(tag) => setTagId(tag.id)}
      />
    </BottomSheet>
  );
};

const REPEAT_CHOICES = ['none', 'daily', 'weekly', 'monthly', 'custom'] as const;
type RepeatChoice = (typeof REPEAT_CHOICES)[number];

const REPEAT_LABEL_KEYS: Record<RepeatChoice, string> = {
  none: 'todos.repeatNone',
  daily: 'todos.repeatDaily',
  weekly: 'todos.repeatWeekly',
  monthly: 'todos.repeatMonthly',
  custom: 'todos.repeatCustom',
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
  repeat: RepeatChoice;
  customFreq: 'weekly' | 'monthly';
  customWeekdays: number[];
  customMonthDay: number;
}

// The recurrence a Save of this form state would persist (null = none).
// Presets derive their weekday / month-day from the chosen start date; custom
// weekly falls back to the start's weekday when no chip is selected.
function recurrenceOf(s: FormState): TodoRecurrence | null {
  if (!s.startEnabled || s.repeat === 'none') return null;
  if (s.repeat === 'daily') return { freq: 'daily' };
  if (s.repeat === 'weekly') return { freq: 'weekly', weekdays: [s.startAt.getDay()] };
  if (s.repeat === 'monthly') return { freq: 'monthly', monthDay: s.startAt.getDate() };
  if (s.customFreq === 'weekly') {
    const weekdays = s.customWeekdays.length
      ? [...s.customWeekdays].sort((a, b) => a - b)
      : [s.startAt.getDay()];
    return { freq: 'weekly', weekdays };
  }
  return { freq: 'monthly', monthDay: s.customMonthDay };
}

// Map a stored recurrence back onto the form's repeat controls. A weekly rule
// on exactly the start's weekday (or a monthly rule on the start's day) reads
// as its preset; anything else opens as Custom.
function repeatSeed(
  rec: TodoRecurrence | undefined,
  startDate: Date
): Pick<FormState, 'repeat' | 'customFreq' | 'customWeekdays' | 'customMonthDay'> {
  const seed = {
    repeat: 'none' as RepeatChoice,
    customFreq: 'weekly' as 'weekly' | 'monthly',
    customWeekdays: [] as number[],
    customMonthDay: startDate.getDate(),
  };
  if (!rec) return seed;
  if (rec.freq === 'daily') {
    seed.repeat = 'daily';
  } else if (rec.freq === 'weekly') {
    const weekdays = rec.weekdays ?? [];
    if (weekdays.length === 1 && weekdays[0] === startDate.getDay()) {
      seed.repeat = 'weekly';
    } else {
      seed.repeat = 'custom';
      seed.customWeekdays = weekdays;
    }
  } else {
    const monthDay = rec.monthDay ?? startDate.getDate();
    if (monthDay === startDate.getDate()) {
      seed.repeat = 'monthly';
    } else {
      seed.repeat = 'custom';
      seed.customFreq = 'monthly';
      seed.customMonthDay = monthDay;
    }
  }
  return seed;
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
    recurrence: recurrenceOf(s),
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
