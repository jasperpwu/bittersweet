import { useState } from 'react';
import { supabase } from '../supabase';
import { signInWithProvider, type OAuthProvider } from './oauth';

/**
 * Apple, Google and email — the same three the iOS sign-in sheet offers, in the
 * same order.
 *
 * Neither provider works until four things are configured outside this repo — a
 * Supabase redirect allowlist, a Google redirect URI, a Supabase Google client
 * secret, and an Apple Services ID (the iOS app registers a bundle ID, which the
 * web flow cannot use). `../../README.md` lists all four.
 */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function onProvider(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    try {
      await signInWithProvider(provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      // On success in the browser the page is already navigating away, and in
      // Tauri `useSession` swaps this form out — either way clearing is a no-op.
      setPending(null);
    }
  }

  // One flow at a time: a second browser tab would race the first for the port.
  const working = busy || pending !== null;

  return (
    <div className="signin">
      <h1>Bittersweet</h1>
      <p className="muted">Sign in with the account you use on your phone.</p>

      <div className="providers">
        <button
          type="button"
          className="provider provider-apple"
          disabled={working}
          onClick={() => onProvider('apple')}
        >
          <AppleMark />
          {pending === 'apple' ? 'Waiting for Apple…' : 'Continue with Apple'}
        </button>

        <button
          type="button"
          className="provider provider-google"
          disabled={working}
          onClick={() => onProvider('google')}
        >
          <GoogleMark />
          {pending === 'google' ? 'Waiting for Google…' : 'Continue with Google'}
        </button>
      </div>

      <p className="divider">
        <span>or</span>
      </p>

      <form onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            autoComplete="username"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="submit" disabled={working || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {pending && (
        <p className="muted">Finish in your browser, then come back to this window.</p>
      )}
    </div>
  );
}

/** Apple logo, from simple-icons (CC0). Takes the button's text color. */
function AppleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** Google "G". The four hex values are Google's brand palette, not UI chrome. */
function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.97-6.19A23.94 23.94 0 0 0 0 24c0 3.88.93 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
