import { useEffect, useState } from 'react';
import type { ActiveSessionCore, SessionTagCore } from 'shared/types';

/** Presets, mirroring the phone's picker. `undefined` = infinite / count-up. */
const DURATIONS: (number | undefined)[] = [15, 25, 30, 45, 60, undefined];

function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Live clock for a running session. Ticks only while one is actually running. */
function useTick(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return now;
}

export function SessionControls({
  tags,
  active,
  running,
  busy,
  onStart,
  onStop,
}: {
  tags: SessionTagCore[];
  active: ActiveSessionCore | null;
  running: boolean;
  busy: boolean;
  onStart: (tagId: string, targetMinutes: number | undefined) => void;
  onStop: () => void;
}) {
  const [tagId, setTagId] = useState('');
  const [target, setTarget] = useState<number | undefined>(25);
  const now = useTick(running);

  // Default to the first tag once tags land, without clobbering a user choice.
  useEffect(() => {
    if (!tagId && tags.length > 0) setTagId(tags[0].id);
  }, [tags, tagId]);

  if (running && active) {
    const tag = tags.find((t) => t.id === active.tagId);
    const elapsed = Math.floor((now - active.startedAt.getTime()) / 1000);
    const remaining =
      active.targetMinutes != null ? active.targetMinutes * 60 - elapsed : undefined;

    return (
      <div className="timer">
        <div className="timer-main">
          <span className="clock">
            {remaining != null && remaining > 0
              ? formatElapsed(remaining)
              : formatElapsed(elapsed)}
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
        <select value={tagId} onChange={(e) => setTagId(e.target.value)}>
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
            className={d === target ? 'chip chip-on' : 'chip'}
            onClick={() => setTarget(d)}>
            {d ? `${d}m` : '∞'}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="start"
        onClick={() => onStart(tagId, target)}
        disabled={busy || !tagId}>
        Start
      </button>
    </div>
  );
}
