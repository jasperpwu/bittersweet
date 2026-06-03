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
  focus_sessions: ['start_time', 'end_time', 'created_at', 'updated_at', 'paused_at', 'resumed_at', 'deleted_at'],
  session_tags: ['created_at', 'updated_at', 'deleted_at'],
  focus_goals: ['created_at', 'updated_at', 'last_reset_date', 'deleted_at'],
};

// --- Session mapper ---

export function sessionToRow(session: any, userId: string): Record<string, any> {
  const row: Record<string, any> = {
    id: session.id,
    user_id: userId,
    start_time: session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
    end_time: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
    duration: session.duration,
    initial_set_duration: session.initialSetDuration ?? null,
    actual_duration: session.actualDuration ?? null,
    adjusted_duration: session.adjustedDuration ?? null,
    tag_id: session.tagId,
    notes: session.notes ?? null,
    photo_url: session.photoUrl ?? null,
    is_paused: session.isPaused ?? false,
    total_pause_time: session.totalPauseTime ?? 0,
    is_manual_entry: session.isManualEntry ?? false,
    accelerate_multiplier: session.accelerateMultiplier ?? 1,
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
    notes: row.notes,
    photoUrl: row.photo_url ?? undefined,
    isPaused: row.is_paused ?? false,
    totalPauseTime: row.total_pause_time ?? 0,
    isManualEntry: row.is_manual_entry ?? false,
    accelerateMultiplier: row.accelerate_multiplier ?? 1,
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
    is_default: tag.isDefault ?? false,
    sort_order: tag.sortOrder ?? 0,
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
    isDefault: row.is_default ?? false,
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
    target_history: goal.targetHistory ?? [],
    is_active: goal.isActive ?? true,
    is_repeating: goal.isRepeating ?? true,
    show_total_hours: goal.showTotalHours ?? false,
    current_progress: goal.currentProgress ?? 0,
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
    targetHistory: row.target_history ?? [],
    isActive: row.is_active ?? true,
    isRepeating: row.is_repeating ?? true,
    showTotalHours: row.show_total_hours ?? false,
    currentProgress: row.current_progress ?? 0,
    lastResetDate: row.last_reset_date ? new Date(row.last_reset_date) : new Date(),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

// --- Rewards mapper ---

export function rewardsToRow(rewards: any, userId: string): Record<string, any> {
  return {
    user_id: userId,
    balance: rewards.balance,
    total_earned: rewards.totalEarned,
    total_spent: rewards.totalSpent,
    updated_at: rewards.updatedAt ?? new Date().toISOString(),
  };
}

export function rowToRewards(row: Record<string, any>): any {
  return {
    balance: row.balance ?? 0,
    totalEarned: row.total_earned ?? 0,
    totalSpent: row.total_spent ?? 0,
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
