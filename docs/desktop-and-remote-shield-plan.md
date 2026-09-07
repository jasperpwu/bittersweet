# Desktop App + Remote Shield Control — Design & Plan

**Status:** Phases 1 and 5 done and verified against the live project. Phases 2, 3 and 4
built, all pending their migrations being applied — and Phases 3/4 additionally pending an
APNs auth key. Phase 4 also needs a prebuild (new entitlement + new Swift file). Phase 0
was answered by documentation and the SDK rather than by a spike; see below.
**Date:** 2026-08-15 (Phase 1 landed and verified 2026-08-16; Phase 2 built 2026-08-16;
Phase 3 built 2026-08-20; Phase 4 built 2026-08-21)

> **Phase 1 as built.** `shared/` holds the session/tag row mappers plus the
> types, activity-type normaliser and note clamp they need; `src/` re-exports
> them so no call site changed. `desktop/` is a Vite + React client with email
> auth, tag list, session history and a Realtime subscription — no writes.
> Realtime needs `supabase/migrations/20260816_realtime_focus_sessions.sql`
> applied. Two deviations from the sketch below, both noted inline: the local
> `FocusSession`/`SessionTag` models now *extend* shared `*Core` types rather
> than the mappers staying `any`-typed, and desktop auth started email-only.

> **Menu bar, added later (2026-09-06).** The desktop client is now a menu bar
> app: no Dock icon, the running timer in the menu bar as `📚 24:59`, `⌘⇧B` to
> start or stop from anywhere, `⌘⇧M` to show or hide the window, and a close
> button that hides rather than quits. Four plugins came with it —
> `global-shortcut`, `single-instance`, `window-state`, `autostart`. Nothing in
> the schema or on iOS changed. `desktop/README.md` § Menu bar has the detail,
> including why the tray icon is built in Rust and why the window sets
> `backgroundThrottling: "disabled"`.

> **Auth parity, added later.** Apple and Google now sign in on the desktop too,
> through the web OAuth flow rather than the native token flow iOS uses. In the
> Tauri app the provider page opens in the user's real browser and a throwaway
> `127.0.0.1` server catches the redirect — Google rejects embedded webviews, so
> the app's own window is not an option. It needs dashboard configuration that is
> not in the repo (Supabase redirect allowlist, a Google redirect URI, and an
> Apple Services ID + signing key); `desktop/README.md` lists all four steps.

## Goal

Let a user start and stop a focus session from a desktop app, and have the iPhone
follow — timer, session record, and **app blocking** — including when the iOS app has
been swiped away in the app switcher.

Desktop scope is deliberately small:

1. Pick a tag
2. Start / stop a session
3. Near-realtime sync of focus sessions

Everything else (grove, goals, badges, rewards, journal, health) stays iOS-only.

---

## Part A — Desktop App

### Decision: standalone web app, not a port

Do **not** run this repo through `react-native-web`. The app is welded to iOS-only
natives (FamilyControls, ActivityKit, DeviceActivity, widgets) and `react-native-web`
isn't even a dependency. Porting the whole tree to serve three features is a bad trade.

Build a separate small client against the same Supabase project instead.

```
Vite + React + TypeScript
  @supabase/supabase-js        — same project, same RLS, same auth
  Tauri (phase 2)              — wraps it as a real .app / .exe
```

Tauri over Electron: it uses the OS webview instead of bundling Chromium, so the
artifact is ~600KB rather than ~150MB. The React code is identical either way — start
as a plain web app in the browser, add the Tauri shell once the logic is settled.

**Expo Web was considered and rejected.** Expo does target web (iOS / Android / web;
macOS is not an Expo platform — `react-native-macos` is out-of-tree with no prebuild or
config-plugin support), so "Expo desktop" would still mean Expo Web inside Tauri — the
same shell, plus a compat layer. Two things kill it here:

- `react-native-web` is not installed (only `react-dom`, `package.json:62`). Adopting it
  means the whole RNW layer plus Metro web bundling, to render a tag list, a timer, and
  a session list.
- The iOS-only native imports are not confined to leaf screens. `src/store/index.ts`,
  `app/_layout.tsx`, `src/store/slices/syncSlice.ts` and `groveSlice.ts` all pull in
  `WidgetService` / `react-native-device-activity` directly, so web support means
  platform-splitting the store and the root layout — permanently.

The one thing Expo Web would have bought — a single copy of the sync mappers — is
recovered by the `shared/` module below, without the compat layer.

### What it talks to

| Concern | Mechanism |
|---|---|
| Auth | Supabase Apple / Google / email — same providers as iOS |
| Tags | `SELECT` from `session_tags` |
| Sessions | `INSERT` / `UPDATE` on `focus_sessions` |
| Live updates | Supabase Realtime `postgres_changes` |

```ts
supabase.channel('sessions')
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'focus_sessions',
        filter: `user_id=eq.${uid}` },
      payload => applyRow(payload.new))
  .subscribe()
```

Requires adding `focus_sessions` (and `session_tags`) to the `supabase_realtime`
publication — one migration.

### Repository layout

The desktop client lives in this repo, as a sibling of the Expo app — not a separate
repo, not a workspace member.

