/**
 * Bidirectional mapping between Zustand state (camelCase, Date objects)
 * and Supabase rows (snake_case, ISO strings).
 */

// --- Generic helpers ---

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function mapKeysToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = toSnakeCase(key);
    const value = obj[key];
    if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else if (Array.isArray(value)) {
      result[snakeKey] = value;
    } else if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      result[snakeKey] = mapKeysToSnake(value);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

function mapKeysToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = obj[key];
  }
  return result;
}

// --- Date fields per table (to convert ISO strings back to Date objects) ---

const DATE_FIELDS: Record<string, string[]> = {
  focus_sessions: ['start_time', 'end_time', 'created_at', 'updated_at', 'deleted_at'],
  session_tags: ['created_at', 'updated_at', 'deleted_at'],
  focus_goals: ['created_at', 'updated_at', 'last_reset_date', 'deleted_at'],
  todos: ['created_at', 'updated_at', 'start_at', 'completed_at', 'deleted_at'],
  coach_reports: ['week_start', 'week_end', 'generated_at', 'seen_at', 'created_at', 'updated_at', 'deleted_at'],
};

// --- Session mapper ---

export function sessionToRow(session: any, userId: string): Record<string, any> {
  const row: Record<string, any> = {
    id: session.id,
    user_id: userId,
    start_time:
      session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
    end_time: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
    duration: session.duration,
    initial_set_duration: session.initialSetDuration ?? null,
    actual_duration: session.actualDuration ?? null,
    adjusted_duration: session.adjustedDuration ?? null,
    tag_id: session.tagId,
    secondary_tag_id: session.secondaryTagId ?? null,
    notes: session.notes ?? null,
    photo_url: session.photoUrl ?? null,
    is_manual_entry: session.isManualEntry ?? false,
    accelerate_multiplier: session.accelerateMultiplier ?? 1,
    focus_rating: session.focusRating ?? null,
    rating_source: session.ratingSource ?? null,
    motion_summary: session.motionSummary ?? null,
  };
  if (session.createdAt instanceof Date) row.created_at = session.createdAt.toISOString();
  if (session.updatedAt instanceof Date) row.updated_at = session.updatedAt.toISOString();
  return row;
}

