import type { TodoRecurrence } from '../store/types';

// Single source of truth for recurring-todo occurrence math, shared by the
// roll-forward pass (store) and notification scheduling.

const daysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

/**
 * Whether `date`'s calendar day is an occurrence of the given recurrence.
 * Monthly days 29–31 clamp to the last day of shorter months (Google Tasks
 * behavior), so "every month on the 31st" fires on Feb 28/29, Apr 30, etc.
 */
export function isOccurrenceDay(rec: TodoRecurrence, date: Date): boolean {
  switch (rec.freq) {
    case 'daily':
      return true;
    case 'weekly':
      return (rec.weekdays ?? []).includes(date.getDay());
    case 'monthly': {
      const target = Math.min(
        rec.monthDay ?? 1,
        daysInMonth(date.getFullYear(), date.getMonth())
      );
      return date.getDate() === target;
    }
  }
}

/**
 * Earliest occurrence on or after `from`'s day, carrying `anchor`'s
 * time-of-day. `anchor` is the todo's current startAt (whose clock time is
 * preserved); `from` is usually today (roll-forward) or the day after the
 * current occurrence (next reminder after completion).
 */
export function nextOccurrence(rec: TodoRecurrence, anchor: Date, from: Date): Date {
  const cursor = new Date(from);
  cursor.setHours(anchor.getHours(), anchor.getMinutes(), anchor.getSeconds(), 0);
  // Bounded scan: monthly-on-31st can skip up to ~2 months of days; 366 covers
  // every recurrence this app supports with a wide margin.
  for (let i = 0; i < 366; i++) {
    if (isOccurrenceDay(rec, cursor)) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return new Date(cursor);
}

/** Start of the calendar day containing `date`. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
