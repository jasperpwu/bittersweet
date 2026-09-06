# Bittersweet desktop

A small standalone client against the **same Supabase project** as the iOS app.
Not a port of the Expo app — see `docs/desktop-and-remote-shield-plan.md` for why
`react-native-web` / Expo Web was rejected.

Scope is deliberately three things: pick a tag, start/stop a session, and see
sessions sync. Grove, goals, badges, rewards, journal and health stay iOS-only.

## Status: Phase 1 — read-only

Done: auth, tag list, session history, Realtime subscription. **No writes yet.**
Phase 2 adds start/stop.

## Setup

```bash
cd desktop
npm install
cp .env.example .env.local     # fill in from the repo-root .env
```

Then either:

| | Command | What you get |
|---|---|---|
| Browser | `npm run dev` | `localhost:5173`, fastest iteration |
| **Desktop app** | `npm run app` | A real macOS window, Vite HMR still live |
| Package it | `npm run app:build` | `Bittersweet.app` (~10MB) in `src-tauri/target/release/bundle/macos/` |
| Distributable | `npm run app:dmg` | Also builds the `.dmg` — see the caveat below |

`npm run app` starts the Vite dev server itself (`beforeDevCommand` in
`src-tauri/tauri.conf.json`) — don't run `npm run dev` alongside it or the two
fight over port 5173.

### Requirements for the desktop app

Rust and the Xcode command line tools.

**Rust must be ≥ 1.88, not 1.77.2.** Tauri's own `rust-version` says 1.77.2, but
that is the floor for the `tauri` crate alone — its transitive tree (`icu_*`,
`plist`, `time`, `serde_with`) requires 1.88, and cargo only tells you *after* it
resolves. If a build dies with a wall of `... requires rustc 1.88`, that's this,
and the fix is upgrading the toolchain (`brew upgrade rust`), not touching Tauri.

The first `npm run app` compiles ~400 crates and takes a few minutes; every build
after that is incremental and fast.

Tauri uses the OS webview (WKWebView) instead of bundling Chromium, so the
artifact is a few MB rather than ~150MB. That's the whole reason it's Tauri and
not Electron — the React code is identical either way.

### Why `.dmg` is a separate script

`bundle.targets` is `["app"]`, not `["app", "dmg"]`, because Tauri's
`bundle_dmg.sh` runs an AppleScript to style the disk image's Finder window
(line ~502). That needs a GUI session with Automation permission, and fails with
an opaque `error running bundle_dmg.sh` without one. The `.app` is unaffected —
it had already been built when the DMG step failed.

Use `npm run app:dmg` from a normal interactive Terminal when you actually need a
distributable. If it fails there too, grant Terminal permission under System
Settings → Privacy & Security → Automation.

### Unsigned builds

Both scripts produce an **unsigned** `.app`. It runs fine on the machine that
built it. Distributing it to anyone else needs an Apple Developer ID certificate
and notarization — the same account the iOS app ships under, but a *different*
certificate type ("Developer ID Application", not "Apple Distribution").

### A green build is not a working build

`vite.config.ts` hard-fails when `VITE_SUPABASE_URL` /
`VITE_SUPABASE_PUBLISHABLE_KEY` are missing. That check exists because of a real
trap: Vite inlines `import.meta.env.VITE_*` as literals, so with them unset the
guard in `src/supabase.ts` folds to an unconditional `throw`, Rollup treats the
`createClient` call below it as unreachable, and **all of @supabase/supabase-js
gets tree-shaken out**. The build reports success and emits a bundle about half
the normal size that cannot reach the network.

Sanity check if you ever suspect it: a correct bundle is ~405 kB and contains
`RealtimeClient`.

```bash
grep -c RealtimeClient dist/assets/index-*.js   # should be ≥ 1
```

## Sign-in

Apple, Google and email — the same three the iOS sheet offers.

iOS signs in *natively*: the OS hands back an identity token and the app calls
`signInWithIdToken`. A webview has no such API, so this client uses the **web
OAuth flow** instead. The two environments differ only in how the redirect gets
back:

| | Flow |
|---|---|
| `npm run dev` (browser) | Plain redirect to `window.location.origin`. `detectSessionInUrl` exchanges the code. |
| `npm run app` (Tauri) | The provider page opens in the user's **real browser**, and a throwaway `127.0.0.1` server catches the redirect. |

The Tauri path cannot use the app's own window: Google refuses to authenticate
anyone from an embedded webview (`disallowed_useragent`), so the flow dead-ends
there. `tauri-plugin-oauth` provides the loopback server, `tauri-plugin-opener`
hands the URL to the browser, and PKCE keeps the loopback safe — the code
verifier never leaves this client, so the intercepted code alone is worthless.

The opener permission in `src-tauri/capabilities/default.json` is scoped to the
Supabase authorize endpoint alone, **not** `opener:default` (which would allow
any http(s) URL). A custom auth domain later means editing that scope.

