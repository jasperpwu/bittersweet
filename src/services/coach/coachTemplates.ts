/**
 * Templated (non-LLM) narrator — the deterministic floor.
 *
 * Builds grounded insight cards from the computed stats + a few app-state signals.
 * Cards are a mix of: actionable cards (a real in-app deep-link button) and info
 * bullets (`action.type === 'none'`, no button). Actions are always set here, never
 * by a model — the on-device narrator only picks/rewrites the prose.
 */
import type { CoachWeeklyStats, CoachInsightCard, CoachAction } from '../../store/types';
import i18n from '../../i18n';

export interface NarratorContext {
  tagName: (tagId: string) => string;
  tagIcon: (tagId: string) => string;
  /** Active goal id for a tag, if one exists (for adjust_goal). */
  goalIdForTag: (tagId: string) => string | undefined;
  /** Active-type (sports/workout) tags with their minutes this week, lowest first. */
  activeTags: { tagId: string; minutes: number }[];
  /** Whether the focus (home-screen) widget is installed. */
  hasFocusWidget: boolean;
  /** Whether the Goals widget is installed. */
  hasGoalsWidget: boolean;
  /** Whether Apple Health workout tracking is linked. */
  healthLinked: boolean;
  /** Whether OS-level notification permission is granted. */
  osNotificationsEnabled: boolean;
  /** Whether the in-app daily goal-reminder preference is on. */
  goalRemindersEnabled: boolean;
}

// Heuristic thresholds — tunable.
const LOW_VOLUME_MINUTES = 120; // < 2h focused this week reads as a light week
const LOW_ACTIVE_TAG_MINUTES = 60; // < 1h logged on a sports tag → likely untracked workouts
const LOW_QUALITY_RATING = 3.5; // mean focus rating below this reads as scattered
const VOLUME_DELTA_MINUTES = 30; // |Δ vs trailing avg| worth calling out

// Locale-aware hour label (e.g. "9 AM" / "9時" / "9 h") from a 0–23 hour.
const fmtHour = (h: number): string => {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString(i18n.language, { hour: 'numeric' });
};

// English weekday name (as stored in stats) → localized weekday name.
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmtDay = (enName: string): string => {
  const idx = EN_DAYS.indexOf(enName);
  if (idx < 0) return enName;
  const d = new Date(2023, 0, 1); // Sunday
  d.setDate(d.getDate() + idx);
  return d.toLocaleDateString(i18n.language, { weekday: 'long' });
};

const fmtMins = (m: number): string => {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  if (h && min) return `${h}h ${min}m`;
  if (h) return `${h}h`;
  return `${min}m`;
};

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/**
 * Builds the full pool of grounded candidate cards in rough priority order. The
 * on-device narrator picks/rewrites from these; the templated narrator takes the top few.
 */
