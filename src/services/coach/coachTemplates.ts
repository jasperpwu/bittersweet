/**
 * Templated (non-LLM) narrator — the deterministic floor.
 *
 * Builds grounded insight cards from the computed stats + a few app-state signals.
 * Cards are a mix of: actionable cards (a real in-app deep-link button) and info
 * bullets (`action.type === 'none'`, no button). Actions are always set here, never
 * by a model — the on-device narrator only picks/rewrites the prose.
 */
import type { CoachWeeklyStats, CoachInsightCard, CoachAction } from '../../store/types';

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

const fmtHour = (h: number): string => {
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${am ? 'am' : 'pm'}`;
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
    action: CoachAction
  ): CoachInsightCard => ({ id: `tpl-${idx++}`, headline, body, severity, action });
  const tip = (headline: string, body: string, severity: CoachInsightCard['severity']) =>
    card(headline, body, severity, { type: 'none' });

  const topTag = stats.byTag[0];

  // --- Goals (actionable) ---
  if (stats.goalsTracked > 0 && stats.goalsMet < stats.goalsTracked) {
    cards.push(
      card(
        `${stats.goalsMet} of ${stats.goalsTracked} goals met`,
        `You came close. A quick look at your goals can help you adjust a target that's set too high.`,
        'attention',
        { type: 'open_goals', label: 'Open goals' }
      )
    );
  } else if (stats.goalsTracked === 0 && topTag) {
    cards.push(
      card(
        `${fmtMins(topTag.minutes)} on ${ctx.tagName(topTag.tagId)}`,
        `Your most-focused activity this week. A goal would help you keep the momentum.`,
        'neutral',
        {
          type: 'create_goal',
          label: `Set a ${ctx.tagName(topTag.tagId)} goal`,
          tagId: topTag.tagId,
          period: 'weekly',
          targetMinutes: roundTo(topTag.minutes, 30),
        }
      )
    );
  } else if (stats.goalsTracked > 0 && stats.goalsMet === stats.goalsTracked) {
    cards.push(
      tip(
        `All ${stats.goalsTracked} goals met`,
        `Every goal hit this week — excellent consistency. Keep the bar where it challenges you.`,
        'positive'
      )
    );
  }

  // --- Scattered focus → block apps (actionable) ---
  if (stats.avgRating != null && stats.avgRating < LOW_QUALITY_RATING && stats.ratedCount >= 2) {
    cards.push(
      card(
        `Focus felt scattered`,
        `Your sessions averaged ${stats.avgRating.toFixed(1)}★. Blocking distracting apps during focus can help you stay in.`,
        'attention',
        { type: 'block_apps', label: 'Choose apps to block' }
      )
    );
  }

  // --- Notifications: surface whichever layer is off (actionable) ---
  if (!ctx.osNotificationsEnabled) {
    cards.push(
      card(
        `Turn on notifications`,
        `Notifications are off, so your weekly check-in and goal nudges can't reach you. Turning them on keeps you on track.`,
        'attention',
        { type: 'enable_notifications', label: 'Turn on notifications' }
      )
    );
  } else if (!ctx.goalRemindersEnabled && stats.goalsTracked > 0) {
    cards.push(
      card(
        `Get a nudge before you slip`,
        `Goal reminders are off. A daily reminder helps you hit your targets without having to think about it.`,
        'neutral',
        { type: 'enable_goal_reminders', label: 'Turn on goal reminders' }
      )
    );
  }

  // --- Sports tag with little logged time → link Apple Health (actionable) ---
  const lowActive = ctx.activeTags.find((t) => t.minutes < LOW_ACTIVE_TAG_MINUTES);
  if (lowActive && !ctx.healthLinked) {
    cards.push(
      card(
        `Track ${ctx.tagName(lowActive.tagId)} automatically`,
        `Only ${fmtMins(lowActive.minutes)} logged this week. Link Apple Health to auto-capture the workouts you do outside the app.`,
        'neutral',
        { type: 'link_health', label: 'Link Apple Health', tagId: lowActive.tagId }
      )
    );
  }

  // --- Peak window (observation) ---
  if (stats.peakDay && stats.peakHour != null) {
    cards.push(
      tip(
        `You focus best around ${fmtHour(stats.peakHour)}`,
        `${stats.peakDay} near ${fmtHour(stats.peakHour)} was your strongest window — worth protecting for deep work.`,
        'positive'
      )
    );
  }

  // --- Volume trend (observation) ---
  if (stats.trailingAvgMinutes > 0) {
    const delta = stats.deltaMinutesVsTrailingAvg;
    if (delta >= VOLUME_DELTA_MINUTES) {
      cards.push(
        tip(
          `Up ${fmtMins(Math.abs(delta))} vs your average`,
          `You focused more than your recent norm this week. Nice momentum.`,
          'positive'
        )
      );
    } else if (delta <= -VOLUME_DELTA_MINUTES) {
      cards.push(
        tip(
          `Down ${fmtMins(Math.abs(delta))} vs your average`,
          `A lighter week than usual — a normal dip. A small session tomorrow gets you rolling again.`,
          'neutral'
        )
      );
    }
  }

  // --- Widget nudges (info bullets, only when that specific widget isn't installed) ---
  if (!ctx.hasFocusWidget && stats.totalMinutes < LOW_VOLUME_MINUTES) {
    cards.push(
      tip(
        `Keep focus in view`,
        `Add the Bittersweet focus widget to your home screen — a glanceable nudge makes it easier to start.`,
        'neutral'
      )
    );
  }
  if (!ctx.hasGoalsWidget && stats.goalsTracked > 0 && stats.goalsMet < stats.goalsTracked) {
    cards.push(
      tip(
        `See your goals at a glance`,
        `Add the Goals widget to your home screen to track progress without opening the app.`,
        'neutral'
      )
    );
  }

  // Always return at least one card.
  if (cards.length === 0) {
    cards.push(
      card(
        `${fmtMins(stats.totalMinutes)} focused across ${stats.activeDays} day${
          stats.activeDays === 1 ? '' : 's'
        }`,
        `A steady week. Setting a goal unlocks sharper, more personal insights.`,
        'neutral',
        topTag
          ? { type: 'create_goal', label: 'Set a goal', tagId: topTag.tagId, period: 'weekly' }
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
