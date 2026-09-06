import { isTauri } from '@tauri-apps/api/core';
import { cancel, onUrl, start } from '@fabianlars/tauri-plugin-oauth';
import { openUrl } from '@tauri-apps/plugin-opener';
import { supabase } from '../supabase';

export type OAuthProvider = 'apple' | 'google';

/**
 * Apple and Google, the same two providers the iOS app offers.
 *
 * iOS uses the *native* flow: the OS returns an identity token and the app calls
 * `signInWithIdToken`. There is no native equivalent in a webview, so the desktop
 * client uses the web flow — `signInWithOAuth` → provider → Supabase callback →
 * back to us. How "back to us" works is the only real difference between the two
 * environments this file supports:
 *
 *  - **Browser** (`npm run dev`): a plain redirect to `window.location.origin`.
 *    `detectSessionInUrl: true` in `../supabase.ts` picks the `?code=` up on the
 *    way back and exchanges it. Nothing else to do.
 *
 *  - **Tauri** (`npm run app`): the provider page must NOT open in the app's own
 *    webview — Google rejects embedded webviews outright (`disallowed_useragent`)
 *    and the flow dead-ends. So the URL opens in the user's real browser, and a
 *    throwaway localhost server (tauri-plugin-oauth) catches the redirect and
 *    hands the code back over IPC.
 *
 * PKCE makes the loopback safe: the code verifier stays in this client (see
 * `flowType: 'pkce'`), so the authorization code alone is worthless to anything
 * else that might be listening on the machine.
 */

/**
 * Fixed ports, not the plugin's default random one.
 *
 * Supabase validates `redirect_to` against the dashboard allowlist, and its glob
 * matcher cannot usefully wildcard a port — so every port must be listed there
 * literally. Three of them, so a port already in use doesn't block sign-in; the
 * plugin binds the first that is free. All three must be in the allowlist:
 *
 *   http://127.0.0.1:42813
 *   http://127.0.0.1:42814
 *   http://127.0.0.1:42815
 */
const OAUTH_PORTS = [42813, 42814, 42815];

/** How long to wait on the browser before giving the port back. */
const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * The page the browser lands on after the provider redirects.
 *
 * Deliberately colorless: this renders in the user's browser, not in the app, so
 * the token layer in `index.css` does not reach it and a hex here would be a
 * hardcoded color with no token behind it. The plugin injects a script into
 * `<head>` that posts the full URL back, so the element must be present.
 */
const CALLBACK_PAGE =
  '<html><head><title>Bittersweet</title></head>' +
  '<body style="font-family:system-ui;text-align:center;padding-top:80px">' +
  '<h2>Signed in</h2><p>You can close this tab and return to Bittersweet.</p>' +
  '</body></html>';

/**
 * Start the OAuth flow. Resolves once a session exists (Tauri), or once the page
 * is on its way to the provider (browser).
 *
 * Throws on failure. A user who closes the browser tab instead of finishing is
 * not an error — it is a timeout, and reports as one.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<void> {
  if (!isTauri()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  const port = await start({ ports: OAUTH_PORTS, response: CALLBACK_PAGE });

  let unlisten: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    // Register the listener and arm the timeout BEFORE the browser opens.
    // `onUrl` resolves over IPC, so doing it afterwards leaves a window in which
    // a fast callback fires into nothing.
    let resolveCallback!: (url: string) => void;
    let rejectCallback!: (error: Error) => void;
    const callback = new Promise<string>((resolve, reject) => {
      resolveCallback = resolve;
      rejectCallback = reject;
    });

    unlisten = await onUrl(resolveCallback);
    timer = setTimeout(
      () => rejectCallback(new Error('Sign-in timed out. Please try again.')),
      CALLBACK_TIMEOUT_MS
    );

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `http://127.0.0.1:${port}`,
        // Keep the app where it is; the provider page belongs in the real browser.
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Supabase returned no authorization URL.');

    await openUrl(data.url);

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      readAuthCode(await callback)
    );
    if (exchangeError) throw exchangeError;
  } finally {
    if (timer) clearTimeout(timer);
    unlisten?.();
    // The server already stopped itself after the callback, so this throws on
    // the happy path. It only matters on the failure paths, where nothing else
    // frees the port.
    await cancel(port).catch(() => undefined);
  }
}

/**
 * Pull the authorization code out of the loopback URL.
 *
 * The port is open to anything local, so treat the URL as untrusted input: a
 * request that carries no code is discarded rather than passed to Supabase.
 */
function readAuthCode(callbackUrl: string): string {
  const params = new URL(callbackUrl).searchParams;

  const providerError = params.get('error_description') ?? params.get('error');
  if (providerError) throw new Error(providerError);

  const code = params.get('code');
  if (!code) throw new Error('Sign-in did not return an authorization code.');

  return code;
}
