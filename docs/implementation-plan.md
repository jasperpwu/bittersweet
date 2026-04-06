# Bittersweet — Implementation Plan

## Status Legend
- [ ] Not started
- [x] Complete

---

## Milestone 1: Core Experience

### 1-A: Session Complete Modal

**Goal:** Update the `session-complete.tsx` to show duration, fruits earned, and notes.

**What exists:**
- `app/(modals)/session-complete.tsx` — empty `<View />`
- Route registered in `app/_layout.tsx:143`
- `FruitCounter` component at `src/components/rewards/FruitCounter/`
- `NotesModal` triggers after session ends in `app/(tabs)/index.tsx:336`
- `createCompletedSession` stores the session and calls `earnFruits`

**Tasks:**

#### 1-A-1: Build `app/(modals)/session-complete.tsx`
- [x] Read `sessionId` from route params
- [x] Look up session from store via `useFocus().sessions.byId[sessionId]`
- [x] Display: tag emoji + name, duration ("Xh Ym"), start/end time, fruits earned (with 🍎 icon)
- [x] If no notes on the session, show an inline TextInput to add notes (saves via `updateSession`)
- [x] "Done" button calls `router.back()` to return home

**AC:**
- [x] Renders without crash for a valid sessionId
- [x] Duration, fruits, tag all match the actual session data
- [x] Adding a note persists it to the session in the store
- [x] "Done" returns to home tab
- [x] No empty flash before data loads

#### 1-A-2: Trigger modal from timer flow
- [x] In `app/(tabs)/index.tsx`, after `handleNotesSave` calls `createCompletedSession`, capture the new session ID
- [x] Navigate to `/(modals)/session-complete` with `{ sessionId }` as params
- [x] Ensure cancelling a session does NOT navigate to session-complete

**AC:**
- [x] Every completed session (≥1 min) navigates to session-complete
- [x] Cancelled sessions do not trigger the modal
- [x] Back navigation from modal returns to home, not NotesModal

---

### 1-B: Recent Activity on Home Screen

**Goal:** Show the last 3 sessions on the home screen so users see their recent activity without switching tabs.

**What exists:**
- `app/(tabs)/index.tsx` — timer screen, no recent activity shown
- `src/components/home/` — has some stub components (UserProfile, DailyGoals, CurrentTask)

**Tasks:**

#### 1-B-1: Build `src/components/home/RecentActivityPreview/RecentActivityPreview.tsx`
- [ ] Read last 3 sessions from `useFocus().sessions` sorted by `startTime` desc
- [ ] Each row: tag emoji, tag name, duration, relative time ("2h ago", "yesterday")
- [ ] Tapping a row navigates to journal tab
- [ ] Placeholder state when no sessions exist

**AC:**
- [ ] Shows at most 3 sessions
- [ ] Placeholder when empty (not blank space)
- [ ] Relative times are human-readable
- [ ] Tapping navigates to journal tab

#### 1-B-2: Add to `app/(tabs)/index.tsx`
- [ ] Insert `RecentActivityPreview` below the timer area
- [ ] Only visible when no session is running (idle state)

**AC:**
- [ ] Visible in idle state
- [ ] Hidden while a session is active
- [ ] Updates immediately after completing a session

---

## Milestone 2: Rule System & App Locking

### 2-A: Unlock Flow (Constant Rules)

**Goal:** Users spend fruits to unlock blocked apps for a fixed duration. Rules are constant (e.g. 10 fruits/min) — no user configuration, no rules store, no rules screen.

**What exists:**
- `src/store/index.ts` — rewards slice with `spendFruits` action, blocklist slice with stub `requestUnlock`
- `src/services/LiveActivityService.ts` — has `startUnlockCountdown()`
- `src/components/rewards/UnlockModal/` — existing unlock UI component
- `src/components/ui/UnlockSnackbar/` — snackbar component
- `BitterSweetFamilyControls.ts` — native module for Family Controls
- `src/services/screentime/manager.ts` — stub
- `src/services/deviceActivity/DeviceActivityListener.ts` — stub

**Tasks:**

#### 2-A-1: Define constant in `src/config/constants.ts`
- [ ] Add `FRUIT_COST_PER_MINUTE = 10` (or whatever the fixed rate is)

**AC:**
- [ ] Single constant, used everywhere unlock cost is calculated
- [ ] No user-facing way to change it

