import { useState } from 'react';
import { supabase } from '../supabase';

/**
 * Email + password only, on purpose.
 *
 * The iOS app also offers Apple and Google, but both need a redirect URL
 * allowlisted in the Supabase dashboard before they work from a browser origin.
 * Email auth already exists on this project (added for App Store review) and
 * needs no dashboard change, so Phase 1 proves auth + RLS + realtime without
 * blocking on configuration. Adding the OAuth buttons later is additive.
 */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <form className="signin" onSubmit={onSubmit}>
      <h1>Bittersweet</h1>
      <p className="muted">Sign in with the account you use on your phone.</p>

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

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
