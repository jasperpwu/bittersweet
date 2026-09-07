import type { ActiveSessionCore, SessionTagCore } from 'shared/types';
import { formatClock, readClock } from './clock';
import { DURATIONS, type Starter } from './useStarter';

export function SessionControls({
  tags,
  active,
  running,
  busy,
  starter,
  now,
  onTagChange,
  onTargetChange,
  onStart,
  onStop,
}: {
  tags: SessionTagCore[];
  active: ActiveSessionCore | null;
  running: boolean;
  busy: boolean;
  starter: Starter;
  now: number;
  onTagChange: (tagId: string) => void;
  onTargetChange: (targetMinutes: number | undefined) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  if (running && active) {
    const tag = tags.find((t) => t.id === active.tagId);
    const { elapsed, remaining } = readClock(active, now);

    return (
      <div className="timer">
        <div className="timer-main">
          <span className="clock">
            {remaining != null && remaining > 0
              ? formatClock(remaining)
              : formatClock(elapsed)}
          </span>
          <span className="muted">
            {tag ? `${tag.icon} ${tag.name}` : 'Focus'}
            {active.targetMinutes == null
              ? ' · counting up'
              : remaining != null && remaining <= 0
                ? ' · over time'
                : ` · ${active.targetMinutes}m`}
            {active.origin === 'ios' ? ' · started on phone' : ''}
          </span>
        </div>
        <button type="button" className="stop" onClick={onStop} disabled={busy}>
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="starter">
      <label>
        Tag
        <select value={starter.tagId} onChange={(e) => onTagChange(e.target.value)}>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.icon} {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="durations">
        {DURATIONS.map((d) => (
          <button
            key={d ?? 'infinite'}
            type="button"
            className={d === starter.targetMinutes ? 'chip chip-on' : 'chip'}
            onClick={() => onTargetChange(d)}>
            {d ? `${d}m` : '∞'}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="start"
        onClick={onStart}
        disabled={busy || !starter.tagId}>
        Start
      </button>
    </div>
  );
}
