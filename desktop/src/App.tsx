import { SignIn } from './auth/SignIn';
import { useSession } from './auth/useSession';
import { SessionControls } from './session/SessionControls';
import { SessionList } from './session/SessionList';
import { useActiveSession } from './session/useActiveSession';
import { useSessions } from './session/useSessions';
import { useTags } from './session/useTags';
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
            onStart={start}
            onStop={stop}
          />
        )}
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
    </main>
  );
}
