import React, { FC, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, SafeAreaView, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { Card } from '../../src/components/ui/Card';
import { ScoreRing, scoreColor } from '../../src/components/analytics/CoachCard/CoachVisuals';
import { GoalConfigModal } from '../../src/components/modals/GoalConfigModal';
import { useAppStore } from '../../src/store';
import { useAppSettings } from '../../src/store/unified-store';
import { showToast } from '../../src/components/ui/Toast';
import { colors } from '../../src/config/theme';
import type {
  CoachAction,
  CoachInsightCard,
  CoachInsightSeverity,
  WeeklyCoachReport,
} from '../../src/store/types';

const fmtDay = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtMins = (m: number) => {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  if (h && min) return `${h}h ${min}m`;
  if (h) return `${h}h`;
  return `${min}m`;
};

const severityColor = (s: CoachInsightSeverity): string =>
  s === 'positive' ? colors.success : s === 'attention' ? colors.error : colors.primary;

const ACTION_FALLBACK_LABEL: Record<CoachAction['type'], string> = {
  create_goal: 'Set a goal',
  adjust_goal: 'Review goal',
  open_goals: 'Open goals',
  block_apps: 'Choose apps to block',
  link_health: 'Link Apple Health',
  enable_notifications: 'Turn on notifications',
  enable_goal_reminders: 'Turn on goal reminders',
  none: '',
};

const SubScoreBar: FC<{ label: string; value: number; show: boolean }> = ({
  label,
  value,
  show,
}) => (
  <View className="mb-3">
    <View className="mb-1 flex-row justify-between">
      <Typography variant="body-12" color="secondary">
        {label}
      </Typography>
      <Typography variant="body-12" color="primary">
        {show ? value : '—'}
      </Typography>
    </View>
    <View className="h-2 overflow-hidden rounded-full bg-light-border dark:bg-dark-border">
      <View
        style={{
          width: `${show ? Math.max(0, Math.min(100, value)) : 0}%`,
          height: '100%',
          backgroundColor: scoreColor(value),
          borderRadius: 999,
        }}
      />
    </View>
  </View>
);

const QuickStat: FC<{ label: string; value: string }> = ({ label, value }) => (
  <View className="flex-1 items-center">
    <Typography variant="headline-20" color="primary">
      {value}
    </Typography>
    <Typography variant="tiny-10" color="secondary" className="mt-1">
      {label}
    </Typography>
  </View>
);

export default function AiCoachScreen() {
  const coachReports = useAppStore((s) => s.focus.coachReports);
  const focus = useAppStore((s) => s.focus);
  const { preferences, updatePreferences } = useAppSettings();

  const [goalModal, setGoalModal] = useState<{
    visible: boolean;
    editingGoalId: string | null;
    tagId?: string;
  }>({ visible: false, editingGoalId: null });

  const reports = useMemo<WeeklyCoachReport[]>(() => {
    if (!coachReports?.allIds) return [];
    return coachReports.allIds
      .map((id: string) => coachReports.byId[id])
      .filter(Boolean)
      .filter((r: any) => !r.deletedAt)
      .sort((a: any, b: any) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime());
  }, [coachReports]);

  // Opened from a specific report tile? Start on that week; otherwise the latest.
  const { reportId } = useLocalSearchParams<{ reportId?: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(reportId ?? null);
  const selected = reports.find((r) => r.id === selectedId) ?? reports[0];
  const selectedIdx = selected ? reports.findIndex((r) => r.id === selected.id) : -1;
  const prev = selectedIdx >= 0 ? reports[selectedIdx + 1] : undefined;
  const delta = selected && prev ? selected.focusScore - prev.focusScore : null;

  // Oldest → newest for the trend/history selector.
  const trendReports = useMemo(() => reports.slice(0, 8).slice().reverse(), [reports]);

  const goalIdForTag = (tagId?: string): string | undefined => {
    if (!tagId) return undefined;
    return focus.goals.allIds.find((gid: string) => focus.goals.byId[gid]?.tagId === tagId);
  };

  const handleAction = async (action: CoachAction) => {
    switch (action.type) {
      case 'create_goal':
      case 'adjust_goal': {
        const goalId = action.goalId || goalIdForTag(action.tagId);
        if (goalId) {
          setGoalModal({ visible: true, editingGoalId: goalId, tagId: action.tagId });
        } else {
          // No goal exists for the tag yet — send them to the Goals tab to create one.
          router.back();
          router.push('/(tabs)/insights');
        }
        break;
      }
      case 'enable_notifications': {
        // Re-request; if still not granted (previously denied), iOS only lets the user
        // change it from Settings.
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          showToast('Notifications are on', 'success');
        } else {
          Linking.openSettings();
        }
        break;
      }
      case 'enable_goal_reminders': {
        await updatePreferences({
          notifications: { ...preferences.notifications, goalReminderEnabled: true },
        });
        showToast('Goal reminders on', 'success');
        break;
      }
      case 'open_goals': {
        router.back();
        router.push('/(tabs)/insights');
        break;
      }
      case 'block_apps': {
        router.push('/(modals)/app-selection');
        break;
      }
      case 'link_health': {
        router.push('/settings/health');
        break;
      }
      default:
        break;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <Typography variant="headline-24" color="primary">
          AI Focus Coach
        </Typography>
        <Pressable onPress={() => router.back()} className="p-2 active:opacity-70">
          <Typography variant="headline-18" color="secondary">
            ✕
          </Typography>
        </Pressable>
      </View>

      {!selected ? (
        <View className="flex-1 items-center justify-center px-10">
          <Typography variant="headline-24" color="primary" className="mb-3">
            🧭
          </Typography>
          <Typography variant="subtitle-16" color="primary" className="mb-2 text-center">
            No weekly report yet
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center">
            Log a few focus sessions and rate them. Your coach reviews each completed week and
            shares a read on your focus here.
          </Typography>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Trend / history selector */}
          {trendReports.length >= 2 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-5 px-5"
              contentContainerStyle={{ alignItems: 'flex-end' }}>
              {trendReports.map((r) => {
                const isSel = r.id === selected.id;
                const h = 14 + (Math.max(0, Math.min(100, r.focusScore)) / 100) * 52;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelectedId(r.id)}
                    className="items-center"
                    style={{ marginRight: 12 }}>
                    <View style={{ height: 66, justifyContent: 'flex-end' }}>
                      <View
                        style={{
                          width: 22,
                          height: h,
                          backgroundColor: scoreColor(r.focusScore),
                          opacity: isSel ? 1 : 0.45,
                          borderRadius: 6,
                        }}
                      />
                    </View>
                    <Typography
                      variant="tiny-10"
                      color={isSel ? 'primary' : 'secondary'}
                      className="mt-1">
                      {fmtDay(r.weekStart)}
                    </Typography>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Selected week — score + meta */}
          <View className="px-5">
            <Card variant="elevated" padding="large" className="mb-5">
              <View className="flex-row items-center">
                <ScoreRing score={selected.focusScore} size={96} fontVariant="headline-24" />
                <View className="ml-5 flex-1">
                  <Typography variant="subtitle-16" color="primary">
                    {fmtDay(selected.weekStart)} – {fmtDay(selected.weekEnd)}
                  </Typography>
                  {delta != null && (
                    <Typography
                      variant="body-12"
                      color={delta > 0 ? 'success' : delta < 0 ? 'error' : 'secondary'}
                      className="mt-1">
                      {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)} vs previous week
                    </Typography>
                  )}
                  <Typography variant="tiny-10" color="secondary" className="mt-2">
                    {selected.narrator === 'apple_fm' ? 'On-device AI' : 'Auto summary'}
                  </Typography>
                </View>
              </View>

              {/* Quick stats */}
              <View className="mt-5 flex-row">
                <QuickStat label="Focused" value={fmtMins(selected.stats.totalMinutes)} />
                <QuickStat label="Sessions" value={String(selected.stats.totalSessions)} />
                <QuickStat label="Active days" value={`${selected.stats.activeDays}/7`} />
              </View>
            </Card>

            {/* Sub-score breakdown */}
            <Card variant="default" padding="medium" className="mb-5">
              <Typography variant="subtitle-14-semibold" color="primary" className="mb-3">
                Score breakdown
              </Typography>
              <SubScoreBar label="Consistency" value={selected.subScores.consistency} show />
              <SubScoreBar
                label="Focus quality"
                value={selected.subScores.quality}
                show={selected.stats.ratedCount > 0}
              />
              <SubScoreBar label="Volume" value={selected.subScores.volume} show />
            </Card>

            {/* Insight cards */}
            <Typography variant="subtitle-14-semibold" color="primary" className="mb-3">
              Insights this week
            </Typography>
            {selected.cards.map((card: CoachInsightCard) => {
              // Info tips (no action) render as a light bullet; actionable insights as a card.
              if (card.action?.type === 'none') {
                return (
                  <View key={card.id} className="mb-3 flex-row px-1">
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor: severityColor(card.severity),
                        marginTop: 5,
                        marginRight: 10,
                      }}
                    />
                    <View className="flex-1">
                      <Typography variant="subtitle-14-semibold" color="primary" className="mb-1">
                        {card.headline}
                      </Typography>
                      <Typography variant="body-12" color="secondary">
                        {card.body}
                      </Typography>
                    </View>
                  </View>
                );
              }
              return (
                <Card key={card.id} variant="outlined" padding="medium" className="mb-3">
                  <View className="flex-row">
                    <View
                      style={{
                        width: 3,
                        borderRadius: 2,
                        backgroundColor: severityColor(card.severity),
                        marginRight: 12,
                      }}
                    />
                    <View className="flex-1">
                      <Typography variant="subtitle-14-semibold" color="primary" className="mb-1">
                        {card.headline}
                      </Typography>
                      <Typography variant="body-12" color="secondary" className="mb-2">
                        {card.body}
                      </Typography>
                      <Pressable
                        onPress={() => handleAction(card.action)}
                        className="self-start rounded-lg bg-primary px-3 py-2 active:opacity-80">
                        <Typography variant="body-12" color="white">
                          {card.action.label || ACTION_FALLBACK_LABEL[card.action.type]}
                        </Typography>
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Goal create/adjust — reuses the existing goal config sheet */}
      <GoalConfigModal
        isVisible={goalModal.visible}
        onClose={() => setGoalModal({ visible: false, editingGoalId: null })}
        editingGoalId={goalModal.editingGoalId}
        tagId={goalModal.tagId}
      />
    </SafeAreaView>
  );
}