#### 2-A-2: Build `src/hooks/useAppUnlockFlow.ts`
- [ ] Look up the blocked app info from route params or UserDefaults (`pendingMainAppAction`)
- [ ] Calculate cost = `FRUIT_COST_PER_MINUTE × selectedDuration`
- [ ] `canAfford = rewards.balance >= cost`
- [ ] `confirmUnlock()`: calls `spendFruits` → lifts Screen Time restriction → starts Live Activity countdown → stores active unlock in blocklist slice

**AC:**
- [ ] `canAfford` is false when balance < cost
- [ ] `confirmUnlock()` does nothing if can't afford (no negative balance)
- [ ] On success: fruits deducted, restriction lifted, Dynamic Island countdown starts
- [ ] Returns `loading` and `error` states

#### 2-A-3: Build `app/(modals)/app-unlock.tsx`
- [ ] App name display (from pending action data)
- [ ] Duration pill selector (5 / 10 / 15 / 30 min)
- [ ] Cost preview: "X 🍎 for Y min" — updates in real time when duration changes
- [ ] Current fruit balance display
- [ ] "Confirm Unlock" button (disabled when can't afford)
- [ ] "Cancel" button (no state changes)

**AC:**
- [ ] Confirm disabled when balance < cost
- [ ] Selecting duration updates cost preview immediately
- [ ] On confirm: fruits deducted, app unlocked, countdown visible in Dynamic Island
- [ ] On cancel: nothing changes, returns to previous screen

#### 2-A-4: Implement `requestUnlock` in blocklist slice (`src/store/index.ts`)
- [ ] Replace the stub with real logic: deduct fruits, track active unlock session with expiry time
- [ ] Implement `endUnlock`: re-apply restrictions when timer expires

**AC:**
- [ ] Active unlock session stored with bundle ID, start time, end time
- [ ] `endUnlock` re-applies blocklist restrictions
- [ ] Unlock session survives app being backgrounded

---

### 2-B: Screen Time Enforcement (Spike — timebox 2 days)

**Goal:** Blocking and temporary unblocking via Family Controls actually works end-to-end.

#### 2-B-1: Implement `src/services/screentime/manager.ts`
- [ ] `applyBlocklist(selectionId)` — blocks apps in the selection
- [ ] `removeForDuration(selectionId, durationMs)` — lifts restriction temporarily
- [ ] `reapplyAll(selectionId)` — re-blocks after duration expires

**AC:**
- [ ] `applyBlocklist` blocks apps on a test device
- [ ] `removeForDuration` lifts restriction (per-app if possible, full list as fallback)
- [ ] Restrictions re-apply after duration elapses
- [ ] Blocking survives app being backgrounded

#### 2-B-2: Implement `src/services/deviceActivity/DeviceActivityListener.ts`
- [ ] Replace `hasPendingEvent = false` stub with real UserDefaults read (`pendingMainAppAction` key)

**AC:**
- [ ] Detects shielded app tap within 2 seconds
- [ ] Event payload contains correct bundle ID
- [ ] Stops polling when `stop()` is called

---

## Milestone 3: Dashboard & Insights

### 3-A: Clean Up Insights Tab

**Goal:** Insights tab shows goal progress + stats chart. Remove the dead "history" view mode — journal tab already handles session history and calendar.

**What exists:**
- `app/(tabs)/insights.tsx` — has `GoalProgress` + `StatisticsView` in statistics mode, empty "history" mode
- `GoalProgress` component — fully built with animated circular progress, period filters
- `StatisticsView` — renders `FocusSessionsChart` with period selector
- `GoalConfigModal` — full CRUD for goals (add/edit/delete)
- `calculateGoalProgress` — utility that calculates minutes per goal from sessions
- Journal tab already has calendar + timeline views

**Tasks:**

#### 3-A-1: Remove dead history view from `app/(tabs)/insights.tsx`
- [ ] Remove `ViewMode` type and `currentView` state
- [ ] Remove the `history` branch (`<View className="flex-1">Empty View</View>`)
- [ ] Remove `handleViewAllPress` and `handleBackPress` callbacks
- [ ] Remove `onViewAllPress` prop from `StatisticsView`
- [ ] Remove the back arrow in the header that shows for history mode

**AC:**
- [ ] No "history" view or "View All" button remains
- [ ] Insights tab always shows goal progress + statistics
- [ ] No dead code referencing `currentView` or `ViewMode`

#### 3-A-2: Remove `onViewAllPress` from `StatisticsView` component
- [ ] Remove the prop from `StatisticsViewProps` interface in `src/components/analytics/StatisticsView/StatisticsView.tsx`
- [ ] Remove any "View All" button rendered by `StatisticsView`

**AC:**
- [ ] `StatisticsView` no longer accepts or uses `onViewAllPress`
- [ ] No "View All" button rendered

#### 3-A-3: Remove "Habits & Streaks" tab from `GoalConfigModal`
- [ ] Remove `activeTab` state and tab toggle UI from `src/components/modals/GoalConfigModal/GoalConfigModal.tsx`
- [ ] Remove the "Habits & Streaks Coming Soon" placeholder content
- [ ] Keep only the Focus Goals content

**AC:**
- [ ] No tab toggle in the goal config modal
- [ ] Only focus goals content shown
- [ ] Goal CRUD still works as before

#### 3-A-4: Wire `deleteSession` properly in insights
- [ ] Replace `console.log('Deleting session:', sessionId)` stub with actual `useFocusActions().deleteSession`

**AC:**
- [ ] If delete is exposed anywhere in insights, it actually deletes the session from the store

---

## Cross-Cutting Issues

### CC-1: Profile Screen

**Goal:** Settings "Profile" row navigates to a real screen showing name, avatar, and lifetime stats.

**What exists:**
- `app/(tabs)/settings.tsx` — `handleProfile` logs to console
- `Avatar` component at `src/components/ui/Avatar/`
- `useUnifiedStore().stats` — has totalFocusTime, totalSessions

**Tasks:**

#### CC-1-1: Build `app/(modals)/profile.tsx`
- [ ] Display name (editable, persisted to `unified-store.ts`)
- [ ] `Avatar` component (placeholder when no image)
- [ ] Stats: total sessions, total focus time, total fruits earned
- [ ] Register in `app/_layout.tsx` Stack

**AC:**
- [ ] Navigable from Settings "Profile" row
- [ ] Name editable and persists across restarts
- [ ] Stats match values in the store
- [ ] Avatar placeholder renders when no image

#### CC-1-2: Wire navigation in `app/(tabs)/settings.tsx`
- [ ] Change `handleProfile` from `console.log` to `router.push('/(modals)/profile')`

**AC:**
- [ ] Tapping "Profile" navigates to profile screen

---

### CC-2: Help Center

**Goal:** Settings "Help Center" row navigates to a basic FAQ screen.

#### CC-2-1: Build `app/(modals)/help-center.tsx`
- [ ] Static FAQ list with expandable items covering core features
- [ ] Register in `app/_layout.tsx` Stack

**AC:**
- [ ] Navigable from Settings "Help Center" row
- [ ] At least 5 FAQ items
- [ ] Works offline

#### CC-2-2: Wire navigation in `app/(tabs)/settings.tsx`
- [ ] Change `handleHelpCenter` from `console.log` to `router.push('/(modals)/help-center')`

**AC:**
- [ ] Tapping "Help Center" navigates to the screen

---

### CC-3: Reminder Ringtone Selector

**Goal:** Ringtone selector in Settings actually plays previews and persists the choice.

#### CC-3-1: Build `src/components/modals/RingtoneSelector/RingtoneSelector.tsx`
- [ ] Bottom sheet with list of ringtone options
- [ ] Each row plays a brief audio preview via `expo-av` on press
- [ ] Selected ringtone persisted in `unified-store.ts` preferences
- [ ] Audio stops if sheet dismissed mid-preview

**AC:**
- [ ] Tapping a ringtone plays a preview
- [ ] Selection persists across restarts
- [ ] Reachable from Settings ringtone row
- [ ] Audio stops on dismiss

---

## Dependency Order

```
1-A-1 → 1-A-2 (session complete modal, then trigger it)
1-B-1 → 1-B-2 (recent activity component, then wire to home)

2-A-1 → 2-A-2 → 2-A-3, 2-A-4 (constant → hook → screen + store)
    → 2-B-1, 2-B-2 (screen time spike, after unlock flow defined)

3-A-1..4 (all independent, can be done in any order)

CC-1..3 (fully parallel, no dependencies on milestones)
```
