import React, { useMemo, useState } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, Text, Alert } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { FruitCounter } from '../../src/components/rewards';
import { showToast } from '../../src/components/ui/Toast';
import { useAppStore, useFocus, useRewards } from '../../src/store';
import { useAppSettings } from '../../src/store/unified-store';
import { colors } from '../../src/config/theme';
import {
  getHistoricalPeriodRanges,
  getSessionMinutesInPeriod,
  getTargetForDate,
  getGoalOffKeys,
  getPeriodKey,
  calculateGoalStreak,
  OFF_MARK_COSTS,
} from '../../src/utils/goalProgress';
import type { FocusGoal, FocusSession } from '../../src/store/types';
import type { SessionTag } from '../../src/types/models';
import { directionalIcon } from '../../src/utils/directionalIcon';

type Period = 'daily' | 'weekly' | 'monthly';
const WEEK_START_DAY = 1; // Monday — matches GoalProgress / GoalProgressBanner

// How many past slots to surface per period, matching the consistency calendar.
const SLOT_COUNT: Record<Period, number> = { daily: 30, weekly: 12, monthly: 12 };

const PERIOD_TABS: { period: Period; labelKey: string }[] = [
  { period: 'daily', labelKey: 'offMarker.day' },
  { period: 'weekly', labelKey: 'offMarker.week' },
  { period: 'monthly', labelKey: 'offMarker.month' },
];

// One slot's derived state for the grid.
interface Slot {
  key: string; // periodKey (slot start, YYYY-MM-DD)
  label: string;
  hit: boolean;
  alreadyOff: boolean;
  markable: boolean; // missed, not a rest/0-target slot, not already off
}

const goalDisplayName = (
  goal: FocusGoal,
  tag: SessionTag | undefined,
  t: (k: string, o?: Record<string, unknown>) => string
): string => {
  if (goal.customName) return goal.customName;
  if (tag) return t('insights.goalSuffix', { icon: tag.icon, name: tag.name });
  return t('goalProgress.goalFallback');
};