```
bittersweet-ios/                     ← unchanged repo root, still the Expo project root
├── app/                             iOS screens (Expo Router)
├── src/                             iOS-only code
│   └── services/sync/SyncMapper.ts  thins to a re-export of shared/
├── shared/                          ★ NEW — pure TypeScript, ZERO dependencies
│   ├── types.ts                     FocusSession, SessionTag, ActivityType
│   ├── sessionRow.ts                sessionToRow / rowToSession
│   ├── tagRow.ts
│   └── README.md                    "no react-native, no expo, no vite imports — ever"
├── desktop/                         ★ NEW — Vite + React, its own node_modules
│   ├── package.json                 @supabase/supabase-js, react, vite
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/{main.tsx,supabase.ts,auth/,session/}
├── supabase/                        shared backend — migrations + edge functions
├── targets/ plugins/ patches/ ios/  iOS native, untouched
└── package.json                     the Expo app's — NOT a workspace root
```

**`shared/` deliberately has no `package.json`.** Making the root an npm workspace would
hoist `node_modules`, and this repo cannot absorb that: `postinstall` runs patch-package
against exact paths, and `metro.config.js:19-34` hand-resolves `@posthog/core` subpaths
off `require.resolve`. A dependency-free folder *inside* the Expo project root is already
in Metro's watch tree — **no `watchFolders`, no Metro config, no hoisting**. Vite reaches
it with `resolve.alias` plus `server.fs.allow: ['..']`.

Three edits this forces:

1. `clampSessionNotes` must move into `shared/` — it currently lives in
   `src/utils/textUtils.ts`, which imports `TextStyle` from `react-native` (line 1). Same
   for `normalizeActivityType` in `src/utils/focusRating.ts`. The RN-typed helpers stay
   behind in `src/utils/`.
2. Root `tsconfig.json` `include: ["**/*.ts"]` would swallow `desktop/` — add it to
   `exclude`, alongside the existing `supabase/functions/**`.
3. Same for the root `lint` script's `**/*.{js,jsx,ts,tsx}` glob.

`npx expo prebuild` is unaffected — `shared/` and `desktop/` are pure JS and invisible
to it.

### Shared code

Import, don't copy: the row mappers move from `src/services/sync/` into `shared/`, and
both clients import the same file. Both must agree on the wire shape of a session row,
and the existing CLAUDE.md convention — **`rowToX()` must restore every field `xToRow()`
writes** — is what protects that. With one copy, violating it is a compile error in both
projects rather than a silent desktop-side field drop.

The desktop client writes a **minimal** session row: tag, start, end, duration, source.
It must not attempt to compute fruits, badges, streaks, or ratings — those stay iOS-side
and are recomputed there. Desktop-created rows are inputs to that logic, not results of it.

### iOS must subscribe too

Today iOS is pull-based: cold start, foreground, and manual refresh. It does **not**
listen to Realtime. Add a `postgres_changes` subscription on the iOS side, live only
while the app is foregrounded, feeding the same apply path as `pullAndApply()`.

Critical: follow the existing rule in CLAUDE.md — any cloud-wins apply must call
`invalidateSyncSnapshot()` **before** applying, or the middleware will diff the rows we
just received against a stale baseline and re-enqueue them as local writes.

### Daily build flow

| Task | Command | Notes |
|---|---|---|
| Mobile | `npm run ios` / `npm start` | Unchanged |
| Desktop | `cd desktop && npm run dev` | Vite dev server, `localhost:5173` |
| Edit `shared/` | just save | Metro Fast Refresh *and* Vite HMR both pick it up — no build step, both bundlers compile TS directly |
| Typecheck | `npx tsc --noEmit` **and** `cd desktop && npx tsc --noEmit` | Both must pass |
| Package desktop | `cd desktop && npm run tauri build` | Phase 5 only |

The double typecheck is the drift guard, and the reason `shared/` is worth having: add a
field to `sessionToRow()` without the inverse in `rowToSession()`, and both compilers
fail on the same file. Run both in CI / pre-commit, not just the root one — the root
`tsconfig.json` excludes `desktop/`, so it will not catch desktop-side breakage on its own.

---

## Part B — Remote Shield Control

### The problem

Realtime websockets and silent pushes both die when the user swipes the app away. A
force-quit app gets no background runtime, and silent (`content-available`) pushes are
not delivered until the user manually relaunches. So "stop on desktop → apps unblock on
phone" cannot be done from the app process.

### Mechanisms evaluated

| Mechanism | Survives swipe-away | Needs notif. permission | Visible | Verdict |
|---|---|---|---|---|
| Silent push (`content-available`) | No | No | No | Covers everything *except* swipe-away |
| Notification Service Extension | Yes | **Yes** | Yes (banner) | Rejected — user has notifications off |
| Network Extension (VPN) | Yes | No | VPN profile in Settings | Rejected — heavy, conspicuous, extra Apple entitlement |
| PushKit VoIP | Yes | No | No | Rejected — CallKit reporting requirement, review risk |
| Location (Always) | Yes | No | Location indicator | Rejected — abusive |
| `DeviceActivityMonitor` network call | Yes | No | No | Rejected — 6MB cap, network reported as very unreliable |
| **WidgetKit push (iOS 26)** | **Yes** | **No** | **No** | **Chosen** |

