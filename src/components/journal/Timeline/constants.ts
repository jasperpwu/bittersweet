// Shared timeline layout constants. Used by both the Timeline renderer and the
// drag-to-schedule math so a screen Y always maps to the same minute-of-day.
export const TIME_COLUMN_WIDTH = 70;
export const START_HOUR = 0; // 12:00 AM
export const END_HOUR = 23; // 11:00 PM
export const TOTAL_HOURS = END_HOUR - START_HOUR + 1;
export const HOUR_HEIGHT = 80;
export const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;

// Snap dropped/dragged slots to this granularity (minutes).
export const SNAP_MINUTES = 15;

// Default slot length (minutes) for a todo with no estimated duration.
export const DEFAULT_TODO_DURATION = 30;

// Gutter on each side of the timeline content area.
export const BLOCK_H_PADDING = 12;
