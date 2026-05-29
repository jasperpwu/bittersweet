import { FC, useState, useEffect } from 'react';
import { View, Pressable, TextInput } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Slider } from '../../ui/Slider';
import { Toggle } from '../../ui/Toggle';
import { useAppSettings } from '../../../store/unified-store';
import { FocusGoal } from '../../../store/types';

type GoalPeriod = 'daily' | 'weekly' | 'monthly';

const MAX_HOURS: Record<GoalPeriod, number> = {
  daily: 12,
  weekly: 84,
  monthly: 360,
};

const STEP_HOURS: Record<GoalPeriod, number> = {
  daily: 0.5,
  weekly: 1,
  monthly: 5,
};

interface FocusGoalFormProps {
  onSubmit: (goal: {
    customName?: string;
    activePeriod: GoalPeriod;
    dailyTargetMinutes: number;
    dailyRestDayTargetMinutes: number;
    weeklyTargetMinutes: number;
    monthlyTargetMinutes: number;
    isRepeating: boolean;
    showTotalHours: boolean;
  }) => void;
  onCancel: () => void;
  editingGoal?: FocusGoal;
  tagName?: string;
  tagIcon?: string;
}

export const FocusGoalForm: FC<FocusGoalFormProps> = ({
  onSubmit,
  onCancel,
  editingGoal,
  tagName,
  tagIcon,
}) => {
  const [dailyTargetHours, setDailyTargetHours] = useState(1);
  const [dailyRestDayTargetHours, setDailyRestDayTargetHours] = useState(0.5);
  const [weeklyTargetHours, setWeeklyTargetHours] = useState(7);
  const [monthlyTargetHours, setMonthlyTargetHours] = useState(30);
  const [activePeriod, setActivePeriod] = useState<GoalPeriod>('daily');
  const [customGoalName, setCustomGoalName] = useState('');
  const [showTotalHours, setShowTotalHours] = useState(true);

  const { preferences } = useAppSettings();

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const restDaysLabel = (preferences.restDays || [0, 6])
    .map(d => DAY_LABELS[d])
    .join(', ');

  // Auto-generated name
  const autoName = tagName ? `${tagIcon || ''} ${tagName} Goal`.trim() : 'Focus Goal';

  // Populate form fields when editing
  useEffect(() => {
    if (editingGoal) {
      const period = (editingGoal as any).activePeriod || (editingGoal as any).period || 'daily';
      setActivePeriod(period === 'yearly' ? 'monthly' : period);

      // Per-period targets
      const daily = editingGoal.dailyTargetMinutes || 0;
      const weekly = editingGoal.weeklyTargetMinutes || 0;
      const monthly = editingGoal.monthlyTargetMinutes || 0;

      setDailyTargetHours(daily > 0 ? Math.round(daily / 60 * 2) / 2 : 1);
      setDailyRestDayTargetHours(
        Math.round((editingGoal.dailyRestDayTargetMinutes || 0) / 60 * 2) / 2
      );
      setWeeklyTargetHours(weekly > 0 ? Math.round(weekly / 60) : 7);
      setMonthlyTargetHours(monthly > 0 ? Math.round(monthly / 60 / 5) * 5 : 30);

      setShowTotalHours(editingGoal.showTotalHours ?? true);
      setCustomGoalName(editingGoal.customName || '');
    } else {
      // Reset to defaults when creating/activating
      setDailyTargetHours(1);
      setDailyRestDayTargetHours(0.5);
      setWeeklyTargetHours(7);
      setMonthlyTargetHours(30);
      setActivePeriod('daily');
      setCustomGoalName('');
      setShowTotalHours(true);
    }
  }, [editingGoal]);

  // Get current period's target hours for display
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
    const max = MAX_HOURS[activePeriod];
    const step = STEP_HOURS[activePeriod];
    let clamped = Math.min(currentTargetHours, max);
    clamped = Math.round(clamped / step) * step;
    clamped = Math.max(step, clamped);
    if (clamped !== currentTargetHours) {
      setCurrentTargetHours(clamped);
    }

    // Also clamp rest day target
    if (activePeriod === 'daily') {
      let clampedRest = Math.min(dailyRestDayTargetHours, max);
      clampedRest = Math.round(clampedRest / step) * step;
      clampedRest = Math.max(0, clampedRest);
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
      isRepeating: true,
      showTotalHours,
    });
  };

  const isValid = currentTargetHours > 0;

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
          Goal Name
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
          Time Period
        </Typography>
        <View className="flex-row gap-x-2">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setActivePeriod(p)}
              className={`flex-1 py-2.5 rounded-xl ${
                activePeriod === p ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
              }`}
            >
              <Typography
                variant="body-14"
                className={`text-center ${activePeriod === p ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Target Duration — Slider */}
      <View>
        <Typography variant="subtitle-16" color="primary" className="mb-2">
          {activePeriod === 'daily' ? 'Regular Day Target' : 'Target Duration'}
        </Typography>
        <View className="bg-light-border dark:bg-dark-border rounded-xl px-4 py-3 items-center">
          <Typography variant="headline-20" color="primary" className="mb-1">
            {formatSliderValue(currentTargetHours)}
          </Typography>
          <Slider
            value={currentTargetHours}
            minimumValue={STEP_HOURS[activePeriod]}
            maximumValue={MAX_HOURS[activePeriod]}
            step={STEP_HOURS[activePeriod]}
            onValueChange={setCurrentTargetHours}
            unit="h"
          />
        </View>
      </View>

      {/* Rest Day Target — only for daily goals */}
      {activePeriod === 'daily' && (
        <View>
          <Typography variant="subtitle-16" color="primary" className="mb-2">
            Rest Day Target
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
              onValueChange={setDailyRestDayTargetHours}
              unit="h"
            />
          </View>
          <Typography variant="body-12" color="secondary" className="mt-1.5">
            Rest days: {restDaysLabel}. Change in Settings.
          </Typography>
        </View>
      )}

      {/* Target preservation note */}
      {editingGoal && (
        <View className="bg-light-border dark:bg-dark-border rounded-xl px-4 py-3">
          <Typography variant="body-12" color="secondary">
            Changing the target only affects today onward. Past periods keep the target that was active at the time.
          </Typography>
        </View>
      )}

      {/* Settings */}
      <View className="bg-light-border dark:bg-dark-border rounded-xl">
        <View className="flex-row items-center justify-between p-4">
          <View className="flex-1 mr-3">
            <Typography variant="subtitle-16" color="primary">
              Show total hours
            </Typography>
            <Typography variant="body-12" color="secondary" className="mt-0.5">
              Display cumulative hours in the streaks view
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
            Cancel
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
            {editingGoal ? 'Update Goal' : 'Activate Goal'}
          </Typography>
        </Pressable>
      </View>
    </View>
  );
};