### Chosen: WidgetKit push notifications

iOS 26 added push-triggered widget reloads. It is a **separate APNs push type**, not a
user notification:

```
apns-push-type: widgets
apns-topic:     com.path2us.bittersweet.push-type.widgets
```

Structurally parallel to `liveactivity` — its own token, its own topic, not gated on
`UNUserNotificationCenter` authorization, no banner, nothing in Notification Center. It
wakes the **widget extension**, which is a system-hosted process, so the container app
being swiped away is irrelevant.

Give that extension the `family-controls` entitlement and it can write
`ManagedSettingsStore` directly — shield and unshield with no app process at all.

### Why this fits our repo unusually well

`targets/HomeWidget/` is already most of the way there:

- `SupabaseClient.swift` — an authenticated Supabase REST client that already runs
  inside the widget/intent process
- `WidgetDataManager.swift` — already holds `supabaseUserId` + `supabaseAccessToken` in
  the app group
- `SessionIntent.swift` — already performs native session start/stop

The one real gap: `SessionIntent.swift:359` re-blocks via `WidgetActivityKit.reblockHandler?()`,
annotated *"main app process only"*. The widget extension currently **cannot** touch
`ManagedSettingsStore`, because it has no `family-controls` entitlement.

### Work items

> **Superseded by what Phase 4 actually built (2026-08-21).** Items 1 and 2 below assumed
> the widget would call Screen Time APIs. It does not — see Phase 0 in the phasing section.
> Item 1 became `aps-environment` (Push Notifications) instead of `family-controls`, and
> item 2 dissolved: there is no `ManagedSettingsStore` write to share, only a shield
> *configuration* write that `WidgetDataManager` already had. Items 3–5 shipped as written.

**1. Entitle the widget target** — *as built: Push Notifications, not Family Controls.*

`app.config.js` gives `ShieldConfiguration`, `ShieldAction`, and `ActivityMonitorExtension`
the `family-controls` + app-group block. `bittersweetmobileLiveActivity` is listed there
too but with app-groups only, and its generated `.entitlements` is written by
`expo-live-activity`, not by that array.

What Phase 4 adds is `aps-environment`, injected into the widget extension's entitlements
by `plugins/withHomeWidget.js` and copied from the main app's rather than hardcoded — the
two must agree, or half this feature's pushes go to the wrong APNs host. It is *not* given
`family-controls`: nothing in the widget calls a Screen Time API, and adding it would have
required a fresh per-bundle-ID Family Controls (Distribution) request from Apple.

The provisioning profile for the widget target still has to be regenerated, and the widget
extension's App ID needs the Push Notifications capability enabled.

**2. Move the shield write into shared code** — *not needed.*

There is no `ManagedSettingsStore` call to share. Blocking is persistent, so the tokens are
already applied; what a session boundary changes is the shield's configuration blob in the
app group, and `WidgetDataManager.setShieldForFocusMode()` /
`restoreShieldForNonFocusMode()` already write it from either target. `RemoteSessionSync`
just calls them.

The canonical blocklist key `"bittersweet-blocklist"` is untouched by this phase for the
same reason. The widget writes only the app-group half of the state; the app reconciles the
Zustand half (`currentSelectionId`, `blockedApps`, `WidgetService.syncCurrentSelectionId()`)
on next foreground, exactly as before.

**3. Widget push token plumbing**

Capture the WidgetKit push token, store it in Supabase next to the existing Live Activity
tokens (the fork already streams those — `ExpoLiveActivityModule.swift:184` for update
tokens, `:151` for push-to-start).

New table:

```sql
create table device_push_tokens (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('widget','liveactivity','pushtostart')),
  token       text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, kind, token)
);
-- RLS: auth.uid() = user_id, matching every other syncable table
```

**4. Edge function — and this one is not free. ✅ BUILT in Phase 3**

Every existing function pushes through **Expo Push Service** (`exp.host/--/api/v2/push/send`).
Expo does not support `apns-push-type: widgets` or `liveactivity`. This needs a **direct
APNs path**: an APNs auth key (`.p8`), ES256 JWT signing, and `POST` to
`api.push.apple.com`. That's new infrastructure, not a variation on `heartbeat-blocklist-notify`.

That path now exists as `supabase/functions/_shared/apns.ts` and is used by
`session-remote-control` for the `liveactivity` half. Phase 4 added the `widgets` half by
calling the same `sendApnsPush()` with a different push type — the auth key is team-wide
and topic-agnostic, so no new credential is needed. ✅ BUILT in Phase 4.

**5. Widget timeline provider** ✅ BUILT in Phase 4.

On reload: read `active_sessions` via the existing `SupabaseClient`, apply or clear the
shield configuration, write the new state into the app group, return a fresh timeline. The
providers await `RemoteSessionSync.refreshIfNeeded()` before reading session data, so the
entry reflects the session the push was announcing rather than the one before it.

