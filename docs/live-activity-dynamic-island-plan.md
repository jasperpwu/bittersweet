# Live Activity — Dynamic Island Suppression

Goal: keep the idle Live Activity banner on the Lock Screen (so users can start a
focus session from there) **without** the Dynamic Island pill lingering after a
focus session completes or an unlock expires.

Status: **mostly shipped.** One gap remains — unattended unlock expiry. This doc
records why the shipped design works, which alternatives are dead ends (so nobody
re-derives them), and how to close the gap.

---

## 1. The governing constraint

**The Dynamic Island follows activity _lifecycle_, not content.** An `active`
activity always occupies the island; an `ended` activity never does. Ending an
activity with a non-immediate dismissal policy drops it from the island
immediately while its Lock Screen banner survives (up to 4h). That is the *only*
mechanism that produces "Lock Screen without island."

Two corollaries, both verified against Apple docs:

- `WidgetKit.ActivityConfiguration` has exactly one initializer,
  `init(for:content:dynamicIsland:)`. The `dynamicIsland` closure is mandatory —
  there is no opt-out.
- `ActivityViewContext` exposes only `attributes`, `state`, `isStale`, and
  `activityID`. It deliberately does **not** expose `activityState`, so the view
  cannot even branch on whether the activity has ended.

**ActivityKit lifecycle is scoped to the app process.** Only the app can start,
update, or end an activity — including when a `LiveActivityIntent` launches it in
the background. Extensions cannot.

---

## 2. What shipped

All three paths end the activity with the idle card as its **final content** and
`.default` dismissal policy:

| Path | Where | Mechanism |
|---|---|---|
| Focus session ends (in-app) | `LiveActivityService.stopFocusTimer` | `endAllFocusActivitiesWithState(idleState)` (added to the patched pod) |
| Session/unlock ends natively (LA button, widget, Watch) | `targets/HomeWidget/SessionIntentActivityKit.swift` → `WidgetActivityKit.stopHandler` | `activity.end(content, dismissalPolicy: .default)` |
| Unlock ends (in-app, or expiry while app is alive) | `LiveActivityService.endUnlockToIdleCard` | `stopActivity(id, idleState, false)` — reuses the existing unlock activity |

Key design point for the unlock path: it **converts** the already-alive unlock
activity into the idle card rather than dismissing it and creating a replacement.
`Activity.request()` only ever yields an *active* activity, so creating one always
reintroduces the pill. `ensureIdleFocusActivity` (which does create) is kept only
as a fallback for when no unlock activity exists to convert.

Rendering is safe even though the converted activity's immutable attributes still
say `sessionType: "unlock"`:

- `LiveActivityView.swift:44` checks `contentState.isIdle` **first**; the
  `sessionType == "unlock"` branch is at `:168`, inside a branch never reached.
- Ending with `staleDate: nil` keeps `isStale` false, so the unlock-specific stale
  branch in `LiveActivityContentRouter` (`LiveActivityWidget.swift:413`) is skipped.

---

## 3. The remaining gap

**Unlock expires while the app is suspended or killed → the pill stays.**

Nothing runs to call `end()`. The only JS scheduled for that moment is a
`setTimeout` (`src/components/ui/UnlockSnackbar.tsx:224`), which requires a live JS
runtime. The `unlock-expired` local notification cannot execute code.

The activity instead hits its `staleDate` (derived from `progressBar.date`,
`LiveActivityService.ts:129`) and goes **stale but still alive** — and alive means
Dynamic Island. The widget repaints it as the idle card via the
`isStale && sessionType == "unlock"` branch, so it *looks* right but the pill remains.

**Self-heal:** on next foreground, `checkActiveUnlocks` (`src/store/index.ts:3287`)
sees `now >= session.endTime` and calls `endUnlock` → `endUnlockToIdleCard`. In
practice the window is "until the user reacts to the expiry notification."

---

## 4. Dead ends — do not re-attempt

| Approach | Why it fails |
|---|---|
| `EmptyView()` in `compactLeading`/`compactTrailing`/`minimal` | The system reserves and draws the island region for any active activity regardless of view content. Reported failing by other developers; the direct question sits unanswered on Apple's forums since Jan 2025. Likely failure mode is a *blank pill*, which looks worse than the idle card. |
| End it from `DeviceActivityMonitorExtension.intervalDidEnd` | Screen Time extensions cannot see Live Activities — `Activity.activities` is empty there, despite sharing the App Group. |
| End it from the Live Activity widget extension at render time | Same rule: `Activity.activities` is **always empty** in a widget extension. It renders only; it cannot manage. |
| Create the idle card then immediately end it (`startOrUpdateActivity` + `stopActivity`) | Tried and reverted. The pod's create branch fires its own detached `Task { updateImages; update }` (`ExpoLiveActivityModule.swift:393`) which races the end Task, leaving the activity inconsistent. If `updateImages` throws in the end Task, `end()` never runs and the activity stays active. Also churns ActivityKit's start budget. |
| `end(content, dismissalPolicy: .after(endDate))` at unlock start | Ending removes it from the island *immediately*, so the countdown loses its pill for the whole unlock. And `.after` **dismisses** the banner at that date, leaving no idle card. Inverted on both axes. |

