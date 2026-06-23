/**
 * AI Focus Coach — orchestrator.
 *
 * `buildWeeklyReport` is pure (data in → report out) and unit-testable.
 * `generateWeeklyReport` is the store-aware entry point the hook/UI call: it reads
 * sessions/goals/tags + settings from the store, builds the report, and persists it.
 */
import type { FocusGoal, WeeklyCoachReport } from '../../store/types';
import { useAppStore } from '../../store';
import { useUnifiedStore } from '../../store/unified-store';
import { computeWeeklyStats, previousWeekRange, weekRangeFor } from './coachStats';
import { computeFocusScore } from './coachScore';
import { narrate, NarratorContext } from './coachNarrator';
import { getSessionMinutesInPeriod } from '../../utils/goalProgress';
import { getInstalledWidgetKinds } from '../../../modules/widget-info';
import * as Notifications from 'expo-notifications';

// Widget kind identifiers — must match the `kind` strings in targets/HomeWidget/*.swift.
const GOALS_WIDGET_KIND = 'com.path2us.bittersweet.GoalWidget';
const FOCUS_WIDGET_KINDS = [
  'com.path2us.bittersweet.HomeScreenWidget',
  'com.path2us.bittersweet.MediumFocusWidget',
];

export { weekRangeFor, previousWeekRange } from './coachStats';
export { computeWeeklyStats } from './coachStats';
export { computeFocusScore } from './coachScore';

// A week is worth coaching once the user has shown up enough for the signal to mean
// something. Either threshold qualifies; below both, we skip (no report, no nudge).
export const MIN_SESSIONS = 3;
export const MIN_ACTIVE_DAYS = 2;

/** Deterministic, idempotent id for a week's report. */
export function weekIdFor(weekStart: Date): string {
  return `coach-${weekStart.toISOString().slice(0, 10)}`;
}

export interface BuildInput {
  allSessions: any[];
  activeGoals: FocusGoal[];
  weekStart: Date;
  weekEnd: Date;
  restDays: number[];
  ctx: NarratorContext;
}

/**
 * Pure build: returns the report, or null when the week doesn't meet the min-data bar.
 */
export async function buildWeeklyReport(input: BuildInput): Promise<WeeklyCoachReport | null> {
  const stats = computeWeeklyStats(
    input.allSessions,
    input.activeGoals,
    input.weekStart,
    input.weekEnd,
    input.restDays
  );

  if (stats.totalSessions < MIN_SESSIONS && stats.activeDays < MIN_ACTIVE_DAYS) {
    return null;
  }

  const { focusScore, subScores } = computeFocusScore(stats);
  const { cards, narrator } = await narrate(stats, input.ctx);

  const now = new Date();
  return {
    id: weekIdFor(input.weekStart),
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    focusScore,
    subScores,
    stats,
    cards,
    narrator,
    generatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Read the store, build the report for a given week (default: last completed week),
 * and persist it. Returns the report, or null if min-data wasn't met.
 */
export async function generateWeeklyReport(weekRef?: Date): Promise<WeeklyCoachReport | null> {
  const state = useAppStore.getState();
  const focus = state.focus;

  const allSessions = focus.sessions.allIds
    .map((id: string) => focus.sessions.byId[id])
    .filter(Boolean);
  const activeGoals = focus.goals.allIds
    .map((id: string) => focus.goals.byId[id])
    .filter((g: any) => g && g.isActive) as FocusGoal[];

  const restDays = useUnifiedStore.getState().preferences?.restDays ?? [0, 6];

  const { weekStart, weekEnd } = weekRef ? weekRangeFor(weekRef) : previousWeekRange();

  const tagsById = focus.tags.byId;
  const goals = focus.goals;

  // Active-type (sports/workout) tags with their minutes this week, lowest first —
  // catches tags the user does workouts for but logs little/none of in-app.
  const activeTags = focus.tags.allIds
    .map((id: string) => tagsById[id])
    .filter((t: any) => t && !t.deletedAt && t.activityType === 'active')
    .map((t: any) => ({
      tagId: t.id,
      minutes: Math.round(
        allSessions.reduce(
          (sum: number, s: any) =>
            s.tagId === t.id || s.secondaryTagId === t.id
              ? sum + getSessionMinutesInPeriod(s, weekStart, weekEnd)
              : sum,
          0
        )
      ),
    }))
    .sort((a: { minutes: number }, b: { minutes: number }) => a.minutes - b.minutes);

  const prefs = useUnifiedStore.getState().preferences;
  const healthPrefs = prefs?.healthKit;
  const goalRemindersEnabled = prefs?.notifications?.goalReminderEnabled ?? true;

  // OS-level notification permission (granted = the user can receive any nudge).
  let osNotificationsEnabled = true; // assume on if the query fails → don't nag
  try {
    osNotificationsEnabled = (await Notifications.getPermissionsAsync()).granted;
  } catch {
    osNotificationsEnabled = true;
  }

  // Which widgets the user actually has installed (null = unknown → suppress nudges).
  const installedKinds = await getInstalledWidgetKinds();
  const hasFocusWidget =
    installedKinds == null ? true : FOCUS_WIDGET_KINDS.some((k) => installedKinds.includes(k));
  const hasGoalsWidget = installedKinds == null ? true : installedKinds.includes(GOALS_WIDGET_KIND);

  const ctx: NarratorContext = {
    tagName: (id) => tagsById[id]?.name ?? 'Focus',
    tagIcon: (id) => tagsById[id]?.icon ?? '🎯',
    goalIdForTag: (tagId) =>
      goals.allIds.find((gid: string) => {
        const g = goals.byId[gid];
        return g && g.isActive && g.tagId === tagId;
      }),
    activeTags,
    hasFocusWidget,
    hasGoalsWidget,
    healthLinked: !!(healthPrefs?.enabled && healthPrefs?.linkedTagId),
    osNotificationsEnabled,
    goalRemindersEnabled,
  };

  const report = await buildWeeklyReport({
    allSessions,
    activeGoals,
    weekStart,
    weekEnd,
    restDays,
    ctx,
  });

  if (report) {
    useAppStore.getState().focus.upsertCoachReport(report);
  }
  return report;
}

/** Whether a report already exists for the week containing `weekRef`. */
export function hasReportForWeek(weekRef: Date): boolean {
  const { weekStart } = weekRangeFor(weekRef);
  const id = weekIdFor(weekStart);
  return !!useAppStore.getState().focus.coachReports?.byId?.[id];
}

/**
 * Lightweight progress toward the min-data gate for the week containing `weekRef`
 * (default: current week). Powers the empty-state teaser so it can show how close the
 * user is rather than generic copy. Uses the same gate definition as generation.
 */
export function weekProgress(weekRef: Date = new Date()): {
  sessions: number;
  activeDays: number;
  meetsGate: boolean;
} {
  const focus = useAppStore.getState().focus;
  const allSessions = focus.sessions.allIds
    .map((id: string) => focus.sessions.byId[id])
    .filter(Boolean);
  const restDays = useUnifiedStore.getState().preferences?.restDays ?? [0, 6];
  const { weekStart, weekEnd } = weekRangeFor(weekRef);
  const stats = computeWeeklyStats(allSessions, [], weekStart, weekEnd, restDays);
  return {
    sessions: stats.totalSessions,
    activeDays: stats.activeDays,
    meetsGate: stats.totalSessions >= MIN_SESSIONS || stats.activeDays >= MIN_ACTIVE_DAYS,
  };
}