export default function OffMarkerScreen() {
  const { t } = useTranslation();
  const { goals, sessions, tags } = useFocus();
  const { preferences } = useAppSettings();
  const rewards = useRewards();
  const balance = rewards.balance;
  const restDays = useMemo(() => preferences.restDays ?? [0, 6], [preferences.restDays]);

  const [period, setPeriod] = useState<Period>('daily');
  // Pending (unconfirmed) selections, keyed `${goalId}|${periodKey}`.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const cost = OFF_MARK_COSTS[period];

  // Switching the period type discards the in-progress selection — the slots
  // being marked are a different type entirely.
  const handlePeriod = (next: Period) => {
    if (next === period) return;
    Haptics.selectionAsync().catch(() => {});
    setPending(new Set());
    setPeriod(next);
  };

  const safeSessions = useMemo<FocusSession[]>(
    () => sessions.allIds.map((id) => sessions.byId[id]).filter(Boolean) as FocusSession[],
    [sessions]
  );

  // Active goals of the selected period type (cumulative 'none' goals have no
  // streak, so they're never eligible).
  const periodGoals = useMemo<FocusGoal[]>(
    () =>
      goals.allIds
        .map((id) => goals.byId[id])
        .filter((g): g is FocusGoal => !!g && g.isActive && g.activePeriod === period),
    [goals, period]
  );

  // Per-goal slot grids + current streak.
  const goalViews = useMemo(() => {
    const ranges = getHistoricalPeriodRanges(
      period,
      SLOT_COUNT[period],
      new Date(),
      WEEK_START_DAY
    );
    return periodGoals.map((goal) => {
      const offKeys = getGoalOffKeys(goal, period);
      const relevant = safeSessions.filter(
        (s) => (s as any).tagId === goal.tagId || (s as any).secondaryTagId === goal.tagId
      );
      const slots: Slot[] = ranges.map((range) => {
        const key = getPeriodKey(range.periodStart);
        const minutes = relevant.reduce(
          (sum, s) => sum + getSessionMinutesInPeriod(s, range.periodStart, range.periodEnd),
          0
        );
        const target = getTargetForDate(goal, range.periodStart, restDays, period);
        const alreadyOff = offKeys.has(key);
        const hit = target > 0 ? minutes >= target : true;
        return {
          key,
          label: range.label,
          hit,
          alreadyOff,
          markable: target > 0 && !hit && !alreadyOff,
        };
      });
      return {
        goal,
        tag: tags.byId[goal.tagId] as SessionTag | undefined,
        slots,
      };
    });
  }, [periodGoals, safeSessions, tags, restDays, period]);

  // Streak per goal, recomputed live as pending slots are tapped — the pending
  // (not-yet-confirmed) marks are merged into the goal's off-set so the user
  // sees the streak they'll get before paying. Separate from goalViews so the
  // slot grids (which don't depend on pending) aren't rebuilt on every tap.
  const liveStreaks = useMemo(() => {
    const result: Record<string, number> = {};
    for (const goal of periodGoals) {
      const pendingKeys: string[] = [];
      for (const id of pending) {
        const [gid, key] = id.split('|');
        if (gid === goal.id) pendingKeys.push(key);
      }
      const base = goal.offMarks ?? { daily: [], weekly: [], monthly: [] };
      const previewGoal =
        pendingKeys.length > 0
          ? { ...goal, offMarks: { ...base, [period]: [...(base[period] ?? []), ...pendingKeys] } }
          : goal;
      result[goal.id] = calculateGoalStreak(
        previewGoal as any,
        safeSessions as any,
        restDays,
        WEEK_START_DAY
      );
    }
    return result;
  }, [periodGoals, safeSessions, restDays, period, pending]);

  const toggleSlot = (goalId: string, key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setPending((prev) => {
      const next = new Set(prev);
      const id = `${goalId}|${key}`;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = pending.size;
  const totalCost = selectedCount * cost;
  const canAfford = totalCost <= balance;

  const handleConfirm = () => {
    if (selectedCount === 0) return;
    if (!canAfford) {
      showToast(t('offMarker.notEnough'), 'error');
      return;
    }
    Alert.alert(
      t('offMarker.confirmTitle'),
      t('offMarker.confirmBody', { count: selectedCount, cost: totalCost }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('offMarker.confirmAction'),
          onPress: () => {
            // Group pending keys by goal.
            const byGoal = new Map<string, string[]>();
            for (const id of pending) {
              const [goalId, key] = id.split('|');
              const arr = byGoal.get(goalId) ?? [];
              arr.push(key);
              byGoal.set(goalId, arr);
            }
            const marks = Array.from(byGoal.entries()).map(([goalId, periodKeys]) => ({
              goalId,
              period,
              periodKeys,
            }));
            try {
              useAppStore.getState().focus.applyOffMarks(marks, totalCost);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              showToast(t('offMarker.marked', { count: selectedCount }), 'success');
              setPending(new Set());
            } catch {
              showToast(t('store.purchaseFailed'), 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-4 pt-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center active:opacity-70"
          hitSlop={8}>
          <Ionicons name={directionalIcon('chevron-back')} size={24} color={colors.light.screenTextSecondary} />
        </Pressable>
        <Typography variant="headline-18">{t('offMarker.title')}</Typography>
        <FruitCounter fruitCount={balance} size="small" />
      </View>

      {/* Period toggle */}
      <View className="px-5 pb-2">
        <View className="flex-row rounded-xl bg-light-border/30 p-1 dark:bg-dark-card">
          {PERIOD_TABS.map(({ period: p, labelKey }) => (
            <Pressable
              key={p}
              onPress={() => handlePeriod(p)}
              className={`flex-1 items-center rounded-lg py-2 ${period === p ? 'bg-primary' : ''}`}>
              <Typography variant="subtitle-14-medium" color={period === p ? 'white' : 'secondary'}>
                {t(labelKey)}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Cost hint */}
      <View className="px-5 pb-1">
        <Typography variant="body-12" color="secondary">
          {t('offMarker.costHint', { cost })}
        </Typography>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {goalViews.length === 0 ? (
          <View className="mt-16 items-center px-6">
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🎯</Text>
            <Typography variant="subtitle-14-semibold" className="mb-1 text-center">
              {t('offMarker.emptyTitle')}
            </Typography>
            <Typography variant="body-14" color="secondary" className="text-center">
              {t('offMarker.emptyBody')}
            </Typography>
          </View>
        ) : (
          goalViews.map(({ goal, tag, slots }) => {
            const streak = liveStreaks[goal.id] ?? 0;
            return (
              <View
                key={goal.id}
                className="mb-4 rounded-2xl border border-light-border bg-light-border/30 p-4 dark:border-dark-border dark:bg-dark-card">
                <View className="mb-3 flex-row items-center justify-between">
                  <View className="mr-3 flex-1">
                    <Typography variant="subtitle-14-semibold" numberOfLines={1}>
                      {goalDisplayName(goal, tag, t)}
                    </Typography>
                  </View>
                  <View className="flex-row items-center">
                    <Ionicons name="flame" size={14} color={colors.primary} />
                    <Typography variant="body-12" color="primary" className="ml-1">
                      {t('offMarker.streak', { count: streak })}
                    </Typography>
                  </View>
                </View>

                {/* Slot grid — wrapped squares; only missed slots are tappable */}
                <View className="flex-row flex-wrap">
                  {slots.map((slot) => {
                    const selected = pending.has(`${goal.id}|${slot.key}`);
                    return (
                      <SlotCell
                        key={slot.key}
                        slot={slot}
                        selected={selected}
                        onPress={() => toggleSlot(goal.id, slot.key)}
                      />
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
        <View className="h-32" />
      </ScrollView>

      {/* Confirm bar */}
      {selectedCount > 0 && (
        <View className="absolute bottom-0 left-0 right-0 border-t border-light-border bg-light-bg px-5 pb-8 pt-4 dark:border-dark-border dark:bg-dark-bg">
          <View className="mb-3 flex-row items-center justify-between">
            <Typography variant="body-14" color="secondary">
              {t('offMarker.selectedCount', { count: selectedCount })}
            </Typography>
            <Typography variant="subtitle-14-semibold" color={canAfford ? 'primary' : 'error'}>
              🍎 {totalCost}
            </Typography>
          </View>
          <Button onPress={handleConfirm} disabled={!canAfford} fullWidth haptic>
            {canAfford ? t('offMarker.confirmAction') : t('offMarker.notEnough')}
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

// A single slot cell. Fixed ~14% width so ~7 fit per row for daily; weekly and
// monthly grids (12 slots) wrap the same way. Only markable (missed) slots are
// pressable; hit and already-off slots are static.
const SlotCell: React.FC<{ slot: Slot; selected: boolean; onPress: () => void }> = ({
  slot,
  selected,
  onPress,
}) => {
  const size = 30;
  const cell = (() => {
    if (slot.hit) {
      return (
        <View
          className="items-center justify-center rounded-full bg-primary"
          style={{ width: size, height: size }}>
          <Ionicons name="checkmark-sharp" size={18} color={colors.white} />
        </View>
      );
    }
    // Committed off (already paid): solid coral fill + white dash — locked in,
    // and obvious on both light and dark (mirrors the green hit cell).
    if (slot.alreadyOff) {
      return (
        <View
          className="items-center justify-center rounded-full"
          style={{ width: size, height: size, backgroundColor: colors.error }}>
          <Ionicons name="remove" size={18} color={colors.white} />
        </View>
      );
    }
    // Pending (tapped, not yet confirmed): coral ring with a light coral fill —
    // clearly visible but distinct from the solid committed cell.
    if (selected) {
      return (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: size,
            height: size,
            borderWidth: 2,
            borderColor: colors.error,
            backgroundColor: `${colors.error}26`,
          }}>
          <Ionicons name="remove" size={18} color={colors.error} />
        </View>
      );
    }
    // Markable (missed) — empty, tappable.
    return (
      <View
        className="rounded-full border border-light-border bg-light-bg dark:border-dark-border dark:bg-dark-bg"
        style={{ width: size, height: size }}
      />
    );
  })();

  return (
    <View className="mb-2 items-center" style={{ width: `${100 / 7}%` }}>
      {slot.markable ? (
        <Pressable onPress={onPress} hitSlop={4} className="items-center active:opacity-60">
          {cell}
          <Typography variant="tiny-10" color="secondary" className="mt-0.5 text-center">
            {slot.label}
          </Typography>
        </Pressable>
      ) : (
        <View className="items-center">
          {cell}
          <Typography variant="tiny-10" color="secondary" className="mt-0.5 text-center">
            {slot.label}
          </Typography>
        </View>
      )}
    </View>
  );
};
