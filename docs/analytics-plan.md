# Analytics Plan (PostHog)

> Goal: answer three questions with the **smallest possible event set** —
> **feature adoption**, **retention**, and **cohorts** (esp. blocklist vs. no-blocklist).
> We deliberately start tiny. Fewer events = cleaner funnels and unambiguous insight.
> Add events only when a specific question demands one we don't already have.

## Principles

- **Instrument at the store layer, not the UI.** Fire events from the existing
  semantic store methods (`completeSession`, `spendFruits`, `unlockApp`, goal/blocklist
  mutations) so events can't drift from real state. ~6 call sites cover Milestone 1.
- **Cohorts come from person properties, not events.** We don't need a "user is a
  blocker" event — we set a property and segment retention by it.
- **Don't track what we won't look at.** Every event below maps to a chart we will
  actually build. If it doesn't, it waits.
- **One swappable wrapper.** All calls go through `AnalyticsTracker` (`track` /
  `identify` / `reset` / `setPersonProperties`) so the SDK stays replaceable.

## Identity

- `identify(supabaseUserId)` on auth (`onAuthStateChange` in `app/_layout.tsx`).
- `reset()` on sign-out (also a privacy requirement — no analytics identity leaks
  to the next person on the device).

---

## Milestone 1 — Minimum viable insight

Six events + four person properties. This alone answers adoption, retention, and the
blocklist cohort. **Ship this, look at it for a couple of weeks, then expand.**

### Events

| Event | Fires from | Why it exists |
|---|---|---|
| `app_opened` | app lifecycle (PostHog can autocapture this) | DAU / WAU / MAU, raw retention |
| `onboarding_completed` | end of `app/onboarding.tsx` | activation funnel endpoint |
| `focus_session_completed` | `focus.completeSession` | **the** core-loop + activation + "continuous use" retention signal |
| `blocklist_configured` | blocklist save (≥1 app) | blocking adoption; updates blocklist person props |
| `app_unlocked` | `spendFruits(purpose: 'app_unlock')` — fires when the user spends fruit to unlock app(s), i.e. the unlock action (not the session expiring) | blocking-economy adoption (earn → spend loop closes) |
| `goal_activated` | `updateGoal` isActive false→true (goals are auto-created per tag, so *activation* is the real user intent) | goal adoption; updates `has_set_goal` |
| `store_opened` | `router.push('/fruit-store')` (`app/(tabs)/index.tsx`) | fruit-store adoption / intent to spend |
| `widget_active` | app foreground, when ≥1 home-screen widget is first observed (see note) | widget adoption; strong retention cohort |

Suggested properties (keep minimal):
- `focus_session_completed`: `duration_minutes`, `tag`, `has_blocklist` (bool), `counted_toward_goal`
- `app_unlocked`: `unlock_duration`, `fruit_cost`
- `blocklist_configured`: `app_count`
- `widget_active`: `families` (e.g. `["systemSmall","systemMedium"]`)

