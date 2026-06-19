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

## Milestone 2 — Funnel depth & permission cliff

Add only when M1 raises "where exactly do they drop?" questions.

| Event | Why |
|---|---|
| `screentime_permission_requested` / `_granted` | find the activation cliff (usually here) |
| `focus_session_started` | started→completed completion rate |
| `shield_hit` | user hits a blocked app (top of the unlock funnel) — fire from native shield/intent path |
| `app_unlock_insufficient_fruits` | economy too tight/loose signal (code already logs this) |
| `paywall_viewed` (+ `source`) / `subscription_started` | monetization funnel |

New cohort: `is_premium` for monetization-vs-retention.

---

## Milestone 3 — Breadth & social

Add when core loop is understood and the focus shifts to growth.

| Area | Events |
|---|---|
| Grove / social | `grove_setup_completed`, `friend_added`, `challenge_joined`, `friend_feed_viewed` |
| Referral | `referral_link_shared`, `referral_redeemed` |
| Re-engagement | `app_opened` with `source` (notification / widget / live-activity / deep-link) |
| Economy detail | `fruits_earned` / `fruits_spent` with `source` / `purpose` for balance analysis |
| Other features | `tag_created`, `insights_viewed`, `healthkit_import_completed`, `session_shared_to_feed` |

New cohort: `grove_friend_count > 0` for social-vs-retention.

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