Kept inside the widget memory budget: one row, one `URLSession` call, no JSON decoding
beyond `JSONSerialization` on a single object — extensions here are tight, and the
`DeviceActivityMonitor` 6MB experience is a warning about how little room there is.

### Known limits — design around them, don't fight them

- **Widget push is budgeted.** Apple delivers it "opportunistically" and explicitly
  positions it as an *addition* to timeline updates, not a replacement. This is
  near-realtime, not guaranteed-realtime.
- **iOS 26 only.** Below that the mechanism does not exist.
- **`ManagedSettingsStore.clearAllSettings()` is a long-standing flake.** Remove specific
  tokens rather than clearing wholesale.
- **Keep `DeviceActivitySchedule` as the enforcement floor.** If a session has a known
  end time, schedule it. Then a dropped push degrades to "unblocks at the scheduled time"
  instead of "stays blocked forever" — which is the only failure mode that actually hurts
  the user.

---

## Phasing

**Phase 0 — Spike. ✅ ANSWERED 2026-08-21, without needing the spike.** Both assumptions
were settled from Apple's documentation and the installed iOS 26.5 SDK, and question 2
turned out to be the wrong question.

1. *Does WidgetKit push arrive with notification permission denied?* **Yes.** Apple's own
   page is explicit: "you can't use the User Notifications framework to register your
   widget for push notifications. Instead, you use WidgetKit to obtain a push token."
   The token comes from `WidgetPushHandler.pushTokenDidChange`, never from
   `registerForRemoteNotifications`, and nothing in the path consults
   `UNUserNotificationCenter` authorization. What it *does* need is the **Push
   Notifications capability on the widget extension target** — an `aps-environment`
   entitlement of its own; the app's does not cover it.
2. *Can a widget extension with `family-controls` write `ManagedSettingsStore`?*
   **Moot — nothing needs to.** Blocking in this app is persistent, not per-session:
   `react-native-device-activity` keeps a saved blocklist and leaves the
   `ManagedSettingsStore` tokens applied whether or not a session is running
   (`updateBlockInternal`, its `Shared.swift`). What actually changes at a session
   boundary is the shield's **configuration** — title, subtitle, and whether the primary
   button offers "Unlock App" or merely closes — and that is a plain UserDefaults blob in
   the app group, read by the already-entitled `ShieldConfiguration` extension when it
   draws the shield. Writing it calls no Screen Time API at all.

   That removes the riskiest unknown in the plan *and* a shipping blocker nobody had
   costed: Apple grants Family Controls **per bundle ID**, and "if your app includes a
   Screen Time API app extension, submit the same request for the extension"
   (*Configuring Family Controls*). Entitling the widget target would have meant a fresh
   Family Controls (Distribution) request for
   `com.path2us.bittersweet.bittersweetmobileLiveActivity` and a wait on Apple before the
   next release could ship. Phase 4 as built needs neither.

The API shape was read out of `WidgetKit.swiftinterface` in the iOS 26.5 SDK rather than
from forum threads, per the house rule: `WidgetPushInfo { let token: Data }`,
`protocol WidgetPushHandler { init(); func pushTokenDidChange(_:widgets:) }`, and
`WidgetConfiguration.pushHandler(_:)`, all `@available(iOS 26.0, *)`.

**Phase 1 — Desktop, read-only. ✅ DONE (2026-08-16).** Extract `shared/` (types + row
mappers, plus the two util functions that have to move out of RN-importing files),
scaffold `desktop/`, then auth, tag list, session history, Realtime subscription. No
writes. Proves auth + RLS + realtime end to end.

*Verified 2026-08-16:* signed in from the desktop client, tags and history render, and
`20260816_realtime_focus_sessions.sql` is applied — a session created on the phone
appears on the desktop live, and deleting it there removes it (the soft-delete-as-UPDATE
path). Realtime is confirmed working end to end, not just `SUBSCRIBED`.

One bug found and fixed during that pass: `App.tsx` gated the session list on the
sessions query alone while ignoring the `loading` flag `useTags` returns. The two fetch
in parallel, so whenever sessions won the race the list rendered against an empty tag
array and every row showed "Untitled" until the tags query landed. Anything that
resolves a session's tag by id has to wait for both.

**Phase 2 — Desktop writes + iOS realtime. ✅ BUILT 2026-08-16, not yet verified against
the live project.** Start/stop from desktop; iOS subscribes while foregrounded.

`focus_sessions.end_time` is NOT NULL, so a *running* session cannot live there. It gets
its own table, `active_sessions`, keyed by `user_id` — one live session per user is a key
constraint rather than client merge logic, which is what answers "both devices started at
once" from the open questions below. `session_id` is chosen at start and carried on the
row, so whichever device finishes the session writes the same `focus_sessions` row; this
reuses the caller-supplied-id seam `createCompletedSession` already had for native widget
stops.

Writes go through `start_active_session` / `stop_active_session` RPCs, because PostgREST
cannot express a conditional upsert and a plain one would clobber a session running on the
other device. Stop sets `ended_at` rather than deleting: a DELETE reaches Realtime carrying
only the primary key, and a subscriber that misses a stop is left running a timer forever.

