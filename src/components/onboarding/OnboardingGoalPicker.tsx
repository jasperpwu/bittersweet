import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from '../ui/Typography';
import { Slider } from '../ui/Slider';
import { useAppSettings } from '../../store/unified-store';
import { colors } from '../../config/theme';
import { resolveDraftName, type OnboardingTagDraft } from './OnboardingTagPicker';

/**
 * Daily targets offered during onboarding, in hours. Deliberately a shorter
 * ladder than FocusGoalForm's (which runs to 12h) — this screen's whole message
 * is "start small", and a 12h stop invites a first-day goal nobody keeps. The
 * full range stays available later from the real goal form.
 */
const DAILY_HOUR_STOPS = [0.25, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

/** The default daily target, matching FocusGoalForm's own default. */
const DEFAULT_DAILY_HOURS = 1;

/**
 * The user's onboarding goal pick. `slot` indexes into the tag drafts rather
 * than naming a tag: the tags don't exist yet (they're created at
 * completeOnboarding), and a slot survives both renaming and drag-swapping,
 * neither of which a name or suggestionKey would.
 */
export interface OnboardingGoalChoice {
  slot: number;
  dailyTargetMinutes: number;
}

export function defaultGoalChoice(): OnboardingGoalChoice {
  return { slot: 0, dailyTargetMinutes: DEFAULT_DAILY_HOURS * 60 };
}

/** "1h" / "1h 30m" / "15m" — same shape as FocusGoalForm's slider readout. */
function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

interface OnboardingGoalPickerProps {
  /** The three tag drafts from the previous slide, read fresh on each render. */
  drafts: OnboardingTagDraft[];
  /** Reports every change so the parent can activate the goal at completion. */
  onChange: (choice: OnboardingGoalChoice) => void;
  /** True while the slider is in hand — the parent pauses pager scrolling. */
  onDragActiveChange: (active: boolean) => void;
}

/**
 * Onboarding goal picker: choose one of the three tag drafts and give it a
 * daily target. Single-select is not a simplification — free tier allows
 * exactly one active goal (`useSubscriptionGate` FREE_LIMITS.maxActiveGoals).
 *
 * Nothing is persisted here. The parent mirrors the choice into a ref and
 * activates the tag's auto-created goal inside completeOnboarding, once the
 * real tags exist.
 */
export function OnboardingGoalPicker({
  drafts,
  onChange,
  onDragActiveChange,
}: OnboardingGoalPickerProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { preferences } = useAppSettings();

  const [slot, setSlot] = useState(0);
  const [dailyHours, setDailyHours] = useState(DEFAULT_DAILY_HOURS);

  useEffect(() => {
    onChange({ slot, dailyTargetMinutes: Math.round(dailyHours * 60) });
  }, [slot, dailyHours, onChange]);

  // Backstop for unmount mid-drag. The Slider itself now reports completion for
  // cancelled and failed gestures too (its onFinish handler), so this is only a
  // safety net for the slide being torn down with a finger still down.
  useEffect(() => () => onDragActiveChange(false), [onDragActiveChange]);

  const dayLabels = t('goals.dayAbbr').split(',');
  // Listed Monday-first to match the rest of the app's week (see getWeekStart),
  // so the default [Sun, Sat] reads as "Sat, Sun" instead of wrapping around.
  const restDaysLabel = [...(preferences.restDays || [0, 6])]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => dayLabels[d])
    .join(', ');

  return (
    <View className="w-full self-center" style={{ maxWidth: 340 }}>
      {/* Tag chooser — one of the three slots just picked. */}
      <View style={{ gap: 8 }} className="mb-6">
        {drafts.map((draft, index) => {
          const isSelected = slot === index;
          const name = resolveDraftName(draft, t);
          return (
            <Pressable
              key={index}
              onPress={() => setSlot(index)}
              className="flex-row items-center rounded-2xl px-3 py-2.5"
              style={{
                backgroundColor: isSelected
                  ? draft.color + '14'
                  : isDark
                    ? colors.dark.input
                    : colors.light.input,
                borderWidth: 2,
                borderColor: isSelected ? draft.color : 'transparent',
              }}>
              <View
                className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: draft.color + '26' }}>
                <Text style={{ fontSize: 22 }}>{draft.emoji}</Text>
              </View>
              <Typography variant="body-16" color="primary" className="flex-1">
                {name || t('onboarding.tagNamePlaceholder')}
              </Typography>
              {isSelected && (
                <View
                  className="h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: draft.color }}>
                  <Text style={{ fontSize: 11, color: colors.white }}>✓</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Daily target — the only control; period is fixed to daily. */}
      <Typography variant="subtitle-16" color="primary" className="mb-2">
        {t('onboarding.dailyTargetLabel')}
      </Typography>
      <View className="items-center rounded-xl bg-light-input px-4 py-3 dark:bg-dark-input">
        <Typography variant="headline-20" color="primary" className="mb-1">
          {formatHours(dailyHours)}
        </Typography>
        {/* The slider drags on the same axis as the pager, so it claims the
            gesture for its duration. onValueChange fires from the handler's
            onStart, so the pager is frozen from the moment the drag activates. */}
        <Slider
          value={dailyHours}
          minimumValue={DAILY_HOUR_STOPS[0]}
          maximumValue={DAILY_HOUR_STOPS[DAILY_HOUR_STOPS.length - 1]}
          snapPoints={DAILY_HOUR_STOPS}
          onValueChange={(value) => {
            onDragActiveChange(true);
            setDailyHours(value);
          }}
          onSlidingComplete={() => onDragActiveChange(false)}
          unit="h"
        />
      </View>

      {/* Rest days stay at 0 and aren't editable here — the line exists to teach
          that rest days are a thing and won't count against them. */}
      <Typography variant="body-12" color="secondary" className="mt-2">
        {t('onboarding.restDaysNote', { days: restDaysLabel })}
      </Typography>
    </View>
  );
}
