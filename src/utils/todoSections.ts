import type { TFunction } from 'i18next';
import type { Todo } from '../store/types';

export interface TodoSection {
  key: string;
  title: string;
  todos: Todo[];
  collapsible?: boolean;
}

// Header label for a future-dated section, e.g. "Sat, Jun 27", localized.
export const formatSectionDate = (date: Date, lang: string): string => {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  try {
    return date.toLocaleDateString(lang, opts);
  } catch {
    return date.toLocaleDateString(undefined, opts);
  }
};

/**
 * Group incomplete todos by their startAt date — Past, Today, one section per
 * future date, then No date — followed by a Completed section at the bottom.
 *
 * Single source of truth for todo ordering, shared by the Journal TODO sheet
 * (`TodoSheet`) and the Home Screen TODO widget sync (`widgetTodos`) so both
 * render todos in exactly the same order.
 */
export function buildTodoSections(
  todos: Todo[],
  opts: { filterTagId?: string | null; t: TFunction; lang: string }
): TodoSection[] {
  const { filterTagId, t, lang } = opts;

  const all = todos
    .filter((td): td is Todo => !!td && !td.deletedAt)
    .filter((td) => !filterTagId || td.tagId === filterTagId);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const past: Todo[] = [];
  const today: Todo[] = [];
  const noDate: Todo[] = [];
  const completed: Todo[] = [];
  const futureByDay = new Map<number, Todo[]>(); // key: start-of-day epoch ms

  for (const td of all) {
    if (td.completed) {
      completed.push(td);
    } else if (!td.startAt) {
      noDate.push(td);
    } else {
      const when = new Date(td.startAt);
      if (when < startOfToday) {
        past.push(td);
      } else if (when < startOfTomorrow) {
        today.push(td);
      } else {
        const day = new Date(when);
        day.setHours(0, 0, 0, 0);
        const bucket = futureByDay.get(day.getTime());
        if (bucket) bucket.push(td);
        else futureByDay.set(day.getTime(), [td]);
      }
    }
  }

  // Within a day, timed todos sort chronologically; date-only todos (no
  // meaningful time) fall to the bottom of the day, ordered by sortOrder.
  const startKey = (td: Todo): number => {
    if (!td.startAt) return 0;
    const when = new Date(td.startAt);
    if (td.startHasTime === false) {
      when.setHours(23, 59, 59, 999); // push date-only to end of its day
    }
    return when.getTime();
  };
  const byStartThenOrder = (a: Todo, b: Todo) => {
    const ta = startKey(a);
    const tb = startKey(b);
    if (ta !== tb) return ta - tb;
    return a.sortOrder - b.sortOrder;
  };
  past.sort(byStartThenOrder);
  today.sort(byStartThenOrder);
  noDate.sort((a, b) => a.sortOrder - b.sortOrder);
  completed.sort(
    (a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime()
  );

  const result: TodoSection[] = [];
  if (past.length) result.push({ key: 'past', title: t('todos.sectionPast'), todos: past });
  if (today.length) result.push({ key: 'today', title: t('todos.sectionToday'), todos: today });
  [...futureByDay.keys()]
    .sort((a, b) => a - b)
    .forEach((dayMs) => {
      result.push({
        key: `future-${dayMs}`,
        title: formatSectionDate(new Date(dayMs), lang),
        todos: futureByDay.get(dayMs)!.sort(byStartThenOrder),
      });
    });
  if (noDate.length) result.push({ key: 'noDate', title: t('todos.sectionNoDate'), todos: noDate });
  if (completed.length)
    result.push({
      key: 'completed',
      title: t('todos.sectionCompleted'),
      todos: completed,
      collapsible: true,
    });
  return result;
}
