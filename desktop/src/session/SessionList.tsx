import type { FocusSessionCore, SessionTagCore } from 'shared/types';

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function SessionList({
  sessions,
  tags,
}: {
  sessions: FocusSessionCore[];
  tags: SessionTagCore[];
}) {
  const tagById = new Map(tags.map((t) => [t.id, t]));

  if (sessions.length === 0) {
    return <p className="muted">No sessions yet.</p>;
  }

  return (
    <ul className="sessions">
      {sessions.map((s) => {
        const tag = tagById.get(s.tagId);
        return (
          <li key={s.id}>
            <span className="icon" aria-hidden="true">
              {tag?.icon ?? '•'}
            </span>
            <span className="body">
              {/* Tag color is data, not UI chrome — it comes straight from the row. */}
              <span className="name" style={{ color: tag?.color }}>
                {tag?.name ?? 'Untitled'}
              </span>
              {s.notes && <span className="notes">{s.notes}</span>}
            </span>
            <span className="meta">
              <span className="duration">{formatDuration(s.duration)}</span>
              <span className="when">
                {dayFmt.format(s.startTime)} · {timeFmt.format(s.startTime)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
