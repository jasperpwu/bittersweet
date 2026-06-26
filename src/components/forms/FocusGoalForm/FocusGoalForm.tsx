import { FC, useState, useEffect, useRef } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { TotalTargetPicker } from './TotalTargetPicker';
import { useAppSettings } from '../../../store/unified-store';
import { FocusGoal } from '../../../store/types';

type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'none';

// Slider bounds (daily/weekly/monthly). No-period goals use the wheel picker
// instead of the slider, so their entries here are unused placeholders.
const MAX_HOURS: Record<GoalPeriod, number> = {
  daily: 12,
  weekly: 84,
  monthly: 360,
  none: 0,
};

const STEP_HOURS: Record<GoalPeriod, number> = {
  daily: 0.5,
  weekly: 1,
  monthly: 5,
  none: 0,
};

// Daily goals use non-uniform stops: 15m and 30m at the low end, then 30m
// increments (0:15, 0:30, 1:00, 1:30, ... up to 12h).
const DAILY_VALUES: number[] = [
  0.25,
  ...Array.from({ length: MAX_HOURS.daily * 2 }, (_, i) => (i + 1) * 0.5),
];

// Snap a daily-hours value to the nearest allowed stop.
const snapDailyHours = (hours: number, allowZero = false): number => {
  const points = allowZero ? [0, ...DAILY_VALUES] : DAILY_VALUES;
  return points.reduce((a, b) =>
    Math.abs(b - hours) < Math.abs(a - hours) ? b : a
  );
};

interface FocusGoalFormProps {
  onSubmit: (goal: {
    customName?: string;
    activePeriod: GoalPeriod;
    dailyTargetMinutes: number;
    dailyRestDayTargetMinutes: number;
    weeklyTargetMinutes: number;
    monthlyTargetMinutes: number;
    totalTargetMinutes: number;
    isRepeating: boolean;
    showTotalHours: boolean;
  }) => void;
  onCancel: () => void;
  editingGoal?: FocusGoal;
  tagName?: string;
  tagIcon?: string;
  // Reports whether the form has unsaved changes vs the values it was seeded
  // with, so the host sheet can confirm before a swipe/backdrop/✕ discards them.
  onDirtyChange?: (dirty: boolean) => void;
}

interface GoalFormSnapshot {
  activePeriod: GoalPeriod;
  dailyTargetHours: number;
  dailyRestDayTargetHours: number;
  weeklyTargetHours: number;
  monthlyTargetHours: number;
  totalTargetMinutes: number;
  showTotalHours: boolean;
  customGoalName: string;
}

// Stable string of everything a submit would persist, so two states that save
// identically compare equal.
function goalSignature(s: GoalFormSnapshot): string {
  return JSON.stringify({
    activePeriod: s.activePeriod,
    dailyTargetHours: s.dailyTargetHours,
    dailyRestDayTargetHours: s.dailyRestDayTargetHours,
    weeklyTargetHours: s.weeklyTargetHours,
    monthlyTargetHours: s.monthlyTargetHours,
    totalTargetMinutes: s.totalTargetMinutes,
    showTotalHours: s.showTotalHours,
    customGoalName: s.customGoalName.trim(),
  });
}

