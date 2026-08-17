# Desktop App + Remote Shield Control — Design & Plan

**Status:** Phases 1 and 5 done and verified against the live project. Phase 2 built,
pending its migration being applied. Phases 0, 3–4 not started.
**Date:** 2026-08-15 (Phase 1 landed and verified 2026-08-16; Phase 2 built 2026-08-16)

> **Phase 1 as built.** `shared/` holds the session/tag row mappers plus the
> types, activity-type normaliser and note clamp they need; `src/` re-exports
> them so no call site changed. `desktop/` is a Vite + React client with email
> auth, tag list, session history and a Realtime subscription — no writes.
> Realtime needs `supabase/migrations/20260816_realtime_focus_sessions.sql`
> applied. Two deviations from the sketch below, both noted inline: the local
> `FocusSession`/`SessionTag` models now *extend* shared `*Core` types rather
> than the mappers staying `any`-typed, and desktop auth is email-only for now
> because Apple/Google need a browser redirect URL allowlisted first.

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

**1. Entitle the widget target**

`app.config.js:123-145` gives `ShieldConfiguration`, `ShieldAction`, and
`ActivityMonitorExtension` this block:

```js
entitlements: {
  'com.apple.developer.family-controls': true,
  'com.apple.security.application-groups': [APP_GROUP],
},
```

`HomeWidget` is built by `plugins/withHomeWidget.js`, not by that array, so it never got
one. Add the same entitlements there. Family Controls (Distribution) is already approved
for this app ID, so no new Apple request — but the provisioning profile for the widget
target has to be regenerated.

**2. Move the shield write into shared code**

Extract the `ManagedSettingsStore` apply/clear into a file compiled into **both** the
main app and the widget extension. Per CLAUDE.md, new Swift files must be registered in
`plugins/withHomeWidget.js` in both `widgetExtensionFiles` and `mainAppFiles`.

Reuse the canonical blocklist key `"bittersweet-blocklist"` — do not introduce a second
selection ID. When the widget applies a shield remotely it must still leave the three
pieces of state consistent (store `currentSelectionId`, `blockedApps`, and
`WidgetService.syncCurrentSelectionId()`); the widget can only write the app-group half,
so the app reconciles the Zustand half on next foreground.

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

**4. Edge function — and this one is not free**

Every existing function pushes through **Expo Push Service** (`exp.host/--/api/v2/push/send`).
Expo does not support `apns-push-type: widgets` or `liveactivity`. This needs a **direct
APNs path**: an APNs auth key (`.p8`), ES256 JWT signing, and `POST` to
`api.push.apple.com`. That's new infrastructure, not a variation on `heartbeat-blocklist-notify`.

New function `session-remote-control`, invoked when a desktop client writes a session
start/stop:

- look up the user's widget token
- send `apns-push-type: widgets`, `apns-priority: 10`
- also send an `apns-push-type: liveactivity` update so the Dynamic Island / Lock Screen
  timer tracks (this part works today with the tokens the fork already exposes)

**5. Widget timeline provider**

On reload: read pending command from Supabase via the existing `SupabaseClient`, apply or
clear the shield, write the new state into the app group, return a fresh timeline.

Keep it inside the widget memory budget — extensions here are tight, and the
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

**Phase 0 — Spike (half a day).** Two unverified assumptions, both cheap to settle and
both fatal to the plan if wrong:

1. Does WidgetKit push arrive with notification permission denied? (Inferred from the
   dedicated `push-type.widgets` topic; not confirmed in Apple's docs.)
2. Can a widget extension with `family-controls` actually write `ManagedSettingsStore`?
   (Extensions provably can — `ShieldAction` does — but no example of a *widget* doing it
   was found.)

Do not build anything else until both are yes.

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

*Known limits, by design:* a desktop start older than 60s is ignored rather than followed,
because this screen's timer always begins now and adopting an old start would misreport
elapsed time — the phone-was-closed case is what Phases 3 and 4 are for, and the desktop
writes that session's finished row itself. There is no toast when the phone follows a
remote stop; adding user-facing copy means the full 8-language i18n pass.

**Phase 3 — Live Activity push.** Timer follows on Lock Screen / Dynamic Island even when
the app is closed. Uses tokens the fork already exposes. Requires the direct-APNs edge
function, so this is where item 4 lands.

**Phase 4 — Widget push + remote shield.** Entitlement, shared shield code, widget token,
timeline apply. The swipe-away case.

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

Phases 1–2 are useful on their own and carry no native risk. Everything genuinely
uncertain is isolated in Phase 0 and Phase 4.

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

- [WWDC25 — What's new in widgets](https://developer.apple.com/videos/play/wwdc2025/278/)
  ([notes](https://wwdcnotes.com/documentation/wwdc25-278-whats-new-in-widgets/)) — push type + budgeting
- [Updating widgets with WidgetKit push notifications](https://developer.apple.com/documentation/WidgetKit/Updating-widgets-with-widgetkit-push-notifications)
- [Force-quit apps are denied background runtime](https://developer.apple.com/forums/thread/808088)
- [Network Extension lifecycle is independent of the container app](https://developer.apple.com/forums/thread/701976)
- [`family-controls` must be applied per target](https://developer.apple.com/forums/thread/682813)
- [`clearAllSettings()` unreliability](https://developer.apple.com/forums/thread/744157)
- [DeviceActivityMonitor network requests are unreliable](https://developer.apple.com/forums/thread/724649)
