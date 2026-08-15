# Expo SDK 53 → 56 Upgrade Plan

**Status:** Not started — planning only
**Motivation:** Adopt Expo UI (stable as of SDK 56: SwiftUI on iOS / Jetpack Compose on Android from one import)
**Baseline audited:** 2026-08-12, against `expo@53.0.22` / `react-native@0.79.0`

---

## TL;DR

Three sequential SDK upgrades (53 → 54 → 55 → 56), not a direct jump. The app code is in good shape; **the risk is concentrated in the two forked native modules**, not in JS.

**Biggest de-risker already true:** the app is **already on the New Architecture** — `ios/Podfile.lock` pulls `React-Fabric` and no `newArchEnabled: false` exists in `app.json` / `app.config.js` / `ios/Podfile.properties.json`. SDK 55 makes New Arch mandatory, so the usual blocker for a 53→56 jump does not apply here.

**Estimate:** 2–4 focused days, dominated by the fork rebases.

---

## Target versions

| | SDK 53 (now) | SDK 56 |
|---|---|---|
| React Native | 0.79 | 0.85 |
| React | 19.0 | 19.2 |
| Xcode | 16.x | **26.4+ required** |
| iOS min | 15.1 | 16.4 (we're at `deploymentTarget: 18.0` — fine) |
| JS engine | Hermes | Hermes **v1** (new default) |
| Architecture | New Arch (already on) | New Arch (mandatory) |
| Expo Router | 5.1.6 | 7.x (no longer depends on React Navigation) |
| Expo UI | n/a | stable |

---

## Preconditions

- [ ] **No App Store submission in flight.** Do not start this during a review cycle.
- [ ] Xcode **26.4+** installed locally; confirm the EAS Build image default matches.
- [ ] Working branch cut from a green `mainline`; tag the last known-good build so we can always ship a hotfix from it.
- [ ] A physical device available for every step — FamilyControls / DeviceActivity / ActivityKit / widgets cannot be validated in a simulator.
- [ ] All native truth already lives in `targets/` + `plugins/` (it does). `ios/` will be regenerated repeatedly.

**Note on `prebuild --clean`:** this upgrade requires running it many times. That is expected and safe here *because* `ios/` is fully generated. Re-verify after each SDK step that no manual `ios/` edits crept in.

---

## Execution: one SDK at a time

Repeat this loop for 54, then 55, then 56. **Do not batch.** Commit at the end of each successful loop.

```bash
npx expo install expo@^54.0.0 --fix     # then ^55.0.0, then ^56.0.0
npx expo install --check
npx expo-doctor
npx patch-package                        # will fail loudly — see Risk 1
npx expo prebuild --clean
APP_VARIANT=development npx expo prebuild   # local dev install flow
npm run lint
```

Then install on device and run the **validation checklist** (below) before moving to the next SDK.

Expo ships an upgrade skill for Claude Code (`/plugin install expo`) that automates the package bumps and config cleanup — worth using for the mechanical parts.

---

## Risks, ranked

### 1. Forked native modules + patches — the whole ballgame

| Package | Ours | Upstream (2026-08) | Patch |
|---|---|---|---|
| `react-native-device-activity` | fork of 0.5.0 (`jasperpwu/react-native-device-activity-custom`) | 0.6.1 | 598 lines |
| `expo-live-activity` | fork of 0.2.1 (`jasperpwu/expo-live-activity`) | 0.4.2 | 967 lines |
| `react-native-gesture-handler` | 2.24.0 | — | 95 lines |

Why this is hard:
- Upstream `react-native-device-activity` still dev-targets **expo 52 / expo-modules-core 2.2.3**. SDK 56 ships **expo-modules-core 3.x with a new Swift/C++ JSI layer that removed the Obj-C++ middle layer** — precisely the kind of ABI change that breaks hand-written native modules.
- Both forks carry custom Swift (shield action / open-parent-app fix, Live Activity ContentState label fields). Patches will **not** apply against new base versions; they must be regenerated, per CLAUDE.md's patch workflow (edit `node_modules/`, then `npx patch-package <pkg>` — and for `expo-live-activity`, remember `build/index.js` + `build/index.d.ts`, not just `src/`).
- `expo-live-activity` is a **personal fork, not npm** — deletions in the patch are legitimate; do not "restore" them.

**Approach:** rebase each fork onto its upstream head *first*, on its own branch, before touching the app's SDK version. Diff our custom commits against upstream to size the work. If a fork can't be made to build on SDK 56, the upgrade stops — everything shield/blocklist/Live-Activity/widget depends on it.

### 2. Expo Router 5 → 7 drops React Navigation

Six files import `@react-navigation` directly:

- `useIsFocused` — `app/(tabs)/journal.tsx:27`, `app/(tabs)/insights.tsx:3`, `src/components/journal/TodoSheet/TodoRow.tsx:2`, `src/components/analytics/GoalProgress/GoalProgress.tsx:2`
- `useBottomTabBarHeight` — `src/components/journal/TodoSheet/TodoSheet.tsx:14`
- `BottomTabBarProps` — `src/components/ui/TabBar/TabBar.tsx:3`

A codemod covers most of this. Two things to watch:
- **CoachMark intros gate on `isFocused`** — a silent behavior change here breaks the one-time walkthroughs.
- The custom `TabBar` is typed against `BottomTabBarProps`; it needs a real replacement type, not an `any`.

### 3. Reanimated 3.17 → 4.x

`useAnimatedGestureHandler` is removed. Rewrite to the Gesture API:
- `src/components/ui/Slider/Slider.tsx:114`
- `src/components/focus/TagSelector/HorizontalTagSelector.tsx:110`

Also re-apply the `react-native-gesture-handler` patch against the new version.

### 4. NativeWind

Currently `4.1.23`, declared as `"latest"` in `package.json` — **pin it before starting** so the upgrade isn't chasing a moving target. Stay on the **v4 stable / Tailwind 3 track**; v5 (CSS-first config, Tailwind 4) is still preview. The app is 100% NativeWind-styled, so any regression is app-wide rather than local. Watch for the known class-conflict behavior documented in CLAUDE.md.

### 5. Revenue- and review-critical dependencies

| Package | Ours | Upstream | Note |
|---|---|---|---|
| `expo-iap` | ^4.3.1 | 5.2.4 | Major bump. Re-test the full paywall + restore flow; we've already taken one 5.1.1 rejection. |
| `@kingstinct/react-native-healthkit` | ^14.0.2 | 14.0.2 | Current; verify SDK 56 support. |
| `crisp-sdk-react-native` | 0.1.4 | 0.4.2 | Support chat. |
| `expo-quick-actions` | ^5.0.0 | 6.0.2 | Major bump. |
| `react-native-view-shot` | ^5.1.0 | 5.1.1 | Minor. |
| `@shopify/flash-list` | ^1.7.6 | — | **Unused anywhere in `app/` or `src/` — drop it** rather than migrate to v2. |

### 6. Mechanical changes

- **`expo-file-system`** (SDK 54): classic API moves to `expo-file-system/legacy`. Two call sites — `src/services/purchasePhotoService.ts:1`, `src/services/sessionPhotoService.ts:1`. In SDK 56 `copy()` / `move()` are **async** (`copySync()` / `moveSync()` for the old behavior).
- **`expo/fetch` becomes global `fetch`** (SDK 56). Re-verify Supabase client, PostHog, and the sync/offline-queue paths — this swaps the network implementation under everything.
- **`@expo/vector-icons`** is no longer a dependency of `expo`. We already declare it explicitly; keep it. Long-term it's superseded by scoped `@react-native-vector-icons/*`.
- **RN `SafeAreaView`** is deprecated (14 direct imports from `'react-native'` across ~29 files). Not confirmed removed in 0.85, but it warns — migrate to `react-native-safe-area-context`, which is already a dependency.
- **`notification` field in `app.json`** removed in SDK 55 → migrate to the `expo-notifications` config plugin.
- **Hermes v1** is the default engine — treat as a full-app perf/behavior re-test, not a config flag.

### 7. Release logistics

- New SDK ⇒ **new runtime version**: OTA updates will not reach existing users until a new binary ships. Plan the store release before touching `update:prod`. Re-check `scripts/ota-preflight.sh` assumptions.
- **Expo Go for SDK 56 is not on the App Store** — dev builds only. We already use `expo-dev-client`, so no change in practice.
- iOS ships **precompiled XCFrameworks** by default in SDK 56 (`EXPO_USE_PRECOMPILED_MODULES=0` to opt out) — a likely first suspect if the forked modules fail to link.
- Hermes bytecode diffing is on by default (`"enableBsdiffPatchSupport": false` to disable).

---

## Validation checklist (run on device after each SDK step)

Ordered by how expensive a miss is:

- [ ] **Blocklist / shield** — pick apps, save, shield triggers, "open app" action, weekly escalation charge
- [ ] **Live Activity** — start / update / end, idle LA stays alive, Dynamic Island, localized labels
- [ ] **Widgets + intents** — home widget start/stop, stale-unlock guard
- [ ] **Focus session lifecycle** — start, complete, manual entry, fruits awarded, focus rating
- [ ] **Auth transitions** — sign-up (data preserved + uploaded), sign-in to existing (wipe + pull), sign-out (full wipe), user switch, reinstall (Keychain session survives)
- [ ] **Sync** — cold-start merge, offline queue flush, no RLS error storms, no phantom re-upserts
- [ ] **IAP** — paywall loads products, purchase, restore, entitlement pushed on sign-in
- [ ] **Grove** — feed, friends, challenges, block/report
- [ ] **i18n** — all 8+ languages render; RTL (ar/ur) has no reload loop; non-Latin font fallback intact
- [ ] **Navigation** — tab bar, modals, CoachMark intros fire once per screen
- [ ] **Notifications** — heartbeat, re-engagement, permissions prompts

---

## Pre-flight cleanup (do this first, independent of the upgrade)

Safe on SDK 53, shrinks the upgrade surface:

1. Pin `nativewind` to `4.1.23` instead of `"latest"`.
2. Remove the unused `@shopify/flash-list` dependency.
3. Migrate RN `SafeAreaView` → `react-native-safe-area-context`.
4. Rebase both forks onto their upstream heads on separate branches and confirm they still build on SDK 53. This isolates "fork rebase broke it" from "SDK 56 broke it" — the single most valuable thing we can do before starting.

---

## Decision note on Expo UI

Expo UI is only available stable on SDK 56, so there's no shortcut. But before committing: SDK 56's Expo UI ships **drop-in replacements** for `@react-native-community/datetimepicker`, `@react-native-community/slider`, `@react-native-segmented-control/segmented-control`, `@gorhom/bottom-sheet`, `react-native-pager-view`, `@react-native-picker/picker`, and others. We have hand-built `Slider`, `Toggle`, `BottomSheet`, and `TabBar`, and we use `@react-native-community/datetimepicker`. Worth confirming that Expo UI actually replaces enough of that to justify the upgrade cost, rather than upgrading for its own sake.

---

## References

- [How to upgrade to Expo SDK 56](https://expo.dev/blog/upgrading-to-sdk-56)
- [SDK 56 changelog](https://expo.dev/changelog/sdk-56)
- [SDK 55 changelog](https://expo.dev/changelog/sdk-55)
- [SDK 54 changelog](https://expo.dev/changelog/sdk-54)
- [Expo UI is now stable](https://expo.dev/blog/expo-ui-stable-sdk-56)
- [Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Upgrade Expo SDK walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [NativeWind installation](https://www.nativewind.dev/v5/getting-started/installation)
