import { normalizeActivityType } from './activityType';
import type { ActivityType, SessionTagCore, SessionTagRow } from './types';

/**
 * `session_tags` ⇄ Zustand state.
 *
 * `rowToTag` must restore every field `tagToRow` writes (CLAUDE.md). Both name
 * `SessionTagRow`, so the two clients cannot drift apart silently.
 */

/** What `tagToRow` accepts — looser than `SessionTagCore`, see `SessionToRowInput`. */
export interface TagToRowInput {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder?: number;
  activityType?: ActivityType | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
}

export function tagToRow(tag: TagToRowInput, userId: string): SessionTagRow {
  const row: SessionTagRow = {
    id: tag.id,
    user_id: userId,
    name: tag.name,
    icon: tag.icon,
    color: tag.color,
    sort_order: tag.sortOrder ?? 0,
    activity_type: tag.activityType ?? null,
  };
  // Only include timestamps if they exist — otherwise let DB defaults apply
  if (tag.createdAt instanceof Date) row.created_at = tag.createdAt.toISOString();
  if (tag.updatedAt instanceof Date) row.updated_at = tag.updatedAt.toISOString();
  if (tag.deletedAt instanceof Date) row.deleted_at = tag.deletedAt.toISOString();
  return row;
}

export function rowToTag(row: SessionTagRow): SessionTagCore {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order ?? 0,
    // Canonicalised on read so retired values (e.g. 'on_phone') map to their
    // current equivalent instead of falling through the rating engine's switch.
    ...(normalizeActivityType(row.activity_type)
      ? { activityType: normalizeActivityType(row.activity_type) }
      : {}),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    ...(row.deleted_at ? { deletedAt: new Date(row.deleted_at) } : {}),
  };
}
