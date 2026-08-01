/**
 * Resolves once `_layout.tsx` has attached its `onAuthStateChange` listener —
 * the single place the Auth Data Lifecycle Policy is implemented (clear/pull on
 * an existing account, preserve/upload on a brand-new one, wipe on user switch).
 *
 * Anything that can establish a session OUTSIDE the normal sign-in buttons must
 * wait for this first. The concrete case is the email deep link: tapping a
 * password-reset or confirmation link cold-starts the app, and
 * `exchangeCodeForSession` emits its `PASSWORD_RECOVERY` / `SIGNED_IN` event
 * exactly once. Exchange before the listener exists and that event lands on the
 * floor — the account gets a valid session while local data is never cleared or
 * pulled, which is precisely how one user's data leaks into another's account.
 */
let markReady: () => void;
export const authListenerReady: Promise<void> = new Promise((resolve) => {
  markReady = resolve;
});

export const markAuthListenerReady = () => markReady();

/**
 * Await the listener, but never block forever: if the bootstrap chain failed
 * (hydration or restoreSession threw), the listener is never attached and the
 * user would be stuck staring at a dead link. Proceeding after the timeout is
 * the lesser evil — the next cold start's `INITIAL_SESSION` reconciles.
 */
export const AUTH_LISTENER_READY_TIMEOUT_MS = 10000;

export const waitForAuthListener = (): Promise<void> =>
  Promise.race([
    authListenerReady,
    new Promise<void>((resolve) => setTimeout(resolve, AUTH_LISTENER_READY_TIMEOUT_MS)),
  ]);