`active_sessions` is deliberately outside the sync pipeline. That pipeline is a debounced,
offline-tolerant, last-write-wins differ; a live session is a single mutable row whose only
value is being current, and replaying one from an offline queue would resurrect a finished
session.

On iOS the follower reuses the Journal TODO autostart machinery (prime tag + duration, bump
a nonce, fire the normal handler), so there is still exactly one code path that starts a
session — with the shield, Live Activity, scheduled notification and widget state all
identical to an in-app start. A desktop stop follows the widget-stop precedent: record the
session, then rate from historical Core Motion, and do not open the summary modal.

*Known limits, by design:* there is no toast when the phone follows a remote stop; adding
user-facing copy means the full 8-language i18n pass.

*Amended 2026-08-23 — the follower adopts the desktop's start time.* It first ignored any
start older than 60s, because `startTimer` always began the timer at `Date.now()`; a phone
that opened mid-session therefore restarted the countdown from zero and the two devices
disagreed for the rest of the session. `startTimer` now takes the published `startedAt`
off `pendingRemoteStartRef` and derives every time from it — the Live Activity end date,
the completion notification's interval, the persisted `active-focus-session` blob, and the
widget's session state. A session already past its target resumes in bonus time, which is
the same state the app restores into after a kill. The age cap stays, raised to the eight
hours `hasRunningDesktopSession` already uses, and now means only "this row outlived the
session it describes" rather than "we cannot represent this honestly".

That also removes a small pre-existing drift on locally-started sessions: the persisted
`startTime` used to be read *after* the `await` on the Live Activity start, so it sat a few
tens of milliseconds ahead of `sessionStartTimeRef`. Both now come from one value.

**Phase 3 — Live Activity push. ✅ BUILT 2026-08-20, not yet verified against the live
project.** Timer follows on Lock Screen / Dynamic Island even when the app is closed.

What ships: `device_push_tokens` (migration `20260820_device_push_tokens.sql`),
`LiveActivityPushService` on iOS, `_shared/apns.ts` + `_shared/liveActivityCopy.ts`, the
`session-remote-control` function, and a `functions.invoke` after each desktop start/stop.

*This phase mirrors a timer, not a session.* No shield, no `focus_sessions` row, no
fruits on the phone — the desktop still writes the finished row for a session it started
while the phone was closed, exactly as in Phase 2. Blocking apps remotely is Phase 4.

**Two tokens, and the difference is the whole design.** `pushToStartTokenUpdates` is
per-install, exists whether or not an activity is running, and is the only way to make a
Live Activity appear on a phone whose app is force-quit. `activity.pushTokenUpdates` is
per-*activity* and is the only way to update or end that one activity. So a start prefers
the **update** token — the app keeps an idle "Start" card alive whenever the user has
picked a tag, and turning that card into a running timer costs no banner and no new
activity — and falls back to **push-to-start** only when there is no live activity to
reuse. A stop always needs the update token; there is nothing to end without it.

**Apple mandates an `alert` on push-to-start** ("Include an alert in the JSON payload").
There is no quiet variant, so a remotely-started session on a closed phone shows a banner.
The copy is localized in `_shared/liveActivityCopy.ts` (all 13 languages) and sent without
a `sound`. The update path — the common one — has no alert at all.

**Why the copy lives server-side.** A pushed Live Activity renders text the *server* sent:
the phone's JS isn't running to call `i18n.t()`, so the four native button/status labels
`laLabels()` normally supplies have to travel in the payload. `_shared/liveActivityCopy.ts`
is a **copy of `liveActivity.*` from `src/i18n/locales/*.json`, not a re-translation** —
the same SwiftUI view renders both, and they must not diverge depending on whether the
session started on the phone or the laptop. It carries a regeneration one-liner.

**The stop push reproduces `endAllFocusActivitiesWithState`**: `event: "end"` with the idle
card as final content and no `dismissal-date`, which is ActivityKit's `.default` policy —
out of the Dynamic Island immediately, Lock Screen banner for up to four hours. That is the
behaviour the app already settled on, so a remote finish looks like a local one.

*Known limits, by design:*

