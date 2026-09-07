import { useCallback, useRef } from 'react';
import { SignIn } from './auth/SignIn';
import { useSession } from './auth/useSession';
import { LaunchAtLogin } from './menubar/LaunchAtLogin';
import {
  TOGGLE_SESSION_SHORTCUT,
  TOGGLE_WINDOW_SHORTCUT,
  useGlobalShortcuts,
} from './menubar/shortcuts';
import { useTray } from './menubar/useTray';
import { SessionControls } from './session/SessionControls';
import { SessionList } from './session/SessionList';
import { useActiveSession } from './session/useActiveSession';
import { useSessions } from './session/useSessions';
import { useStarter } from './session/useStarter';
import { useTags } from './session/useTags';
import { useTick } from './session/useTick';
import { supabase } from './supabase';

export function App() {
  const { session, restored } = useSession();
  const userId = session?.user.id;

  // Hooks no-op until userId exists, so they can be called unconditionally.
  const { tags, loading: tagsLoading, error: tagsError } = useTags(userId);
  const { sessions, loading: sessionsLoading, error: sessionsError, realtime } = useSessions(userId);
  const {
    active,
    running,
    busy,
    error: activeError,
    start,
    stop,
  } = useActiveSession(userId);

  const { starter, setTagId, setTargetMinutes } = useStarter(tags);

  // One clock for the window and the menu bar, so the two cannot show different
  // seconds. It stops on its own when no session runs.
  const now = useTick(running);

  const startFromStarter = useCallback(() => {
    start(starter.tagId, starter.targetMinutes);
  }, [start, starter.tagId, starter.targetMinutes]);

  // The shortcut and the menu bar toggle the same session. Both can fire while
  // the window is hidden, so they read the live values through a ref: the
  // handler registered with the OS is never re-registered, and a stale capture
  // would stop a session that already ended.
  //
  // The key stays registered while signed out, because a signed-out app has no
  // window on screen to explain why nothing happened. It does nothing instead —
  // a write with no session fails the row-level security check anyway.
  const live = useRef({ running, startFromStarter, stop, canStart: false });
  live.current = {
    running,
    startFromStarter,
    stop,
    canStart: session != null && starter.tagId !== '',
  };

  const toggleSession = useCallback(() => {
    const { running: isRunning, canStart } = live.current;
    if (isRunning) live.current.stop();
    else if (canStart) live.current.startFromStarter();
  }, []);

  useGlobalShortcuts(toggleSession);

  useTray({
    signedIn: session != null,
    tags,
    active,
    running,
    starter,
    now,
    onStart: start,
    onStop: stop,
  });

  // Both queries are needed before the list can render: SessionList resolves a
  // session's tag by id, so rendering while tags are still in flight makes every
  // row fall back to "Untitled" until the tags query lands. They fetch in
  // parallel and either can win, so gate on both.
  const loading = sessionsLoading || tagsLoading;

  // Don't flash the sign-in form while getSession() is still resolving.
  if (!restored) return null;
  if (!session) return <SignIn />;

  const error = activeError ?? tagsError ?? sessionsError;

  return (
    <main>
      <header>
        <div>
          <h1>Bittersweet</h1>
          <p className="muted">{session.user.email}</p>
        </div>
        <div className="header-right">
          <span className={`dot dot-${realtime}`} title={`Realtime: ${realtime}`} />
          <button type="button" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>{running ? 'In progress' : 'Start a session'}</h2>
        {tagsLoading ? (
          <p className="muted">Loading…</p>
        ) : tags.length === 0 ? (
          <p className="muted">No tags yet — create one on your phone.</p>
        ) : (
          <SessionControls
            tags={tags}
            active={active}
            running={running}
            busy={busy}
            starter={starter}
            now={now}
            onTagChange={setTagId}
            onTargetChange={setTargetMinutes}
            onStart={startFromStarter}
            onStop={stop}
          />
        )}
        <p className="muted shortcuts">
          <kbd>{prettyShortcut(TOGGLE_SESSION_SHORTCUT)}</kbd> start or stop ·{' '}
          <kbd>{prettyShortcut(TOGGLE_WINDOW_SHORTCUT)}</kbd> show or hide this window
        </p>
      </section>

      <section>
        <h2>Tags</h2>
        {tags.length === 0 ? (
          <p className="muted">No tags yet — create one on your phone.</p>
        ) : (
          <ul className="tags">
            {tags.map((t) => (
              <li key={t.id}>
                <span aria-hidden="true">{t.icon}</span>
                {/* Tag color is data, not UI chrome. */}
                <span style={{ color: t.color }}>{t.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Recent sessions</h2>
        {loading ? <p className="muted">Loading…</p> : <SessionList sessions={sessions} tags={tags} />}
      </section>

      <section>
        <h2>Menu bar</h2>
        <LaunchAtLogin />
      </section>
    </main>
  );
}

/** Tauri's accelerator words, as the symbols a Mac user reads on a key. */
function prettyShortcut(accelerator: string): string {
  return accelerator
    .split('+')
    .map((key) => {
      if (key === 'CommandOrControl') return '⌘';
      if (key === 'Shift') return '⇧';
      if (key === 'Alt') return '⌥';
      if (key === 'Control') return '⌃';
      return key;
    })
    .join('');
}