### Configuration, and the one thing that expires

All of it lives in the Apple, Google and Supabase dashboards — none of it is in
this repo. It is done. Only the Apple secret has an expiry date.

#### The Apple secret expires every 6 months

Apple issues no permanent client secret. The value Supabase holds is a JWT signed
with a `.p8` private key, and Apple caps its lifetime at six months. When it
lapses, desktop Apple sign-in stops on its own — no deploy, no code change. iOS
keeps working, because the native `signInWithIdToken` flow never uses this secret.

To rotate it:

1. Open https://supabase.com/docs/guides/auth/social-login/auth-apple in Chrome
   or Firefox — the generator does not render in Safari — and pick the **Web**
   tab, *Configuration* section. There is no heading named "generate a client
   secret"; the tool sits inline under that section.
2. Fill in Team ID, Services ID, Key ID, and the contents of the
   `AuthKey_XXXXXXXXXX.p8` file. Nothing leaves the browser.
3. Paste the JWT it prints into Dashboard → Authentication → Providers → Apple →
   **Secret Key**.

Keep the `.p8` file. Apple allows exactly one download, and every rotation needs
it again. If it is lost: Apple Developer → Keys → **+**, tick Sign in with Apple,
configure against the primary App ID `com.path2us.bittersweet`, then use the new
Key ID. A signing key attaches to the App ID, never to the Services ID — the
Services ID is grouped under the same App ID, so one key covers both.

#### Where the rest of it lives

Nothing below needs attention unless something changes on our side.

| What | Where | Why it matters |
|---|---|---|
| The four redirect URLs | Supabase → Authentication → URL Configuration → Redirect URLs | Change `OAUTH_PORTS` in `src/auth/oauth.ts` and the new port must be added here. Supabase's glob matcher cannot wildcard a port, so each URL is listed literally. |
| Supabase callback URL | Google Cloud → Credentials → the **Web** client → Authorized redirect URIs | `https://wpcyvjpntzgfpwbzprkp.supabase.co/auth/v1/callback`. iOS never needed it; `signInWithIdToken` redirects nowhere. |
| Google Client ID **and Secret** | Supabase → Authentication → Providers → Google | The redirect flow exchanges the code server-side. An empty secret field answers sign-in with `Unsupported provider: missing OAuth secret`. |
| Apple Services ID, listed **first** | Supabase → Authentication → Providers → Apple → Client IDs | Supabase sends the first entry as the web `client_id`. A bundle ID in that position lands the user on Apple's `Invalid client id or web redirect url` page. The native bundle IDs stay after it. |
| Services ID domain + return URL | Apple Developer → Identifiers → Services IDs → Sign in with Apple → Configure | Domain is the bare host `wpcyvjpntzgfpwbzprkp.supabase.co`; the return URL is the full callback above. The dialog's own Save is not enough — the identifier page must be saved too. |

The redirect allowlist, in full:

```
http://127.0.0.1:42813
http://127.0.0.1:42814
http://127.0.0.1:42815
http://localhost:5173
```

The three loopback ports are `OAUTH_PORTS`; the plugin binds the first that is
free, so all three belong in the list. The last one is the Vite dev server, for
the browser path.

## Realtime

**Realtime needs a migration.** `supabase/migrations/20260816_realtime_focus_sessions.sql`
adds `focus_sessions` and `session_tags` to the `supabase_realtime` publication.
Until it's applied the channel connects and simply never fires — the dot in the
header goes green either way, because "subscribed" and "publishing" are different
things. If sessions don't appear live, check the migration first.

## `shared/`

The row mappers are not copied here — they are imported from `../shared`, which
the Expo app imports too. Both bundlers compile that folder from source; there is
no build step.

```
import { rowToSession } from 'shared/sessionRow';
```

Resolved twice, and both are required: `resolve.alias` in `vite.config.ts` (bundle
time) and `paths` in `tsconfig.json` (typecheck time). Neither reads the other's
config.

## The drift guard

```bash
npx tsc --noEmit                  # from the repo root — the Expo app
cd desktop && npx tsc --noEmit    # this project
```

Run **both**. The root `tsconfig.json` excludes `desktop/`, so it cannot catch
breakage here on its own. Adding a field to `sessionToRow` without the inverse in
`rowToSession` fails both, on the same file — that is the whole point of `shared/`.

## What this client must never do

Write anything derived. Fruits, badges, streaks, ratings and the reward curve are
computed on iOS, and a desktop-written session row is an *input* to that logic,
not a result of it. A session row from here carries tag, start, end and duration —
nothing else.

## Colors

There is no NativeWind here, so the project's "never hardcode colors" rule is
honoured with CSS custom properties in `src/index.css`: hex values appear once, at
the top, mirrored from `src/config/theme.ts`. Change one, change both.