export const FocusGoalForm: FC<FocusGoalFormProps> = ({
  onSubmit,
  onCancel,
  editingGoal,
  tagName,
  tagIcon,
  onDirtyChange,
}) => {
  const { t } = useTranslation();
  const [dailyTargetHours, setDailyTargetHours] = useState(1);
  const [dailyRestDayTargetHours, setDailyRestDayTargetHours] = useState(0.5);
  const [weeklyTargetHours, setWeeklyTargetHours] = useState(7);
  const [monthlyTargetHours, setMonthlyTargetHours] = useState(30);
  // No-period (cumulative) target is picked via a wheel, so store raw minutes.
  const [totalTargetMinutes, setTotalTargetMinutes] = useState(100 * 60);
  const [activePeriod, setActivePeriod] = useState<GoalPeriod>('daily');
  const [customGoalName, setCustomGoalName] = useState('');
  const [showTotalHours, setShowTotalHours] = useState(true);

  const { preferences } = useAppSettings();

  const dayLabels = t('goals.dayAbbr').split(',');
  const restDaysLabel = (preferences.restDays || [0, 6])
    .map((d) => dayLabels[d])
    .join(', ');

  // Period selector labels (daily/weekly/monthly reuse the streaks-view terms).
  const periodLabel = (p: GoalPeriod): string =>
    p === 'none' ? t('goals.periodTotal') : t(`goalProgress.period${p[0].toUpperCase()}${p.slice(1)}`);

  // Auto-generated name
  const autoName = tagName
    ? t('insights.goalSuffix', { icon: tagIcon || '', name: tagName }).trim()
    : t('goals.focusGoalFallback');

  // Signature of the form as last seeded — compared against the live form to
  // tell whether there are unsaved changes worth confirming before discard.
  const initialSigRef = useRef('');

  // Populate form fields when editing
  useEffect(() => {
    let seed: GoalFormSnapshot;
    if (editingGoal) {
      const period = (editingGoal as any).activePeriod || (editingGoal as any).period || 'daily';

      // Per-period targets
      const daily = editingGoal.dailyTargetMinutes || 0;
      const weekly = editingGoal.weeklyTargetMinutes || 0;
      const monthly = editingGoal.monthlyTargetMinutes || 0;
      const total = editingGoal.totalTargetMinutes || 0;

      seed = {
        activePeriod: period === 'yearly' ? 'monthly' : period,
        dailyTargetHours: daily > 0 ? snapDailyHours(daily / 60) : 1,
        dailyRestDayTargetHours: snapDailyHours(
          (editingGoal.dailyRestDayTargetMinutes || 0) / 60,
          true
        ),
        weeklyTargetHours: weekly > 0 ? Math.round(weekly / 60) : 7,
        monthlyTargetHours: monthly > 0 ? Math.round(monthly / 60 / 5) * 5 : 30,
        totalTargetMinutes: total > 0 ? total : 100 * 60,
        showTotalHours: editingGoal.showTotalHours ?? true,
        customGoalName: editingGoal.customName || '',
      };
    } else {
      // Defaults when creating/activating
      seed = {
        activePeriod: 'daily',
        dailyTargetHours: 1,
        dailyRestDayTargetHours: 0.5,
        weeklyTargetHours: 7,
        monthlyTargetHours: 30,
        totalTargetMinutes: 100 * 60,
        showTotalHours: true,
        customGoalName: '',
      };
    }
    setActivePeriod(seed.activePeriod);
    setDailyTargetHours(seed.dailyTargetHours);
    setDailyRestDayTargetHours(seed.dailyRestDayTargetHours);
    setWeeklyTargetHours(seed.weeklyTargetHours);
    setMonthlyTargetHours(seed.monthlyTargetHours);
    setTotalTargetMinutes(seed.totalTargetMinutes);
    setShowTotalHours(seed.showTotalHours);
    setCustomGoalName(seed.customGoalName);
    initialSigRef.current = goalSignature(seed);
    onDirtyChange?.(false);
  }, [editingGoal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Report unsaved-changes state to the host sheet whenever the form drifts
  // from its seeded signature.
  useEffect(() => {
    const dirty =
      goalSignature({
        activePeriod,
        dailyTargetHours,
        dailyRestDayTargetHours,
        weeklyTargetHours,
        monthlyTargetHours,
        totalTargetMinutes,
        showTotalHours,
        customGoalName,
      }) !== initialSigRef.current;
    onDirtyChange?.(dirty);
  }, [
    activePeriod,
    dailyTargetHours,
    dailyRestDayTargetHours,
    weeklyTargetHours,
    monthlyTargetHours,
    totalTargetMinutes,
    showTotalHours,
    customGoalName,
    onDirtyChange,
  ]);

  // Get current period's target hours for the slider (daily/weekly/monthly).
  // No-period goals use the wheel picker below, not this slider abstraction.
  const currentTargetHours = activePeriod === 'daily' ? dailyTargetHours
    : activePeriod === 'weekly' ? weeklyTargetHours
    : monthlyTargetHours;

  const setCurrentTargetHours = (value: number) => {
    if (activePeriod === 'daily') setDailyTargetHours(value);
    else if (activePeriod === 'weekly') setWeeklyTargetHours(value);
    else setMonthlyTargetHours(value);
  };

  // Clamp when period changes
  useEffect(() => {
    // No-period goals are set via the wheel picker (raw minutes), not the slider.
    if (activePeriod === 'none') return;
    const max = MAX_HOURS[activePeriod];
    const step = STEP_HOURS[activePeriod];
    let clamped: number;
    if (activePeriod === 'daily') {
      clamped = snapDailyHours(Math.min(currentTargetHours, max));
    } else {
      clamped = Math.min(currentTargetHours, max);
      clamped = Math.round(clamped / step) * step;
      clamped = Math.max(step, clamped);
    }
    if (clamped !== currentTargetHours) {
      setCurrentTargetHours(clamped);
    }

    // Also clamp rest day target
    if (activePeriod === 'daily') {
      const clampedRest = snapDailyHours(Math.min(dailyRestDayTargetHours, max), true);
      if (clampedRest !== dailyRestDayTargetHours) {
        setDailyRestDayTargetHours(clampedRest);
      }
    }
  }, [activePeriod]);

  const handleSubmit = () => {
    const trimmedName = customGoalName.trim();

    onSubmit({
      customName: trimmedName || undefined,
      activePeriod,
      dailyTargetMinutes: dailyTargetHours * 60,
      dailyRestDayTargetMinutes: dailyRestDayTargetHours * 60,
      weeklyTargetMinutes: weeklyTargetHours * 60,
      monthlyTargetMinutes: monthlyTargetHours * 60,
      totalTargetMinutes,
      isRepeating: true,
      showTotalHours,
    });
  };

  const isValid = activePeriod === 'none' ? totalTargetMinutes > 0 : currentTargetHours > 0;

  const formatSliderValue = (hours: number): string => {
    if (hours === 0) return '0h';
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    if (minutes === 0) return `${wholeHours}h`;
    return `${wholeHours}h ${minutes}m`;
  };

  return (
    <View className="gap-y-4">
      {/* Goal Name */}
      <View>
        <Typography variant="subtitle-16" color="primary" className="mb-2">
          {t('goals.nameLabel')}
        </Typography>
        <TextInput
          value={customGoalName}
          onChangeText={setCustomGoalName}
          placeholder={autoName}
          placeholderTextColor="#6B7280"
          className="bg-light-border dark:bg-dark-border rounded-xl p-4 text-light-text-primary dark:text-white text-base"
          style={{ fontFamily: 'Poppins-Regular' }}
        />
      </View>

      {/* Time Period */}
      <View>
        <Typography variant="subtitle-16" color="primary" className="mb-2">
          {t('goals.timePeriod')}
        </Typography>
        <View className="flex-row gap-x-2">
          {(['daily', 'weekly', 'monthly', 'none'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setActivePeriod(p)}
              className={`flex-1 py-2.5 rounded-xl ${
                activePeriod === p ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
              }`}
            >
              <Typography
                variant="body-12"
                className={`text-center ${activePeriod === p ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
              >
                {periodLabel(p)}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Target Duration — slider for periodic goals, wheel picker for no-period */}
      <View>
        <Typography variant="subtitle-16" color="primary" className="mb-2">
          {activePeriod === 'daily' ? t('goals.regularDayTarget')
            : activePeriod === 'none' ? t('goals.totalTarget')
            : t('goals.targetDuration')}
        </Typography>
        {activePeriod === 'none' ? (
          <TotalTargetPicker value={totalTargetMinutes} onChange={setTotalTargetMinutes} />
        ) : (
          <View className="bg-light-border dark:bg-dark-border rounded-xl px-4 py-3 items-center">
            <Typography variant="headline-20" color="primary" className="mb-1">
              {formatSliderValue(currentTargetHours)}
            </Typography>
            <Slider
              value={currentTargetHours}
              minimumValue={activePeriod === 'daily' ? DAILY_VALUES[0] : STEP_HOURS[activePeriod]}
              maximumValue={MAX_HOURS[activePeriod]}
              step={STEP_HOURS[activePeriod]}
              snapPoints={activePeriod === 'daily' ? DAILY_VALUES : undefined}
              onValueChange={setCurrentTargetHours}
              unit="h"
            />
          </View>
        )}
        {activePeriod === 'none' && (
          <Typography variant="body-12" color="secondary" className="mt-1.5">
            {t('goals.cumulativeNote')}
          </Typography>
        )}
      </View>

      {/* Rest Day Target — only for daily goals */}
      {activePeriod === 'daily' && (
        <View>
          <Typography variant="subtitle-16" color="primary" className="mb-2">
            {t('goals.restDayTarget')}
          </Typography>
          <View className="bg-light-border dark:bg-dark-border rounded-xl px-4 py-3 items-center">
            <Typography variant="headline-20" color="primary" className="mb-1">
              {formatSliderValue(dailyRestDayTargetHours)}
            </Typography>
            <Slider
              value={dailyRestDayTargetHours}
              minimumValue={0}
              maximumValue={MAX_HOURS[activePeriod]}
              step={STEP_HOURS[activePeriod]}
              snapPoints={[0, ...DAILY_VALUES]}
              onValueChange={setDailyRestDayTargetHours}
              unit="h"
            />
          </View>
          <Typography variant="body-12" color="secondary" className="mt-1.5">
            {t('goals.restDaysHint', { days: restDaysLabel })}
          </Typography>
        </View>
      )}

      {/* Target preservation note */}
      {editingGoal && (
        <View className="bg-light-border dark:bg-dark-border rounded-xl px-4 py-3">
          <Typography variant="body-12" color="secondary">
            {t('goals.targetChangeNote')}
          </Typography>
        </View>
      )}

      {/* Settings */}
      <View className="bg-light-border dark:bg-dark-border rounded-xl">
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-1 mr-3">
            <Typography variant="subtitle-16" color="primary">
              {t('goals.showTotalHours')}
            </Typography>
            <Typography variant="body-12" color="secondary" className="mt-0.5">
              {t('goals.showTotalHoursSub')}
            </Typography>
          </View>
          <Toggle value={showTotalHours} onValueChange={setShowTotalHours} />
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-x-3 pt-1 pb-4">
        <Pressable
          onPress={onCancel}
          className="flex-1 bg-light-border dark:bg-dark-border rounded-xl py-4 active:opacity-70"
        >
          <Typography variant="body-14" color="primary" className="text-center">
            {t('common.cancel')}
          </Typography>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={!isValid}
          className={`flex-1 rounded-xl py-4 active:opacity-70 ${
            isValid ? 'bg-primary' : 'bg-light-border dark:bg-dark-border opacity-50'
          }`}
        >
          <Typography
            variant="body-14"
            color="white"
            className="text-center"
          >
            {editingGoal ? t('goals.updateGoal') : t('goals.activateGoal')}
          </Typography>
        </Pressable>
      </View>
    </View>
  );
};
