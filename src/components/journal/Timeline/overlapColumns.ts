/**
 * Calendar-style overlap layout, shared by the single-day Timeline (sessions)
 * and the 3-day TODOs view (scheduled todo blocks).
 *
 * Events sorted by start are grouped into clusters of transitively-overlapping
 * intervals; within a cluster each event is greedily placed into the first
 * column whose previous event has already ended. Every event in a cluster is
 * sized to 1/numCols of the width so nothing overlaps.
 *
 * Returns a map of event id → { colIndex, numCols }.
 */
export interface OverlapInterval {
  id: string;
  /** Start/end in any consistent unit (ms timestamps, minutes, ...). */
  start: number;
  end: number;
}

export const computeOverlapColumns = (intervals: OverlapInterval[]) => {
  const layout = new Map<string, { colIndex: number; numCols: number }>();
  let columns: OverlapInterval[][] = [];
  let groupEnd = 0;

  const flushGroup = () => {
    const numCols = columns.length;
    columns.forEach((col, colIndex) => {
      col.forEach((ev) => layout.set(ev.id, { colIndex, numCols }));
    });
    columns = [];
    groupEnd = 0;
  };

  for (const interval of intervals) {
    // A new event starting at/after the whole group's end closes the group.
    if (columns.length > 0 && interval.start >= groupEnd) {
      flushGroup();
    }

    // Place into the first column whose last event has already ended.
    let placed = false;
    for (const col of columns) {
      if (interval.start >= col[col.length - 1].end) {
        col.push(interval);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([interval]);

    groupEnd = Math.max(groupEnd, interval.end);
  }
  flushGroup();

  return layout;
};