> **Note on `widget_active` (named `widget_created` in discussion).** iOS provides
> **no callback when a user adds a widget**, so we cannot capture the literal creation
> moment. We detect *presence* instead: on app foreground, the main app calls
> `WidgetCenter.shared.getCurrentConfigurations` (we don't read this anywhere today —
> the app only ever pushes via `reloadTimelines`) and emits `widget_active` the first
> time the installed count is ≥1, then sets the `has_active_widget` person property.
> This requires a **small native addition** (a Swift helper in `targets/` exposing the
> config count to JS, registered in the widget plugin per the CLAUDE.md "Adding new
> Swift files" rule, then `npx expo prebuild --clean`). It's heavier than the other
> five M1 events but **committed to M1** — the widget-vs-no-widget cohort is worth
> shipping on day one. `store_opened` is trivial JS.

### Person properties (drive all cohorts)

| Property | Updated when | Used for |
|---|---|---|
| `ever_configured_blocklist` (bool, sticky true) | first `blocklist_configured` | "did they ever try blocking?" |
| `blocklist_app_count` (number) | every blocklist save | active blockers vs. set-and-emptied |
| `has_set_goal` (bool) | `goal_activated` | goal cohort |
| `has_active_widget` (bool, sticky true) | first `widget_active` | widget-vs-no-widget retention cohort |
| `total_focus_sessions` (number) | every `focus_session_completed` | power-user segmentation |

### Charts we build in PostHog (no extra app code)

1. **Feature adoption** — % of users who fired each event at least once
   (`unique users / active users`). Anything <5% is undiscoverable or unwanted.
2. **Retention** — N-day/N-week retention with returning event =
   `focus_session_completed` ("are people *continuously using* the core loop?").
3. **Cohort: blocklist vs. no-blocklist** — the retention chart above, **broken
   down by `ever_configured_blocklist`**. Two curves:
   - `false` = pure focus-timer users (never block)
   - `true` = users who set up blocking
   If `true` retains better → blocking is the activation lever; push it in onboarding.
   If they retain equally → the timer is the sticky part and blocking is secondary.
4. **Cohort: goal vs. no-goal** — same retention chart broken down by `has_set_goal`.
5. **Cohort: widget vs. no-widget** — same retention chart broken down by
   `has_active_widget` (widgets are a known re-engagement driver; this confirms it).
6. **DAU / WAU / MAU + stickiness (DAU/MAU)** — derived automatically from
   `app_opened`. Target stickiness >20% for a habit app.

### Activation funnel (free once the events exist)

`app_opened` → `onboarding_completed` → `focus_session_completed` (first).
Define **activated = first `focus_session_completed`**. Expect the biggest drop at
the Screen Time permission step — Milestone 2 adds the events to see exactly where.

---

## Milestone 2 — SHIPPED (funnel depth, feature adoption, settings cohorts)

M1 answered "do people use the core loop?" but left every other surface dark —
todos, monetization, social, the Screen Time prompt. M2 fills those in.

**Design rule carried over from M1:** an `_attempted` event fires when the user
*opens* a creation surface, `_completed` when the write succeeds. The pair is the
abandonment rate; neither one alone tells you anything.

### Funnel & permission events

| Event | Fires from | Properties |
|---|---|---|
| `focus_session_started` | `focus.startSession` | `duration_minutes`, `tag_id`, `has_blocklist` |
| `screentime_permission_requested` | `blocklist.requestAuthorization` (before the await) | — |
| `screentime_permission_granted` | same method, on `authorized === true` | `status` |
| `paywall_viewed` | `UpgradeSheet` on open | `source` (`tags`/`goals`/`adhd`/`health`) |
| `subscription_started` | `purchaseUpdatedListener` (StoreKit confirms, not `purchase()`) | `product_id` |

### Creation funnels (`_attempted` → `_completed`)

| Pair | Attempted from | Completed from |
|---|---|---|
| `manual_session_attempted` / `manual_session_created` | `openManualEntryModal` (journal) | `createCompletedSession` when `isManualEntry` |
| `custom_reward_attempted` / `custom_reward_created` | create-reward card (fruit-store) | `rewards.addCustomReward` |
| `gift_reward_attempted` / `gift_reward_completed` | gift modal open (fruit-store) | `grove.createGift` |
| `challenge_create_attempted` / `challenge_create_completed` | create-challenge screen mount | `grove.createChallenge` |

> `manual_session_created` deliberately fires **only** for `isManualEntry`.
> `createCompletedSession` is also the widget / Live Activity / Watch adoption path,
> and those are already counted by `focus_session_completed` via `earnFruits` — firing
> for them would double-count the same session.

### Feature-adoption events

| Event | Fires from | Notes |
|---|---|---|
| `todo_created` | `focus.createTodo` | `scheduled` separates checklist users from timeline users |
| `todo_completed` | `toggleTodo` / `setTodoCompleted` | only on false→true; un-checking is a correction |
| `tag_created` | `focus.createTag` | sets `tag_count` — the free-tier (3 tag) paywall pressure gauge |
| `session_rated` | `applyFocusRating` **when `source === 'user'`** | `'suggested'` fires on ~every session and would just shadow `focus_session_completed` |
| `badge_earned` | `focus.concludeGoal` | the only place a badge is minted |
| `reward_purchased` | `rewards.addPurchase` | single choke point for tips, themes **and** custom rewards |
| `healthkit_import_completed` | `importHealthKitWorkouts` **when `imported > 0`** | the import re-runs on every sync; `imported=0` would swamp the signal |
| `ai_coach_viewed` | ai-coach screen mount | `report_count` separates "reads reports" from "found it empty" |
| `grove_setup_completed` | `grove.createProfile` | |
| `friend_added` | `acceptFriendRequest` + `acceptPendingInvite` | `source`: `request` / `invite_link` |
| `challenge_joined` | `grove.acceptChallenge` | |
| `grove_inner_circle_added` | `grove.inviteToInnerCircle` | |
| `referral_code_created` / `referral_redeemed` / `referral_reward_claimed` | `referralSlice` | redeemed ÷ created = viral coefficient |
| `timer_style_changed` | `updatePreferences`, **user edits only** | guarded on `updates.updatedAt == null`; a sync-apply passes the cloud timestamp and must not emit |

### Person properties added in M2

Settings are **cohorts, not events** — "how many users have multi-task on" is a
person-property breakdown, not a count of historical toggles. `updatePreferences`
re-stamps the whole preference surface on every edit: cheap, idempotent, and it
self-heals for users who set a preference before this instrumentation existed.

| Property | Source |
|---|---|
| `language`, `theme`, `timer_picker_style`, `goal_reminder_enabled`, `notifications_enabled`, `healthkit_enabled`, `slider_theme_id`, `multitask_enabled` | `updatePreferences` |
| `session_rating_enabled` | `autoRateSessionFromMotion` — Motion permission granted; where false, every session silently gets a flat 5★ |
| `profile_type`, `live_status_enabled` | `createProfile` / `updateProfile` / `updatePrivacySettings` |
| `is_premium`, `first_subscribed_at` | `subscription_started` |
| `friend_count`, `inner_circle_count`, `tag_count`, `total_todos`, `total_purchases`, `custom_reward_count` | their respective create/accept methods |
| Sticky `ever_*` flags (`ever_created_todo`, `ever_sent_gift`, `ever_earned_badge`, `acquired_via_referral`, `screentime_authorized`, …) | `setOnce` on first occurrence |

---

## Milestone 3 — not yet instrumented

Deliberately still dark. Add only when a specific question demands it.

| Event | Why it's deferred |
|---|---|
| `shield_hit` | needs a native shield/intent → JS bridge; the unlock funnel top is inferable from `app_unlocked` for now |
| `app_unlock_insufficient_fruits` | economy tuning signal; wait until the economy is actually being tuned |
| `app_opened` with `source` (notification / widget / deep-link) | attribution for re-engagement pushes |
| `fruits_earned` / `fruits_spent` with `source` / `purpose` | full economy balance analysis |
| `friend_feed_viewed`, `insights_viewed` | screen-view events; only useful once adoption is proven |

---

## Implementation order

1. Verify `posthog-react-native` version against `expo@53.0.22` / RN 0.79 / React 19; install.
2. Build `AnalyticsTracker` wrapper (`track` / `identify` / `reset` / `setPersonProperties`).
3. Wire `identify` / `reset` into `onAuthStateChange`.
4. Add the 7 pure-JS Milestone-1 events (`app_opened`, `onboarding_completed`,
   `focus_session_completed`, `blocklist_configured`, `app_unlocked`,
   `goal_activated`, `store_opened`) at their store/UI choke points + maintain the
   person properties.
5. Native widget detection for `widget_active`: Swift helper exposing
   `WidgetCenter.getCurrentConfigurations` count to JS → register in the widget plugin
   → `npx expo prebuild --clean` → emit on foreground when count ≥1 + set
   `has_active_widget`. (Native step — coordinate prebuild timing.)
6. Build the 6 charts in PostHog. Review for ~2 weeks before touching Milestone 2.

---

## Milestone 1 — PostHog chart configs

> ⚠️ **Event naming:** our spec name `app_opened` is captured by PostHog's lifecycle
> autocapture as **`Application Opened`** (with a space). Use that exact name in
> charts. All other events use the snake_case names exactly as instrumented.

### Setup once: cohorts (People → Cohorts → New cohort, all dynamic)

| Cohort | Definition (person property) |
|---|---|
| Blockers | `ever_configured_blocklist = true` |
| Non-blockers | `ever_configured_blocklist` is not set |
| Goal setters | `has_set_goal = true` |
| Non-goal-setters | `has_set_goal` is not set |
| Widget users | `has_active_widget = true` |
| Non-widget users | `has_active_widget` is not set |

### 1. Feature adoption
- **Insight:** Trends
- **Series:** one per event — `onboarding_completed`, `focus_session_completed`,
  `blocklist_configured`, `app_unlocked`, `goal_activated`, `store_opened`,
  `widget_active`
- **Math:** Unique users · **Range:** last 30d · **Display:** bar/table
- Adoption % = each series ÷ unique users of `Application Opened` (add as a formula).
  Anything <5% is undiscoverable or unwanted.

### 2. Retention — core loop (north star)
- **Insight:** Retention
- **Start event:** `focus_session_completed`, "for the first time"
- **Returning event:** `focus_session_completed`
- **Type:** Recurring · **Period:** Week · **Window:** 8 weeks

### 3–5. Cohort retention comparisons
Duplicate insight #2 and add a **filter → cohort**, one saved insight per branch,
placed side by side on the dashboard:
- **Blocklist:** "Retention — Blockers" vs "Retention — Non-blockers"
- **Goal:** "Retention — Goal setters" vs "Retention — Non-goal-setters"
- **Widget:** "Retention — Widget users" vs "Retention — Non-widget users"

Read: if the `true` cohort retains better, that feature is an activation lever to
push in onboarding; if curves match, the core timer is the sticky part.

### 6. DAU / WAU / MAU + stickiness
- **Insight:** Trends · **Series:** `Application Opened` ×3 with math
  **Daily active users**, **Weekly active users**, **Monthly active users**
- **Stickiness:** separate Stickiness insight (or formula DAU ÷ MAU). Target >20%.

### Bonus — activation funnel (events already exist)
- **Insight:** Funnel · **Steps:** `Application Opened` → `onboarding_completed` →
  `focus_session_completed` · **Window:** 7 days. Shows where new users drop before
  their first completed session. (M2 adds the Screen-Time permission step.)

---

## Milestone 2 — PostHog dashboard tiles (built)

Dashboard **"Milestone 1 — Core Analytics"** (project 476985, dashboard 1734418),
tiles 8–29. Created via the PostHog API; the generator script is disposable, the
dashboard is the source of truth. Re-running against an existing tile name PATCHes
it rather than duplicating.

| # | Tile | Type |
|---|---|---|
| 8 | Adoption — planning (todos, manual log, tags) | Trends, DAU, bar |
| 9 | Adoption — social (Grove) | Trends, DAU, bar |
| 10 | Adoption — fruit economy | Trends, DAU, bar |
| 11 | Adoption — secondary features | Trends, DAU, bar |
| 12 | Activation funnel v2 (adds Screen Time + session start) | Funnel, 7d |
| 13 | Session completion rate (started → completed) | Trends |
| 14 | Screen Time permission grant rate | Trends |
| 15 | Monetization funnel (paywall → subscription) | Funnel, 3d |
| 16 | Paywall impressions by `source` | Trends, event breakdown |
| 17–20 | Manual session / custom reward / gift / challenge creation funnels | Funnel, 1h window |
| 21 | Referral funnel | Funnel, 30d |
| 22–28 | Settings distributions (language, timer style, multi-task, session rating, goal reminders, profile type, live status) | Trends, person breakdown |
| 29 | Free vs premium actives | Trends, person breakdown |

**Reading tiles 17–20:** the 1-hour window is deliberate — these are single-sitting
flows, so a longer window would silently count "opened it Monday, finished Friday"
as a success and hide the real abandonment.

**Tile 20 caveat:** challenge-creation drop-off is often "no friends to invite"
rather than UI friction. The `friend_count` property on
`challenge_create_attempted` separates the two — always read it next to tile 9.

---

## Dedup semantics — read before adding a tile

Three separate "is this per-user?" questions, with three different answers.

### 1. Identity — yes, deduped by Supabase user id
`AnalyticsTracker.identify(user.id)` runs on **both** `SIGNED_IN` and
`INITIAL_SESSION` (`app/_layout.tsx`), so a signed-in user is one PostHog person
across devices and reinstalls, and PostHog merges their pre-sign-in anonymous
events into that person. `reset()` on sign-out starts a fresh anonymous id.

**Limit:** a user who has *never* signed in is a separate person per install —
reinstalling creates a new anonymous person with no way to link them. Split any
adoption number by the `is_signed_in` property (tile 7) before trusting it.

### 2. Query math — `dau` is per-user, but the DISPLAY decides if the total is
**This is the trap.** `math: "dau"` dedupes *within each bucket*, not across the
window. With a time-series display (`ActionsBar`, `ActionsLineGraph`) the headline
total is the **sum of 30 daily unique counts** — a user active on 12 days counts 12
times.

Measured on `focus_session_completed` / 30d:

| Display | Reported | What it is |
|---|---|---|
| `ActionsBar` | **68** | sum of daily uniques |
| `ActionsBarValue` | **7** | actual unique persons |

A ~10× overstatement. Every adoption tile (1, 8–11, 29) therefore uses
`ActionsBarValue` / `ActionsPie`, which return a single `aggregated_value` =
unique persons over the whole window. **Use a time-series display only when you
genuinely want the shape over time, and never read its total as a user count.**

### 3. Rates need `total`, not `dau`
Tile 13 (session completion rate) counts **events**, not users: with `dau` math a
user who starts 5 sessions and finishes 3 reads as 1 vs 1 = 100%. Per-user math is
correct for once-per-user things like tile 14 (permission grant rate), wrong for
anything measuring repeat behaviour.

### 4. Person-property breakdowns are CURRENT value, applied retroactively
PostHog breaks down by the person's **latest** property value, not the value at
event time — if a user turns multi-task off today, all their past events re-bucket
to `false` and the chart rewrites its own history.

For tiles 22–29 this is the desired behaviour: they answer "how many users have
this setting on **right now**", each person counted once. They are **snapshots, not
trends** — do not read them as "adoption of multi-task over time". If that question
ever matters, it needs a dedicated event (which is why `timer_style_changed` exists
alongside the `timer_picker_style` property).

---

## Semantics audit (full pass over every event + tile)

Findings from auditing all 41 events against all 37 tiles. The recurring lesson:
**a store method existing is not evidence that it runs.** Two events were wired to
code paths that are never executed.

### Dead events (fixed)

- **`focus_session_started` was on `focus.startSession` — dead code.** The live
  timer never creates a store session up front; it starts the countdown in
  `startTimer()` (`app/(tabs)/index.tsx`) and only writes a session on completion.
  `startSession` is destructured in `index.tsx` but never called. Moved the event
  to `startTimer()`.
- **`session_rated` gated on `ratingSource === 'user'` — impossible by design.**
  `FocusRatingBlock` is explicitly read-only ("the user can't override stars"), so
  only `'suggested'` ever occurs. Replaced with `session_auto_rated`, which records
  the *distribution* of machine ratings (tile 30) — that answers the real question:
  is motion rating discriminating, or is everyone silently getting the 5★
  permission-denied fallback?

### Double-counting and population mismatches (fixed)

- **`tag_created` fired for onboarding's tag picker.** Onboarding creates the
  user's 1–3 chosen tags through the same `createTag`, so every activated user
  fired it and the series read ~100% by construction. Added `during_onboarding`
  (derived from `hasSeenOnboarding`, still false during that loop) and filtered
  tile 8 to `false`.
- **Completion rate mixed two populations.** Widget / Live-Activity sessions are
  adopted as already-complete and never fire a start event, so
  completed ÷ started could exceed 100%. Added `start_source` to
  `focus_session_completed` (`params.id` present ⟹ native-originated) and pinned
  both series on tile 13 to the in-app path.
- **`subscription_started` could count renewals/restores.** `purchaseUpdatedListener`
  fires for those too. `expo-iap`'s `restorePurchases` passes
  `alsoPublishToEventListenerIOS: false`, but `AppStore.sync()` may still surface
  transactions natively — so rather than depend on that, the event is now gated on a
  `purchaseInitiatedByUser` flag set only by `purchase()`. Renewals still refresh
  the `is_premium` property, they just don't count as conversions.
- **`friend_count` only updated for the accepting side.** `friend_added` fires on
  accept, so the initiator gained a friend with a stale cohort property — roughly
  half of all friendships invisible. Now re-stamped from the authoritative list in
  `fetchFriends`, which also catches removals (no event exists for those).

### Confirmed correct (no change)

- **No event fires from a sync/hydration path.** `pullAndApply` writes state via
  `set()` and never calls `createTag` / `createTodo` / `addPurchase`, so cloud pulls
  produce no phantom events. `timer_style_changed` is separately guarded on
  `updates.updatedAt == null`.
- **`todo_completed`'s two call sites are distinct surfaces**, now labelled:
  `setTodoCompleted` has exactly one caller (widget-toggle adoption) → `source:
  'widget'`; `toggleTodo` is the in-app path → `source: 'app'`.
- **Retention cohorts are sound** — `is_set`/`is_not_set` against sticky `setOnce`
  flags (which are only ever written `true`), and the identity pair correctly uses
  `exact true` vs `is_not true` on `is_signed_in` (which *is* written `false`, so
  `is_not_set` would have been wrong there).
- **Tiles 6, 7, 14 keep a time-series display on `dau`** — for those the daily line
  is the intended reading. Their *totals* still sum daily uniques; do not read them
  as user counts.

### Open — needs a decision

`$internal_or_test_user` is never set, so **your own dev/test devices are counted in
every number on the dashboard.** With ~18 persons total that is likely a large share
of the data. There is already an `isDevUser` helper (`src/config/devUsers.ts`) that
could set the property; wiring it would let PostHog filter internal traffic out
project-wide. Not done here because it changes what every existing chart reports.
