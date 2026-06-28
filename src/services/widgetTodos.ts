import i18n from '../i18n';
import { useAppStore } from '../store';
import type { Todo } from '../store/types';
import { buildTodoSections } from '../utils/todoSections';
import { WidgetService, type WidgetTodoItem } from './WidgetService';

/**
 * Build the flattened, ordered TODO item list for the Home Screen widget from
 * the current store state. Uses the same grouping as the Journal sheet
 * (buildTodoSections) so the order is identical, then drops the Completed
 * section (the widget only shows incomplete todos).
 */
export function buildWidgetTodoItems(): WidgetTodoItem[] {
  const { todos, tags } = useAppStore.getState().focus;

  const all = todos.allIds.map((id) => todos.byId[id]).filter((td): td is Todo => !!td);
  const sections = buildTodoSections(all, {
    filterTagId: null,
    t: i18n.t,
    lang: i18n.language,
  });

  // Flat list of incomplete todos in sheet order (Past → Today → future days →
  // No date). The widget shows a single "TODOs" title instead of per-section
  // headers, so we don't emit header items.
  const items: WidgetTodoItem[] = [];
  for (const section of sections) {
    if (section.key === 'completed') continue; // widget hides completed todos
    for (const todo of section.todos) {
      const tag = tags.byId[todo.tagId];
      items.push({
        type: 'todo',
        id: todo.id,
        name: todo.name,
        tagIcon: tag?.icon ?? '',
        tagColor: tag?.color ?? '#6592E9',
      });
    }
  }
  return items;
}

/** Recompute the widget TODO list from the store and push it to UserDefaults. */
export function syncWidgetTodos(): void {
  try {
    WidgetService.syncTodoList(buildWidgetTodoItems());
  } catch (error) {
    console.error('📱 [Widget] Failed to sync widget todos:', error);
  }
}