- **The update token can only be captured while the app has a JS runtime.** A push-to-start
  wakes the app in the background specifically to hand it over ("the system wakes your app
  and you'll receive new push tokens to use for updates"), and `LiveActivityPushService.start()`
  is the first statement of the root layout's init effect for that reason. If the event
  still lands before the bundle runs, that session cannot be ended remotely — it goes stale
  at its `stale-date` and ActivityKit ends it at the eight-hour mark. The fix, if this bites
  in practice, is a native getter on the fork (`Activity.activities.compactMap { $0.pushToken }`)
  polled on foreground; deliberately not built yet because it costs a prebuild.
- **An update token is trusted for eight hours.** Past that, ActivityKit has ended the
  activity on its own, and pushing at it fails *silently* — "the system ignores an
  ActivityKit push notification if it arrives after the Live Activity ended", so APNs still
  answers 200 and nothing signals a fallback. The app deletes the row when it sees the
  activity end; the age check is the backstop for when it wasn't running to notice.
- **The APNs environment is probed, not configured.** The fork's plugin hardcodes
  `aps-environment: development`, so a locally-installed build yields sandbox tokens while
  TestFlight/App Store yields production ones — and both hit the same function. It tries
  production, then sandbox on `BadDeviceToken`. Set `APNS_ENV` to skip the probe.
- **`bundle_id` is stored per token** rather than configured, because the topic must match
  the app that owns the token and this project ships `com.path2us.bittersweet` and `.dev`.
- **`color_scheme` is stored per token** because a Live Activity's colors live in its
  `ActivityAttributes`, fixed at creation. When the *server* creates the activity it has to
  be told which palette to use, and `user_settings.theme` can't answer — its usual value is
  `system`, which resolves on the device.
- ~~**The Live Activity's End button still stops nothing remotely.**~~ **Fixed in Phase 4.**
  On a push-started card `StopSessionIntent` runs against a phone with no local session; its
  Supabase write is guarded on `active.isActive`, so it never invented a row, but it also
  never called `stop_active_session`. It now does, unconditionally and outside that guard.
  This needed no entitlement in the end — `StopSessionIntent` is a `LiveActivityIntent`, so
  the system runs `perform()` in the *main app* process, which has had a working Supabase
  client all along.
- **The Phase 2 follower had to be made foreground-only for real.** It was written as
  foreground-only, but nothing enforced it: the socket outlives the app's transition to
  background by a moment, and a push-to-start wake mounts the Focus screen with no UI,
  where its mount-time `ActiveSessionService.fetch()` applied whatever it found. Following
  a start there throws `Target is not foreground` — ActivityKit only lets the *app* call
  `Activity.request` in the foreground — after the shield and the scheduled notification
  have already been set up for a session the user can't see. The apply path now returns
  early on a start when `AppState.currentState !== 'active'`; the foreground refetch
  re-applies it if it is still inside the 60s window, and the pushed Live Activity is
  mirroring the timer meanwhile, which is the whole point of this phase. Stops are
  unaffected — ending an activity needs no foreground.
- ~~**The shield is not remote-controllable, and the gap is visible.**~~ **Closed by
  Phase 4**, which is exactly the case described in the last two sentences of this bullet.
  Kept here because the app-side reconciliation it describes is still what runs on
  foreground, and is still the fallback whenever a widget push is not delivered (no widget
  installed, iOS 25, or simply budgeted away). Blocked apps stay
  blocked during a desktop session — blocking here is persistent, not per-session — but the
  shield's copy and actions are a UserDefaults blob only the app (or the widget's native
  start/stop intents) writes, and its default variant offers "unlock for N fruits". So a
  session started from the laptop can be bought out of from the phone. The app now holds the
  shield in focus mode whenever it can see the desktop row — `syncShieldConfiguration` on
  mount/foreground, and the follower on live events — which covers a backgrounded app and a
  push-to-start background wake. It cannot cover the case this phase was built for: a start
  that reuses the **update** token never wakes the app, so no JS runs and the shield keeps
  its idle copy until the next launch. Closing that needs code running on-device at push
  time, which is Phase 4. Corollary in the other direction: a session that ends while the
  app is closed leaves the shield in focus mode (no unlock button) until the next
  foreground — the same staleness a local session already has, and why the app-side check is
  bounded to eight hours.
- **The LA subtitle stays English** (`"25m focus session"`), matching what the app itself
  renders today. Localizing it is a separate fix and has to change both sides at once, or
  the card's wording would depend on which device started the session.

*Before this can be verified:* apply `20260820_device_push_tokens.sql`, create an APNs auth
key (Certificates, Identifiers & Profiles → Keys → enable APNs; the `.p8` downloads once,
and a key is team-wide so an existing one works if you still have the file), then:

```
supabase secrets set APNS_KEY_ID=XXXXXXXXXX APNS_TEAM_ID=YYYYYYYYYY APNS_ENV=auto
supabase secrets set APNS_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
supabase functions deploy session-remote-control
```

**Phase 4 — Widget push + remote shield. ✅ BUILT 2026-08-21, not yet verified against the
live project.** The swipe-away case: a session started or stopped on the desktop now moves
the *shield* on a phone whose app has been swiped away, with no notification permission and
no banner.

What ships: `targets/HomeWidget/RemoteSessionSync.swift` (the push handler and the apply
logic), `aps-environment` on the widget extension via `plugins/withHomeWidget.js`,
`SupabaseClient.fetchActiveSession/stopActiveSession/upsertWidgetPushToken`,
`src/services/WidgetPushService.ts`, and the `widgets` half of `session-remote-control`.
No new migration — `device_push_tokens` already allows `kind = 'widget'`.

**The push carries no command.** A WidgetKit push is only ever
`{"aps":{"content-changed":true}}`; it wakes the extension and reloads its timelines, and
the timeline provider then reads `active_sessions` itself. That indirection is deliberate
rather than a limitation of the payload: these pushes are explicitly opportunistic and
budgeted, so one can arrive late — and a phone that applies *what is true when it wakes*
cannot act on a stale command the way one replaying a payload would.