**Sources**
- [Live Activity without Dynamic Island](https://developer.apple.com/forums/thread/773302) (unanswered)
- [Keep Live Activity in Expanded Dynamic Island State](https://developer.apple.com/forums/thread/780678) (EmptyView attempt)
- [Can Live Activities be updated via `activity.update` in extensions?](https://developer.apple.com/forums/thread/735382)
- [Ending Live Activities When Timer Expires](https://developer.apple.com/forums/thread/761577)
- [ActivityKit](https://developer.apple.com/documentation/ActivityKit) · [ActivityConfiguration](https://developer.apple.com/documentation/widgetkit/activityconfiguration)

---

## 5. The fix: ActivityKit push

An ActivityKit push is the only way to reach an activity with no app process
alive. Send one `end` push at the unlock's expiry time.

### Safety properties (these are why it's viable)

- **Tokens are per-activity, not per-device.** Each `Activity` mints its own token
  via `pushTokenUpdates` (`ExpoLiveActivityModule.swift:184`), invalidated when that
  activity ends. A push to a dead token is rejected by APNs (`410 Unregistered`)
  and does nothing on device. **A stale end-push is inherently a no-op** — no
  cancellation needed for correctness.
- **A new session cannot be hit by a stale push.** New activity → new token. This
  is airtight because `startOrUpdateActivity` refuses to reuse unlock activities
  (`ExpoLiveActivityModule.swift:319`, `sessionType != "unlock"`), so an unlock
  token never carries over into a focus session. **If that guard is ever removed,
  this design becomes unsafe.**
- **Out-of-order delivery is handled** — payloads carry a `timestamp`, and the
  system ignores a push older than the last one applied.

### Phases

**Phase 1 — enable push tokens (native, requires prebuild)**
- Add `ExpoLiveActivity_EnablePushNotifications: true` to the iOS Info.plist via
  `app.config.js`. The pod reads it at `ExpoLiveActivityModule.swift:196` and
  defaults to **false**, so today every activity starts with `pushType: nil` and
  no token is ever minted.
- `APP_VARIANT=development npx expo prebuild`, rebuild.
- Verify a token arrives through `addActivityTokenListener`.

**Phase 2 — persist token + scheduled job**
- On unlock start, upload: activity push token, unlock `endTime`, and the
  **idle-card content-state** (see below) to a `pending_activity_ends` table.
- On `endUnlock` (any path), delete the row — cancellation happens before anything
  is sent.
- Refresh the stored token if `pushTokenUpdates` emits again for the same activity.

**Phase 3 — sender**
- Supabase edge function on a cron, draining rows where `fire_at <= now()`.
- APNs: header `apns-push-type: liveactivity`, topic
  `<bundle-id>.push-type.liveactivity`, priority 10.
- Payload: `aps.event = "end"`, `aps.timestamp`, `aps.content-state`.
  **Omit `dismissal-date`** — that yields the default policy, i.e. the banner
  persists (up to 4h) while the island drops. Setting it in the past would dismiss
  the banner entirely, which is the opposite of the goal.
- Handle `410` as success-equivalent (activity already ended) and delete the row.

**Phase 4 — keep the backstop**
- Do **not** remove `checkActiveUnlocks`. Push is best-effort: it needs network at
  expiry, and APNs drops it after `apns-expiration`. Offline devices still rely on
  the foreground self-heal.

### The awkward part

The `end` payload carries the full `content-state`, so the **server must construct
the idle card**: `title` (tag icon + name), `subtitle` (duration label),
`isIdle: true`, `tagId`, `durationMinutes`, and the localized `startLabel` /
`endLabel` / `unlockedLabel` / `unblockExpiredLabel` from `laLabels()`. The full
shape is `LiveActivityAttributes.ContentState`
(`targets/HomeWidget/SessionIntentActivityKit.swift:19`).

This duplicates idle-card rendering in a second place and is the main source of
future drift — a field added to `ContentState` must be mirrored in the server
payload. Mitigate by having the client upload the exact content-state blob at
unlock start rather than having the server assemble it from parts. Note this means
a mid-unlock tag change must re-upload.

### Also plan for

- Dev and prod bundle IDs need separate `apns-topic` values; dev builds use the
  APNs **sandbox** host.
- Throttling is not a concern at one push per unlock;
  `NSSupportsLiveActivitiesFrequentUpdates` can stay `false`.

---

## 6. Open validation

**Does `Button(intent:)` fire on an *ended* Lock Screen banner?** Apple documents
this neither way and no authoritative source was found. Confirmed working on an
*active* banner; unconfirmed on an ended one.

This is make-or-break for everything in §2 — if taps are dead on an ended banner,
the idle card is decorative and the whole approach must be replaced by a Lock
Screen widget or an iOS 18 `ControlWidget` wired to the existing
`StartSessionIntent`. **Test this before investing in §5.**

---

## 7. Test matrix

| Scenario | Expected |
|---|---|
| Focus session completes in-app | Island drops, idle banner remains |
| Focus session ended from LA button / widget / Watch | Same |
| Unlock ended manually in-app | Same |
| Unlock ended from LA button | Same |
| Unlock expires, app foregrounded | Same (via `setTimeout` → `checkActiveUnlocks`) |
| Unlock expires, app suspended | **Currently: pill lingers.** After §5: island drops within seconds |
| Unlock expires, app suspended + device offline | Pill lingers until next foreground (accepted) |
| Tap Start on the resulting banner | New session starts, running LA appears |
| Start a new session while a stale end-push is queued | Push rejected (`410`), new activity unaffected |

Logs to watch: `✅ Unlock LA ended as idle card`, `ℹ️ Unlock LA already ended —
creating idle card instead` (fallback — means expiry raced something else),
`❌ [Widget] Failed to start Live Activity` (`Activity.request` rejected).