export function candidateCards(stats: CoachWeeklyStats, ctx: NarratorContext): CoachInsightCard[] {
  const cards: CoachInsightCard[] = [];
  let idx = 0;
  const card = (
    headline: string,
    body: string,
    severity: CoachInsightCard['severity'],
    action: CoachAction,
    bodyLocked?: boolean
  ): CoachInsightCard => ({ id: `tpl-${idx++}`, headline, body, severity, action, bodyLocked });
  const tip = (headline: string, body: string, severity: CoachInsightCard['severity']) =>
    card(headline, body, severity, { type: 'none' });

  const topTag = stats.byTag[0];

  // --- Goals (actionable) ---
  // One card carrying a per-cadence breakdown, because daily/weekly/monthly goals are
  // graded on different periods and can't honestly share a single "X of Y met"
  // fraction. Only cadences the user actually has goals for get a line, and the whole
  // breakdown lives in one card so it doesn't crowd out the rest of the week's
  // insights against the 3-card cap.
  const gb = stats.goalBreakdown;
  const goalLines: string[] = [];
  let goalCount = 0;
  let onTrackCount = 0;
  // `count` is always the TOTAL (the second number). Every locale's phrasing is written
  // so its noun agrees with that total, because i18next selects the plural form from
  // `count` alone — passing the numerator here is what made French read "1 objectifs
  // sur 3".
  if (gb?.daily) {
    // Days, not goals: a daily goal is 7 chances a week, and summing them into one
    // pass/fail is what made a 5-of-7 week read the same as an empty one.
    goalLines.push(
      i18n.t('coachTpl.goalsLineDaily', { met: gb.daily.daysMet, count: gb.daily.daysTracked })
    );
    goalCount += gb.daily.goals;
    onTrackCount += gb.daily.onTrack;
  }
  if (gb?.weekly) {
    goalLines.push(
      i18n.t('coachTpl.goalsLineWeekly', { met: gb.weekly.onTrack, count: gb.weekly.goals })
    );
    goalCount += gb.weekly.goals;
    onTrackCount += gb.weekly.onTrack;
  }
  if (gb?.monthly) {
    // "On pace" (month-to-date), not "met" — the month isn't over yet.
    goalLines.push(
      i18n.t('coachTpl.goalsLineMonthly', { onPace: gb.monthly.onTrack, count: gb.monthly.goals })
    );
    goalCount += gb.monthly.goals;
    onTrackCount += gb.monthly.onTrack;
  }
  const hasCadenceGoals = goalLines.length > 0;
  const allOnTrack = hasCadenceGoals && onTrackCount === goalCount;

  if (hasCadenceGoals) {
    const body = `${goalLines.join('\n')}\n\n${i18n.t(
      allOnTrack ? 'coachTpl.allGoalsB' : 'coachTpl.goalsMetPartialB'
    )}`;
    cards.push(
      card(
        allOnTrack
          ? i18n.t('coachTpl.goalsAllOnTrackH')
          : i18n.t('coachTpl.goalsOnTrackH', { onTrack: onTrackCount, count: goalCount }),
        body,
        allOnTrack ? 'positive' : 'attention',
        // A single Open Goals button, and only when there's something to go fix.
        allOnTrack
          ? { type: 'none' }
          : { type: 'open_goals', label: i18n.t('aiCoach.actOpenGoals') },
        true // structured lines — narration must not reflow them into prose
      )
    );
  } else if (stats.goalsTracked === 0 && topTag) {
    cards.push(
      card(
        i18n.t('coachTpl.topTagH', {
          mins: fmtMins(topTag.minutes),
          tag: ctx.tagName(topTag.tagId),
        }),
        i18n.t('coachTpl.topTagB'),
        'neutral',
        {
          type: 'create_goal',
          label: i18n.t('coachTpl.setTagGoal', { tag: ctx.tagName(topTag.tagId) }),
          tagId: topTag.tagId,
          period: 'weekly',
          targetMinutes: roundTo(topTag.minutes, 30),
        }
      )
    );
  }

  // --- Scattered focus → block apps (actionable) ---
  if (stats.avgRating != null && stats.avgRating < LOW_QUALITY_RATING && stats.ratedCount >= 2) {
    cards.push(
      card(
        i18n.t('coachTpl.scatteredH'),
        i18n.t('coachTpl.scatteredB', { rating: stats.avgRating.toFixed(1) }),
        'attention',
        { type: 'block_apps', label: i18n.t('aiCoach.actBlockApps') }
      )
    );
  }

  // --- Notifications: surface whichever layer is off (actionable) ---
  if (!ctx.osNotificationsEnabled) {
    cards.push(
      card(i18n.t('aiCoach.actEnableNotifs'), i18n.t('coachTpl.notifsB'), 'attention', {
        type: 'enable_notifications',
        label: i18n.t('aiCoach.actEnableNotifs'),
      })
    );
  } else if (!ctx.goalRemindersEnabled && stats.goalsTracked > 0) {
    cards.push(
      card(i18n.t('coachTpl.remindersH'), i18n.t('coachTpl.remindersB'), 'neutral', {
        type: 'enable_goal_reminders',
        label: i18n.t('aiCoach.actEnableReminders'),
      })
    );
  }

  // --- Sports tag with little logged time → link Apple Health (actionable) ---
  const lowActive = ctx.activeTags.find((t) => t.minutes < LOW_ACTIVE_TAG_MINUTES);
  if (lowActive && !ctx.healthLinked) {
    cards.push(
      card(
        i18n.t('coachTpl.trackActiveH', { tag: ctx.tagName(lowActive.tagId) }),
        i18n.t('coachTpl.trackActiveB', { mins: fmtMins(lowActive.minutes) }),
        'neutral',
        { type: 'link_health', label: i18n.t('aiCoach.actLinkHealth'), tagId: lowActive.tagId }
      )
    );
  }

  // --- Peak window (observation) ---
  if (stats.peakDay && stats.peakHour != null) {
    cards.push(
      tip(
        i18n.t('coachTpl.peakH', { time: fmtHour(stats.peakHour) }),
        i18n.t('coachTpl.peakB', { day: fmtDay(stats.peakDay), time: fmtHour(stats.peakHour) }),
        'positive'
      )
    );
  }

  // --- Volume trend (observation) ---
  // Gated on the same typical-week baseline the volume score uses, so the narration
  // and the number can't tell different stories.
  if ((stats.typicalWeekMinutes ?? stats.trailingAvgMinutes) > 0) {
    const delta = stats.deltaMinutesVsTrailingAvg;
    if (delta >= VOLUME_DELTA_MINUTES) {
      cards.push(
        tip(
          i18n.t('coachTpl.volumeUpH', { mins: fmtMins(Math.abs(delta)) }),
          i18n.t('coachTpl.volumeUpB'),
          'positive'
        )
      );
    } else if (delta <= -VOLUME_DELTA_MINUTES) {
      cards.push(
        tip(
          i18n.t('coachTpl.volumeDownH', { mins: fmtMins(Math.abs(delta)) }),
          i18n.t('coachTpl.volumeDownB'),
          'neutral'
        )
      );
    }
  }

  // --- Widget nudges (info bullets, only when that specific widget isn't installed) ---
  if (!ctx.hasFocusWidget && stats.totalMinutes < LOW_VOLUME_MINUTES) {
    cards.push(tip(i18n.t('coachTpl.focusWidgetH'), i18n.t('coachTpl.focusWidgetB'), 'neutral'));
  }
  if (!ctx.hasGoalsWidget && hasCadenceGoals && !allOnTrack) {
    cards.push(tip(i18n.t('coachTpl.goalsWidgetH'), i18n.t('coachTpl.goalsWidgetB'), 'neutral'));
  }

  // Always return at least one card.
  if (cards.length === 0) {
    cards.push(
      card(
        i18n.t('coachTpl.fallbackH', {
          mins: fmtMins(stats.totalMinutes),
          count: stats.activeDays,
        }),
        i18n.t('coachTpl.fallbackB'),
        'neutral',
        topTag
          ? {
              type: 'create_goal',
              label: i18n.t('aiCoach.actSetGoal'),
              tagId: topTag.tagId,
              period: 'weekly',
            }
          : { type: 'none' }
      )
    );
  }

  return cards;
}

/** Deterministic narrator: the top 3 grounded candidate cards, verbatim. */
export function templateCards(stats: CoachWeeklyStats, ctx: NarratorContext): CoachInsightCard[] {
  return candidateCards(stats, ctx).slice(0, 3);
}