**Only `origin == 'desktop'` rows are ever acted on**, matching `hasRunningDesktopSession()`
in `_layout.tsx`, and the apply path can only undo state it wrote itself. The marker it
leaves (`widgetRemoteSessionId`) stores the mirrored session's **start time** alongside its
id, because the id alone proves only that the widget once wrote a session — not that the
session still on screen is that one. JS writes the same `widgetSessionData` key when the
user starts a session on the phone, and a marker that couldn't tell the two apart would let
a desktop stop clear a local session out from under the user.

**The Live Activity's End button now works on a push-started card.** `StopSessionIntent`
calls `stop_active_session` unconditionally — outside the `active.isActive` guard, because
on a card the desktop pushed there *is* no local session and everything else in that intent
is correctly skipped. The RPC no-ops when nothing is running, so a local stop just makes one
redundant call. This also closes a pre-existing gap: a widget-stopped session used to leave
its `active_sessions` row open.

*Known limits, by design:*

- **A Focus widget on the Home Screen is the *quiet* path, not the only path.** WidgetKit
  issues a push token in relation to the widgets a person has actually configured, and
  `.pushHandler` is declared per widget — only widgets carrying it are reloaded by a push.
  Both focus widgets carry it; the Goal and Todo widgets do not, since neither renders
  session state.

  Without a widget, a **start** falls back to push-to-start (added 2026-08-22). That is the
  only other push that gets our code running on a closed phone: iOS wakes the whole app to
  hand over the new activity's update token, and the woken app runs
  `syncShieldConfiguration('mount')`, which sees the desktop row and flips the shield
  itself. Phase 3 already depended on this wake; Phase 4 just stops the update-token
  optimization from preempting it when the shield still needs moving.

  The cost is a banner — Apple mandates an `alert` on push-to-start and there is no quiet
  variant. So the real trade is **widget installed → silent** vs. **no widget → banner**,
  not widget vs. nothing. Because push-to-start always creates a *new* activity, the
  fallback first ends any idle "Start" card with a past `dismissal-date`, or the phone
  would show two.

  A remote **stop** has no equivalent: ending an activity by update token wakes nothing, so
  a widget-less phone keeps the focus-mode shield until next foreground. That is the safe
  direction to fail — enforced slightly too long rather than not at all — and
  `syncShieldConfiguration` clears it on open.

  Which path ran is visible in the function's JSON: `via`, plus `toWakeAppForShield: true`
  when push-to-start was chosen deliberately rather than as a last resort after a dead
  update token.
- **Removing the pre-iOS-17 medium-widget fallback was forced, not opportunistic.**
  `some WidgetConfiguration` unifies its branches through availability erasure (SE-0360),
  which permits exactly **one** `#available` alternative — a second fails with "return
  statements do not have matching underlying types". Adding an iOS 26 branch therefore
  meant dropping the iOS 17 one. It was already dead code: `withHomeWidget.js` pins this
  extension's deployment target to iOS 18. The same rule is why both branches need an
  explicit `return`; without it the erasure does not kick in and the branches fail to
  unify. `MediumWidgetStaticProvider` went with it.
- **Priority 5, not 10.** Apple documents no priority rule for `apns-push-type: widgets`,
  but it is a non-alerting wake in the same family as `background`, where 10 is rejected
  outright — and delivery is opportunistic regardless, so 10 would buy nothing even if
  accepted. If APNs answers `BadPriority`, this is the line to look at.
- **The token is uploaded twice, on purpose.** `WidgetPushService` (JS) is the reliable
  path — it knows who is signed in, and can re-file a token left under a previous account.
  `FocusWidgetPushHandler` also POSTs directly, because it is the only path that works on
  the phone this feature exists for: one whose app is never reopened after the token
  changes. That copy is a fire-and-forget request from a process the system may suspend
  mid-flight, which is exactly why it is not the only one.
- **The widget writes the app-group half only.** It deliberately does *not* call
  `writeWidgetStartedSession` — that marker is the JS adoption seam and would make the app
  record a `focus_sessions` row for a session the desktop already owns and writes itself
  (Phase 2). The Zustand half is reconciled by `syncShieldConfiguration` on next
  foreground, as Phase 3 already arranged.
- **A dropped push self-heals within 15 minutes.** Because the reconcile hangs off the
  timeline provider rather than off the push, the widget's ordinary
  `.after(15 minutes)` refresh policy re-runs it. Push is the fast path, not the only
  path — which matters given Apple budgets these and delivers them opportunistically.
- **The `active_sessions` read costs a request on ordinary timeline reloads too**, since a
  push is indistinguishable from any other reload. It is one row, throttled to at most one
  request per five seconds across all widget kinds (a push reloads every kind at once), and
  short-circuits before the network when no user is signed in.