export function rowToSession(row: Record<string, any>): any {
  return {
    id: row.id,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    duration: row.duration,
    initialSetDuration: row.initial_set_duration,
    actualDuration: row.actual_duration,
    adjustedDuration: row.adjusted_duration,
    tagId: row.tag_id,
    secondaryTagId: row.secondary_tag_id ?? undefined,
    notes: row.notes,
    photoUrl: row.photo_url ?? undefined,
    isManualEntry: row.is_manual_entry ?? false,
    accelerateMultiplier: row.accelerate_multiplier ?? 1,
    focusRating: row.focus_rating ?? undefined,
    ratingSource: row.rating_source ?? undefined,
    motionSummary: row.motion_summary ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// --- Tag mapper ---

export function tagToRow(tag: any, userId: string): Record<string, any> {
  const row: Record<string, any> = {
    id: tag.id,
    user_id: userId,
    name: tag.name,
    icon: tag.icon,
    color: tag.color,
    sort_order: tag.sortOrder ?? 0,
    is_sharing: tag.isSharing ?? false,
    shared_from_tag_id: tag.sharedFromTagId ?? null,
    shared_from_user_id: tag.sharedFromUserId ?? null,
    shared_owner_name: tag.sharedOwnerName ?? null,
    activity_type: tag.activityType ?? null,
  };
  // Only include timestamps if they exist — otherwise let DB defaults apply
  if (tag.createdAt instanceof Date) row.created_at = tag.createdAt.toISOString();
  if (tag.updatedAt instanceof Date) row.updated_at = tag.updatedAt.toISOString();
  if (tag.deletedAt instanceof Date) row.deleted_at = tag.deletedAt.toISOString();
  return row;
}

export function rowToTag(row: Record<string, any>): any {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order ?? 0,
    isSharing: row.is_sharing ?? false,
    ...(row.shared_from_tag_id ? { sharedFromTagId: row.shared_from_tag_id } : {}),
    ...(row.shared_from_user_id ? { sharedFromUserId: row.shared_from_user_id } : {}),
    ...(row.shared_owner_name ? { sharedOwnerName: row.shared_owner_name } : {}),
    ...(row.activity_type ? { activityType: row.activity_type } : {}),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    ...(row.deleted_at ? { deletedAt: new Date(row.deleted_at) } : {}),
  };
}

// --- Goal mapper ---

export function goalToRow(goal: any, userId: string): Record<string, any> {
  const row: Record<string, any> = {
    id: goal.id,
    user_id: userId,
    custom_name: goal.customName ?? null,
    tag_id: goal.tagId,
    active_period: goal.activePeriod ?? 'daily',
    daily_target_minutes: goal.dailyTargetMinutes ?? 0,
    daily_rest_day_target_minutes: goal.dailyRestDayTargetMinutes ?? 0,
    weekly_target_minutes: goal.weeklyTargetMinutes ?? 0,
    monthly_target_minutes: goal.monthlyTargetMinutes ?? 0,
    total_target_minutes: goal.totalTargetMinutes ?? 0,
    target_history: goal.targetHistory ?? [],
    is_active: goal.isActive ?? true,
    is_repeating: goal.isRepeating ?? true,
    show_total_hours: goal.showTotalHours ?? false,
    sort_order: goal.sortOrder ?? 0,
  };
  if (goal.lastResetDate instanceof Date) row.last_reset_date = goal.lastResetDate.toISOString();
  if (goal.createdAt instanceof Date) row.created_at = goal.createdAt.toISOString();
  if (goal.updatedAt instanceof Date) row.updated_at = goal.updatedAt.toISOString();
  return row;
}

export function rowToGoal(row: Record<string, any>): any {
  return {
    id: row.id,
    customName: row.custom_name ?? undefined,
    tagId: row.tag_id,
    activePeriod: row.active_period ?? 'daily',
    dailyTargetMinutes: row.daily_target_minutes ?? 0,
    dailyRestDayTargetMinutes: row.daily_rest_day_target_minutes ?? 0,
    weeklyTargetMinutes: row.weekly_target_minutes ?? 0,
    monthlyTargetMinutes: row.monthly_target_minutes ?? 0,
    totalTargetMinutes: row.total_target_minutes ?? 0,
    targetHistory: row.target_history ?? [],
    isActive: row.is_active ?? true,
    isRepeating: row.is_repeating ?? true,
    showTotalHours: row.show_total_hours ?? false,
    sortOrder: row.sort_order ?? 0,
    lastResetDate: row.last_reset_date ? new Date(row.last_reset_date) : new Date(),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

// --- Todo mapper ---

export function todoToRow(todo: any, userId: string): Record<string, any> {
  const toIso = (v: any) => (v instanceof Date ? v.toISOString() : v ?? null);
  const row: Record<string, any> = {
    id: todo.id,
    user_id: userId,
    name: todo.name,
    tag_id: todo.tagId,
    start_at: toIso(todo.startAt),
    start_has_time: todo.startHasTime ?? null,
    deadline_at: toIso(todo.deadlineAt),
    deadline_has_time: todo.deadlineHasTime ?? null,
    duration_minutes: todo.durationMinutes ?? null,
    notes: todo.notes ?? null,
    completed: todo.completed ?? false,
    completed_at: toIso(todo.completedAt),
    sort_order: todo.sortOrder ?? 0,
    // Always emit recurrence (null when none) so removing a repeat rule
    // clears the cloud column instead of leaving a stale rule behind.
    recurrence: todo.recurrence ?? null,
    // Always emit deleted_at (null when active) so an undo/restore explicitly
    // un-tombstones the cloud row instead of leaving a stale deleted_at behind.
    deleted_at: toIso(todo.deletedAt),
  };
  if (todo.createdAt) row.created_at = toIso(todo.createdAt);
  if (todo.updatedAt) row.updated_at = toIso(todo.updatedAt);
  return row;
}

export function rowToTodo(row: Record<string, any>): any {
  return {
    id: row.id,
    userId: row.user_id ?? 'local-user',
    name: row.name,
    tagId: row.tag_id,
    // Legacy rows predate start_has_time (null) but always carried a real time,
    // so default null → true; an explicit false marks a date-only todo.
    ...(row.start_at ? { startAt: new Date(row.start_at), startHasTime: row.start_has_time ?? true } : {}),
    ...(row.deadline_at
      ? { deadlineAt: new Date(row.deadline_at), deadlineHasTime: row.deadline_has_time ?? false }
      : {}),
    ...(row.duration_minutes != null ? { durationMinutes: row.duration_minutes } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    completed: row.completed ?? false,
    ...(row.completed_at ? { completedAt: new Date(row.completed_at) } : {}),
    sortOrder: row.sort_order ?? 0,
    ...(row.recurrence ? { recurrence: row.recurrence } : {}),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    ...(row.deleted_at ? { deletedAt: new Date(row.deleted_at) } : {}),
  };
}

// --- Rewards mapper ---

// One-time setup tasks that award fruits. `everSetup` becomes sticky-true the first
// time we detect the user set the thing up (so the claim survives later removing the
// widget/goal); `claimed` becomes true once the fruits are awarded. Both are monotonic
// (only false→true), which lets us OR-merge them across devices/reinstalls without LWW.
export type SetupTaskId = 'widget' | 'goal';
export const SETUP_TASK_IDS: SetupTaskId[] = ['widget', 'goal'];
export const SETUP_TASK_REWARD = 20;

export interface SetupTaskState {
  everSetup: boolean;
  claimed: boolean;
}
export type SetupTasks = Record<SetupTaskId, SetupTaskState>;

export function defaultSetupTasks(): SetupTasks {
  return {
    widget: { everSetup: false, claimed: false },
    goal: { everSetup: false, claimed: false },
  };
}

// Normalize a possibly-partial/missing tasks blob (older rows, new task ids) to the
// full shape, defaulting any missing flag to false.
export function normalizeSetupTasks(tasks: any): SetupTasks {
  const base = defaultSetupTasks();
  if (!tasks || typeof tasks !== 'object') return base;
  for (const id of SETUP_TASK_IDS) {
    base[id] = {
      everSetup: tasks[id]?.everSetup === true,
      claimed: tasks[id]?.claimed === true,
    };
  }
  return base;
}

// Monotonic OR-merge: a flag set on either side stays set. Immune to last-write-wins,
// so applying pulled cloud data can never un-claim or un-setup a task.
export function mergeSetupTasks(a: any, b: any): SetupTasks {
  const x = normalizeSetupTasks(a);
  const y = normalizeSetupTasks(b);
  const out = defaultSetupTasks();
  for (const id of SETUP_TASK_IDS) {
    out[id] = {
      everSetup: x[id].everSetup || y[id].everSetup,
      claimed: x[id].claimed || y[id].claimed,
    };
  }
  return out;
}

export function rewardsToRow(rewards: any, userId: string): Record<string, any> {
  return {
    user_id: userId,
    balance: rewards.balance,
    total_earned: rewards.totalEarned,
    total_spent: rewards.totalSpent,
    tasks: normalizeSetupTasks(rewards.tasks),
    unlock_history: rewards.unlockHistory ?? {},
    updated_at: rewards.updatedAt ?? new Date().toISOString(),
  };
}

export function rowToRewards(row: Record<string, any>): any {
  return {
    balance: row.balance ?? 0,
    totalEarned: row.total_earned ?? 0,
    totalSpent: row.total_spent ?? 0,
    tasks: normalizeSetupTasks(row.tasks),
    unlockHistory:
      row.unlock_history && typeof row.unlock_history === 'object'
        ? row.unlock_history
        : {},
    updatedAt: row.updated_at ?? null,
  };
}

// --- Purchase mapper (fruit-store purchase history) ---

export function purchaseToRow(purchase: any, userId: string): Record<string, any> {
  return {
    id: purchase.id,
    user_id: userId,
    product_id: purchase.productId,
    cost: purchase.cost ?? 0,
    tip_id: purchase.tipId ?? null,
    photo_url: purchase.photoUrl ?? null,
    created_at: purchase.createdAt,
    updated_at: purchase.updatedAt ?? purchase.createdAt,
  };
}

export function rowToPurchase(row: Record<string, any>): any {
  return {
    id: row.id,
    productId: row.product_id,
    cost: row.cost ?? 0,
    ...(row.tip_id ? { tipId: row.tip_id } : {}),
    ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

// --- Custom reward mapper (fruit-store Custom tab definitions) ---

export function customRewardToRow(reward: any, userId: string): Record<string, any> {
  return {
    id: reward.id,
    user_id: userId,
    name: reward.name,
    emoji: reward.emoji ?? null,
    cost: reward.cost ?? 0,
    created_at: reward.createdAt,
    updated_at: reward.updatedAt ?? reward.createdAt,
    deleted_at: reward.deletedAt ?? null,
  };
}

export function rowToCustomReward(row: Record<string, any>): any {
  return {
    id: row.id,
    name: row.name ?? '',
    ...(row.emoji ? { emoji: row.emoji } : {}),
    cost: row.cost ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  };
}

// --- Badge mapper ---

export function badgeToRow(badge: any, userId: string): Record<string, any> {
  const row: Record<string, any> = {
    id: badge.id,
    user_id: userId,
    goal_id: badge.goalId ?? null,
    tag_icon: badge.tagIcon ?? '',
    tag_name: badge.tagName ?? '',
    tag_color: badge.tagColor ?? '',
    goal_name: badge.goalName ?? '',
    total_minutes: badge.totalMinutes ?? 0,
    total_sessions: badge.totalSessions ?? 0,
    daily_stats: badge.dailyStats ?? null,
    weekly_stats: badge.weeklyStats ?? null,
    monthly_stats: badge.monthlyStats ?? null,
    duration_distribution: badge.durationDistribution ?? {},
    notes_count: badge.notesCount ?? 0,
    recent_notes: badge.recentNotes ?? [],
    start_date: badge.startDate ?? '',
    end_date: badge.endDate ?? '',
  };
  if (badge.createdAt instanceof Date) row.created_at = badge.createdAt.toISOString();
  if (badge.updatedAt instanceof Date) row.updated_at = badge.updatedAt.toISOString();
  if (badge.deletedAt instanceof Date) row.deleted_at = badge.deletedAt.toISOString();
  return row;
}

export function rowToBadge(row: Record<string, any>): any {
  return {
    id: row.id,
    goalId: row.goal_id ?? undefined,
    tagIcon: row.tag_icon ?? '',
    tagName: row.tag_name ?? '',
    tagColor: row.tag_color ?? '',
    goalName: row.goal_name ?? '',
    totalMinutes: row.total_minutes ?? 0,
    totalSessions: row.total_sessions ?? 0,
    dailyStats: row.daily_stats ?? undefined,
    weeklyStats: row.weekly_stats ?? undefined,
    monthlyStats: row.monthly_stats ?? undefined,
    durationDistribution: row.duration_distribution ?? {},
    notesCount: row.notes_count ?? 0,
    recentNotes: row.recent_notes ?? [],
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? '',
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    ...(row.deleted_at ? { deletedAt: new Date(row.deleted_at) } : {}),
  };
}

// --- Coach report mapper ---
// subScores / stats / cards are stored as JSONB blobs as-is (their inner camelCase keys
// are preserved on round-trip), exactly like badge's daily_stats/duration_distribution.

export function coachReportToRow(report: any, userId: string): Record<string, any> {
  const toIso = (v: any) => (v instanceof Date ? v.toISOString() : v);
  const row: Record<string, any> = {
    id: report.id,
    user_id: userId,
    week_start: toIso(report.weekStart),
    week_end: toIso(report.weekEnd),
    focus_score: report.focusScore ?? 0,
    sub_scores: report.subScores ?? {},
    stats: report.stats ?? {},
    cards: report.cards ?? [],
    narrator: report.narrator ?? 'template',
  };
  if (report.generatedAt) row.generated_at = toIso(report.generatedAt);
  if (report.seenAt instanceof Date) row.seen_at = report.seenAt.toISOString();
  if (report.createdAt instanceof Date) row.created_at = report.createdAt.toISOString();
  if (report.updatedAt instanceof Date) row.updated_at = report.updatedAt.toISOString();
  if (report.deletedAt instanceof Date) row.deleted_at = report.deletedAt.toISOString();
  return row;
}

export function rowToCoachReport(row: Record<string, any>): any {
  return {
    id: row.id,
    weekStart: row.week_start ? new Date(row.week_start) : new Date(),
    weekEnd: row.week_end ? new Date(row.week_end) : new Date(),
    focusScore: row.focus_score ?? 0,
    subScores: row.sub_scores ?? { consistency: 0, quality: 0, volume: 0 },
    stats: row.stats ?? {},
    cards: row.cards ?? [],
    narrator: row.narrator ?? 'template',
    generatedAt: row.generated_at ? new Date(row.generated_at) : new Date(),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    ...(row.seen_at ? { seenAt: new Date(row.seen_at) } : {}),
    ...(row.deleted_at ? { deletedAt: new Date(row.deleted_at) } : {}),
  };
}

// --- Settings mapper ---

/**
 * Flatten AppPreferences (nested notifications/focus objects) into a flat DB row.
 * lastDurationByTagId comes from the main store (focus.lastDurationByTagId), not unified store.
 */
export function settingsToRow(
  preferences: any,
  userId: string,
  lastDurationByTagId?: Record<string, number>
): Record<string, any> {
  return {
    user_id: userId,
    theme: preferences.theme ?? 'system',
    language: preferences.language ?? 'en',
    notifications_enabled: preferences.notifications?.enabled ?? true,
    notifications_sound: preferences.notifications?.sound ?? true,
    notifications_vibration: preferences.notifications?.vibration ?? true,
    goal_reminder_enabled: preferences.notifications?.goalReminderEnabled ?? true,
    goal_reminder_time: preferences.notifications?.goalReminderTime ?? '20:00',
    default_duration: preferences.focus?.defaultDuration ?? 25,
    timer_picker_style: preferences.focus?.timerPickerStyle ?? 'scroller',
    rest_days: preferences.restDays ?? [0, 6],
    week_start_day: preferences.weekStartDay ?? 1,
    adhd_mode_enabled: preferences.adhdModeEnabled ?? false,
    // Apple Health settings (the `anchor` is intentionally device-local — not synced).
    healthkit_enabled: preferences.healthKit?.enabled ?? false,
    healthkit_linked_tag_id: preferences.healthKit?.linkedTagId ?? null,
    last_duration_by_tag: lastDurationByTagId ?? {},
    slider_theme_id: preferences.sliderThemeId ?? null,
    has_seen_onboarding: preferences.hasSeenOnboarding ?? false,
    has_seen_fruit_coach_mark: preferences.hasSeenFruitCoachMark ?? false,
    has_seen_tag_swipe_hint: preferences.hasSeenTagSwipeHint ?? false,
    has_seen_goal_swipe_hint: preferences.hasSeenGoalSwipeHint ?? false,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Expand a flat DB row back into nested AppPreferences shape.
 */
export function rowToSettings(row: Record<string, any>): any {
  return {
    hasSeenOnboarding: row.has_seen_onboarding ?? false,
    hasSeenFruitCoachMark: row.has_seen_fruit_coach_mark ?? false,
    hasSeenTagSwipeHint: row.has_seen_tag_swipe_hint ?? false,
    hasSeenGoalSwipeHint: row.has_seen_goal_swipe_hint ?? false,
    theme: row.theme ?? 'system',
    language: row.language ?? 'en',
    notifications: {
      enabled: row.notifications_enabled ?? true,
      sound: row.notifications_sound ?? true,
      vibration: row.notifications_vibration ?? true,
      goalReminderEnabled: row.goal_reminder_enabled ?? true,
      goalReminderTime: row.goal_reminder_time ?? '20:00',
    },
    focus: {
      defaultDuration: row.default_duration ?? 25,
      timerPickerStyle: row.timer_picker_style ?? 'scroller',
    },
    restDays: row.rest_days ?? [0, 6],
    weekStartDay: row.week_start_day ?? 1,
    adhdModeEnabled: row.adhd_mode_enabled ?? false,
    // Apple Health: restore synced fields only. `anchor` is omitted on purpose so
    // the unified-store deep-merge preserves this device's local query cursor.
    healthKit: {
      enabled: row.healthkit_enabled ?? false,
      linkedTagId: row.healthkit_linked_tag_id ?? null,
    },
    lastDurationByTagId: row.last_duration_by_tag ?? {},
    sliderThemeId: row.slider_theme_id ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// --- Referral mapper ---

export function referralToRow(referral: any, userId: string): Record<string, any> {
  return {
    user_id: userId,
    referral_count: referral.referralCount ?? 0,
    claimed_tier: referral.claimedTier ?? 0,
    referral_code: referral.referralCode ?? null,
    updated_at: referral.updatedAt ?? new Date().toISOString(),
  };
}

export function rowToReferral(row: Record<string, any>): any {
  return {
    referralCode: row.referral_code ?? null,
    referralCount: row.referral_count ?? 0,
    claimedTier: row.claimed_tier ?? 0,
    updatedAt: row.updated_at ?? null,
  };
}

// --- Normalized state helpers ---

/**
 * Convert a normalized { byId, allIds } structure into an array of Supabase rows.
 */
export function normalizedToRows<T>(
  normalized: { byId: Record<string, T>; allIds: string[] },
  mapFn: (item: T, userId: string) => Record<string, any>,
  userId: string
): Record<string, any>[] {
  return normalized.allIds
    .map((id) => normalized.byId[id])
    .filter(Boolean)
    .map((item) => mapFn(item, userId));
}

/**
 * Convert an array of Supabase rows into a normalized { byId, allIds } structure.
 */
export function rowsToNormalized<T extends { id: string }>(
  rows: Record<string, any>[],
  mapFn: (row: Record<string, any>) => T
): { byId: Record<string, T>; allIds: string[] } {
  const byId: Record<string, T> = {};
  const allIds: string[] = [];

  for (const row of rows) {
    const item = mapFn(row);
    byId[item.id] = item;
    allIds.push(item.id);
  }

  return { byId, allIds };
}