- **The unlock tap itself is now checked against the cloud** (added 2026-08-23). Whenever a
  widget push is not delivered, the shield keeps its idle copy — including the "unlock for N
  fruits" button — until the app next opens. `checkShieldOpening` in `app/_layout.tsx` used
  to answer that tap from local state alone (`active-focus-session` in AsyncStorage, plus a
  widget-started session in UserDefaults), neither of which knows about a session the desktop
  started while the app was closed, so the sheet opened and the session could be bought out
  of. It now falls through to `hasRunningDesktopSession()` when both local reads come back
  empty, and answers a live session with a bottom toast (`home.sessionAlreadyRunning`)
  instead of the silent `return` it used before — that silence made the shield's own button
  look broken. The extra request costs nothing on the common path: it runs only on a tap that
  found no local session.

  This also raised the function's own gate to the full `isReady` triple. Both answers it can
  give render inside that branch of the tree, and the shield's marker is consumed on read, so
  a tap answered before the branch mounts was answered into nothing. The AppState effect
  gained `mainStoreHydrated` as a dependency for the same reason — its handler closes over
  the value it subscribed with.

**Phase 5 — Tauri wrap. ✅ DONE (2026-08-16), out of order.** Pulled forward because
running the client in a browser tab isn't what "desktop app" means. `desktop/src-tauri/`,
`npm run app` (dev window with HMR) and `npm run app:build` (`.app` + `.dmg`).

One trap worth recording: **Tauri needs rustc ≥ 1.88, not the 1.77.2 its own
`rust-version` advertises.** That field covers the `tauri` crate alone; the transitive
tree (`icu_*`, `plist`, `time`, `serde_with`) wants 1.88, and cargo only says so after
resolving. Checking Tauri's MSRV alone gives a false green light.

A real CSP is set in `tauri.conf.json` (the scaffold ships `csp: null`), with a separate
`devCsp` allowing the Vite HMR websocket. Both allow `https://*.supabase.co` and
`wss://*.supabase.co` — the wss entry is what Realtime needs.

Phases 1–3 are useful on their own and carry no native risk — Phase 3 touches no Swift and
needs no prebuild, only a migration, a secret and a function deploy.

**Phase 4 is the one that needs a prebuild**, because it adds an entitlement and a new
Swift file to the widget extension. Both target file sets were type-checked against the
iOS 26.5 SDK before landing (`swiftc -typecheck` over `widgetExtensionFiles` and over
`mainAppFiles`), which is what caught the SE-0360 branch-unification failure described
above — but a clean type-check is not a build, and none of this has run on a device.

*Before Phase 4 can be verified:* everything Phase 3 lists (the `device_push_tokens`
migration, the APNs auth key, the secrets, the function deploy), plus:

```
APP_VARIANT=development npx expo prebuild     # new entitlement + RemoteSessionSync.swift
supabase functions deploy session-remote-control
```

Then enable the Push Notifications capability on the widget extension's App ID and
regenerate its provisioning profile. Test both paths, since they are different code:

1. **With** a Bittersweet Focus widget on the Home Screen — start from the desktop with the
   iOS app swiped away. Expect no banner; a blocked app's shield should read "Focus session
   in progress" with no unlock button. Response: `widget.sent: true`, `via: "update"`.
2. **Without** any Bittersweet widget installed — same test. Expect a banner, the idle card
   replaced by a running timer, and the same shield change. Response:
   `widget.skipped: "no widget token"`, `via: "push-to-start"`,
   `toWakeAppForShield: true`.

## Open questions

- ~~Should a desktop-started session block apps on the phone by default?~~ **Settled in
  Phase 2: yes**, identical to an in-app start. The follower runs the same start path, so
  the shield update comes for free rather than needing a no-shield variant. Revisit as a
  setting if it proves surprising in use.
- ~~What wins if both devices have an active session?~~ **Settled in Phase 2:** rejected
  server-side, by making `active_sessions.user_id` the primary key and starting through an
  RPC whose upsert branch only fires when the previous session has ended. The phone is the
  one exception — it does not roll its local timer back on a refusal, because the user
  physically pressed start and losing that to a stale row is the worse failure.
- Does the desktop session count toward fruits/streaks? Leaning yes, computed on iOS at
  reconcile so there is exactly one implementation of the reward curve.

## References

- [Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/ActivityKit/starting-and-updating-live-activities-with-activitykit-push-notifications)
  — payload shape, the mandatory `alert` on `start`, and the background wake that delivers
  the update token
- [Establishing a token-based connection to APNs](https://developer.apple.com/documentation/UserNotifications/establishing-a-token-based-connection-to-apns)
  — the ES256 provider JWT in `_shared/apns.ts`
- [WWDC25 — What's new in widgets](https://developer.apple.com/videos/play/wwdc2025/278/)
  ([notes](https://wwdcnotes.com/documentation/wwdc25-278-whats-new-in-widgets/)) — push type + budgeting
- [Updating widgets with WidgetKit push notifications](https://developer.apple.com/documentation/WidgetKit/Updating-widgets-with-widgetkit-push-notifications)
- [Force-quit apps are denied background runtime](https://developer.apple.com/forums/thread/808088)
- [Network Extension lifecycle is independent of the container app](https://developer.apple.com/forums/thread/701976)
- [`family-controls` must be applied per target](https://developer.apple.com/forums/thread/682813)
- [`clearAllSettings()` unreliability](https://developer.apple.com/forums/thread/744157)
- [DeviceActivityMonitor network requests are unreliable](https://developer.apple.com/forums/thread/724649)
