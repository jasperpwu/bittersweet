# Expo SDK 53 → 57 Upgrade Plan

**Status:** ✅ **JS/config upgrade complete — 53 → 54 → 55 → 56 → 57, one commit per step.**
Device validation still outstanding (see checklist).
**Motivation:** Adopt Expo UI (stable since SDK 56) and get back onto a current SDK
**Baseline audited:** 2026-08-12 against `expo@53.0.22` / `react-native@0.79.0`
**Revised:** 2026-08-13 — target moved 56 → 57, and every claim below re-verified by building against real SDKs

> Supersedes `expo-56-upgrade-plan.md`. The original targeted SDK 56, which was already
> one major behind by the time it was written (57.0.12 is `latest`; 58 is in canary).

---

## TL;DR — the plan's central fear did not survive contact

The original plan said the forked native modules were "the whole ballgame" and that
**"if a fork can't be made to build on SDK 56, the upgrade stops."**

That gate was tested directly, and it passes:

**All six native targets from both of our forks — unmodified, unrebased — build clean on
SDK 57 / RN 0.86.2 / Xcode 26.6.**

| Target | Source | Result |
|---|---|---|
| `ReactNativeDeviceActivity` | our device-activity fork | ✅ BUILD SUCCEEDED |
| `ShieldAction` | our fork (carries the 2.5.1 App Store fix) | ✅ BUILD SUCCEEDED |
| `ShieldConfiguration` | our fork | ✅ BUILD SUCCEEDED |
| `ActivityMonitorExtension` | our fork | ✅ BUILD SUCCEEDED |
| `ExpoLiveActivity` | our live-activity fork | ✅ BUILD SUCCEEDED |
| `probe57LiveActivity` (widget) | our live-activity fork | ✅ BUILD SUCCEEDED |

Both config plugins also ran clean through `expo prebuild` + CocoaPods on SDK 57.

**Consequence: the fork rebases — which the original estimate said would dominate the
2–4 days — are not required to ship.** They are optional maintenance, not a blocker.

**Caveat, stated plainly:** compiling is not running. FamilyControls / DeviceActivity /
ActivityKit behavior still has to be validated on a physical device (see checklist).
What is now established is only that the *build* gate is clear — but that was the gate
the whole plan was contingent on.

---

## Target versions (verified against `expo@57.0.12`'s `bundledNativeModules.json`)

| | SDK 53 (now) | SDK 57 (target) |
|---|---|---|
| React Native | 0.79 | **0.86.2** |
| React | 19.0 | **19.2.3** |
| Xcode | 16.x | 26.4+ — **local is 26.6 ✅** |
| iOS min | 15.1 | we're at `deploymentTarget: 18.0` — fine |
| expo-modules-core | 2.x | **57.x** (SDK-aligned versioning, *not* "3.x") |
| Expo Router | 5.1.6 | **57.0.12** (SDK-aligned, *not* "7.x") |
| Reanimated | 3.17.4 | **4.5.1** |
| Gesture Handler | 2.24.0 | **2.32.0** |
| Architecture | New Arch (already on) | New Arch (mandatory) |

The New Architecture point from the original plan still holds and is still the biggest
structural de-risker: `ios/Podfile.lock` pulls `React-Fabric` and no `newArchEnabled: false`
exists anywhere, so the usual blocker for a multi-SDK jump does not apply.

---

## Pre-flight cleanup — status

On branch `expo-56-preflight` (uncommitted at time of writing).

- [x] **1. Pin `nativewind`** — was `"latest"`, now `4.1.23`. (Latest v4 is `4.2.6`; stay on
      the v4 / Tailwind 3 track. v5 is CSS-first + Tailwind 4 and still preview.)
- [x] **2. Drop `@shopify/flash-list`** — confirmed zero usages anywhere in `app/` or `src/`.
- [x] **3. Migrate RN `SafeAreaView` → `react-native-safe-area-context`** — **29 files**, not the
      14 the original plan counted. The first count missed multi-line `import { ... } from 'react-native'`
      blocks. Verified safe:
      - tsc: 72 errors before, 72 after — zero new (only a line-number shift)
      - eslint: no new errors; prettier back to its 118-file baseline
      - NativeWind already registers safe-area-context's `SafeAreaView` for `className`
        (`react-native-css-interop/dist/runtime/components.js`), so styling is unaffected
      - No migrated `SafeAreaView` carried padding classes, so the `additive` edge mode is
        behaviorally identical to RN's
- [ ] **4. Rebase both forks** — **recommend dropping this step.** See "Forks" below.

Remaining pre-flight worth doing (all safe on SDK 53, all shrink the upgrade surface):

- [ ] Rewrite the 2 `useAnimatedGestureHandler` sites to the `Gesture`/`GestureDetector` API.
      Doable *now* — that API already exists in our gesture-handler 2.24, and
      `app/(tabs)/index.tsx` already uses it, so there's an in-repo pattern to copy.
- [ ] Bump `@expo/vector-icons` `^14.0.0` → `^15.0.2` (no longer a dependency of `expo`;
      we already declare it explicitly, which was correct).
- [ ] Install a modern Ruby (see "Environment blocker").

Cannot be pre-done on SDK 53: the `useIsFocused` import swap — expo-router 5.1.6 exports
`useFocusEffect` but **not** `useIsFocused`. That one waits for the SDK step.

---

## Forks — reassessed

### `react-native-device-activity` (fork of 0.5.0)

- Upstream is `0.6.1`, last published **2026-02-19**, still dev-targeting **expo 52 /
  expo-modules-core ~2.2.3**. No commit anywhere in its history references SDK 54/55/56/57.
- **Our fork has no common git ancestor with upstream at all** (`git merge-base` returns
  nothing). It was re-initialized as a standalone package. So the original plan's
  "rebase each fork onto its upstream head" is **not executable** here — it would be a
  manual re-port, not a rebase.
- Sizing if you ever do want to port: the fork's tree is closest to `v0.5.0` (~298 changed
  lines); upstream moved ~1100 lines between 0.5.0 and 0.6.1, concentrated in the same 13
  files we customized — including `ShieldActionExtension.swift`, which carries the
  LSApplicationWorkspace 2.5.1 rejection fix.
- **Both upstream 0.6.1 and our fork compile clean on SDK 56 and 57.** There is no
  build-driven reason to port.

**Recommendation: do not port.** Porting trades a working fork for a 1100-line merge into
the single most App-Store-sensitive file we own, and buys nothing the build needs.

### `expo-live-activity` (fork of 0.2.1)

- **Upstream is deprecated.** Final commit, 2026-06-01: *"Deprecate expo-live-activity
  library"*, README now says *"This library is deprecated. Consider other solutions like
  expo-widgets."*
- Our fork *does* share ancestry with upstream (merge-base `a9035de`; 29 ours / 38 theirs),
  so a rebase is technically possible — but upstream rewrote exactly the files we
  customized (`LiveActivityView.swift` +268, `LiveActivityWidget.swift` +231,
  `ExpoLiveActivityModule.swift` +174, `src/index.ts` +165), so it would be conflict-heavy.
- **Our fork compiles clean on SDK 57 as-is.**

**Recommendation: do not rebase.** Rebasing onto a deprecated upstream is pure cost. Our
fork is now effectively the maintained copy. Worth a separate, later evaluation of whether
`expo-widgets` should replace it — that's a product decision, not an upgrade blocker.

### `react-native-gesture-handler` patch (95 lines)

**This patch will definitely break.** In 2.32 the component moved from
`src/components/ReanimatedSwipeable.tsx` to a directory
(`src/components/ReanimatedSwipeable/ReanimatedSwipeable.tsx`), so the patch paths no
longer match. The underlying need is still real: 2.32's `SwipeableProps` still does not
declare or apply `failOffsetY`, which `TodoRow.tsx` depends on. Regenerate against the new
layout per the CLAUDE.md patch workflow.

---

## Risks, re-ranked

### 1. ~~Forked native modules~~ → **cleared as a blocker**

See above. Downgraded from "the whole ballgame" to "regenerate the gesture-handler patch."

### 2. Expo Router 5 → 57 — **much smaller than originally assessed**

Expo Router 57 **vendored** React Navigation rather than dropping it (`build/react-navigation/*`).
All six files reduce to import-source swaps — no codemod, no `any`, no CoachMark risk:

| Import | From | To |
|---|---|---|
| `useIsFocused` ×4 | `@react-navigation/native` | `expo-router` |
| `useBottomTabBarHeight` | `@react-navigation/bottom-tabs` | `expo-router/js-tabs` |
| `BottomTabBarProps` | `@react-navigation/bottom-tabs` | `expo-router/js-tabs` |

(`expo-router/js-tabs` → `build/layouts/Tabs` → `export * from '../react-navigation/bottom-tabs'`,
which exports both. Verified on 56 and 57.)

Affected files: `app/(tabs)/insights.tsx`, `app/(tabs)/journal.tsx`,
`src/components/analytics/GoalProgress/GoalProgress.tsx`,
`src/components/journal/TodoSheet/TodoRow.tsx`,
`src/components/journal/TodoSheet/TodoSheet.tsx`, `src/components/ui/TabBar/TabBar.tsx`.

**Non-issue, checked so it doesn't get re-raised:** `SafeAreaProvider` comes from
expo-router's own `ExpoRoot`, not React Navigation — in both 5 and 57. The 10
`useSafeAreaInsets` call sites are safe.

### 3. Reanimated 3.17 → 4.5.1

`useAnimatedGestureHandler` is removed. Exactly two files use it, and both also use the
legacy `<PanGestureHandler>` component, so both need the same rewrite:
- `src/components/ui/Slider/Slider.tsx` (:114, :176)
- `src/components/focus/TagSelector/HorizontalTagSelector.tsx` (:110, :139)

The other 32 reanimated files already use modern APIs. **Can and should be done as pre-flight.**

### 4. Revenue- and review-critical dependencies

| Package | Ours | Latest | Note |
|---|---|---|---|
| `expo-iap` | ^4.3.1 | **5.3.1** | Major bump. Re-test the full paywall + restore flow; we've already taken a 5.1.1 rejection. Not Expo-managed. |
| `crisp-sdk-react-native` | 0.1.4 | 0.4.2 | Support chat. |
| `expo-quick-actions` | ^5.0.0 | 6.0.2 | Major bump. |
| `@kingstinct/react-native-healthkit` | ^14.0.2 | 14.0.2 | Current; peers allow RN ≥0.79, nitro ≥0.35. |
| `@react-native-google-signin/google-signin` | ^16.1.2 | 16.1.4 | Peers allow expo ≥52.0.40. |
| `react-native-nitro-modules` | ^0.35.9 | 0.36.5 | HealthKit depends on it. |
| `posthog-react-native` | ^4.49.3 | 4.63.0 | Lists `@react-navigation/native` as an optional peer — expect a peer warning once expo-router stops pulling it in. |

These are **not** in `bundledNativeModules.json`, so `expo install --fix` will not touch
them. They have to be bumped and tested by hand.

### 5. Mechanical changes

- **`expo-file-system`** — our two call sites use the classic API (`documentDirectory`,
  `getInfoAsync`, `makeDirectoryAsync`, `copyAsync`, `deleteAsync`). All five still exist
  under `expo-file-system/legacy` in SDK 57, so this is a **2-line import change**:
  `src/services/purchasePhotoService.ts:1`, `src/services/sessionPhotoService.ts:1`.
- **`expo/fetch` becomes global `fetch`** — re-verify Supabase, PostHog, and the
  sync/offline-queue paths. This swaps the network implementation under everything.
- **`notification` field in `app.json`** removed in SDK 55 → migrate to the
  `expo-notifications` config plugin.
- **Hermes v1** is the default engine — treat as a full-app perf/behavior re-test.

### 6. Environment blocker (new — not in the original plan)

**System Ruby is 2.6.10; SDK 56+'s Expo-precompiled CocoaPods plugin needs 2.7+.** Raw
`pod install` fails with `undefined method 'filter_map'`. `npx expo prebuild` worked around
it during probing, but this should be fixed properly before the real upgrade — install a
modern Ruby via rbenv or Homebrew.

Related: iOS ships **precompiled XCFrameworks** by default (`EXPO_USE_PRECOMPILED_MODULES=0`
to opt out) — first suspect if native linking ever misbehaves.

### 7. Release logistics

- New SDK ⇒ **new runtime version**: OTA updates will not reach existing users until a new
  binary ships. Plan the store release before touching `update:prod`. Re-check
  `scripts/ota-preflight.sh` assumptions.
- Expo Go for 56+ is not on the App Store — dev builds only. We already use
  `expo-dev-client`, so no practical change.

---

## Execution: one SDK at a time

Repeat for 54 → 55 → 56 → 57. **Do not batch.** Commit at the end of each successful loop.

```bash
npx expo install expo@^54.0.0 --fix     # then ^55, ^56, ^57
npx expo install --check
npx expo-doctor
npx patch-package                        # gesture-handler patch will fail — regenerate
npx expo prebuild --clean
APP_VARIANT=development npx expo prebuild   # local dev install flow
npm run lint
```

Then install on device and run the validation checklist before moving on.

### What the 57 step actually landed (2026-08-15)

Everything code-level had already been handled in the 54/55/56 steps — `useIsFocused`
from `expo-router`, `useBottomTabBarHeight`/`BottomTabBarProps` from `expo-router/js-tabs`,
`expo-file-system/legacy`, and the `useAnimatedGestureHandler`/`PanGestureHandler` rewrites
(zero remaining call sites). The 57 step itself was:

- `expo@^57.0.0 --fix` → RN 0.86.2, React 19.2.3, Reanimated 4.5.1, worklets 0.10.1,
  gesture-handler 2.32.0, expo-router 57.0.13.
- **The gesture-handler patch did NOT break**, contrary to the prediction above — it had
  already been regenerated against the `ReanimatedSwipeable/` directory layout during an
  earlier step. Only the filename version was stale; content is byte-identical.
  Renamed `+2.30.1.patch` → `+2.32.0.patch`.
- **Splash screen migration (a real fix, not just schema cleanup).** SDK 57's config schema
  rejects the legacy `splash` / `ios.splash` / `android.splash` fields. Investigating showed
  the splash was *already silently broken as of the SDK 56 commit*: `expo-splash-screen`'s
  plugin is a no-op when passed no props (`if (props != null)` in `withSplashScreen.js`),
  and it no longer falls back to `config.splash`. The generated storyboard had
  `systemColor systemBackgroundColor` and referenced an image asset that did not exist.
  Fixed by moving the values into the plugin's props with
  `ios.enableFullScreenImage_legacy: true` (our assets are full-screen 1284×2778, and that
  flag is what reproduces the old full-screen `contain` behavior — the new default is a
  100pt-wide centered logo). Verified in the generated output: `SplashScreenLegacy.imageset`
  with light+dark variants, and a `SplashScreenBackground.colorset` resolving to
  `#F5E6D3` / `#1B1C30`.

**Pre-existing debt confirmed unchanged by this step** (do not mistake for regressions):
`npm run lint` already failed at the SDK 56 commit — `eslint-config-expo` 56.0.4 and 57.0.1
are byte-identical, and eslint-plugin-react-hooks was already 7.1.1, so all 258 eslint
errors (mostly React Compiler `react-hooks/immutability`, `refs`, `set-state-in-effect`)
and the 289 prettier files predate 57. `tsc --noEmit` reports 44 errors, down from the
72 recorded at the SDK 53 baseline; the three that look SDK-related
(`expo-notifications` trigger missing `type`, `new EventEmitter({})`,
`unblockSelection({ currentBlocklist })`) sit in files untouched by any upgrade commit.

**Still open:** `expo-iap` is still `^4.3.1` (5.3.1 available) and the other hand-managed
packages in §4 are unbumped — deliberately left out so the SDK jump stays isolated.

**Note on `prebuild --clean`:** required repeatedly, and safe here *because* `ios/` is fully
generated. Re-verify after each step that no manual `ios/` edits crept in.

---

## Validation checklist (on device, after each SDK step)

Ordered by how expensive a miss is. Unchanged from the original plan — and now carrying
*more* weight, since the fork risk moved from "will it compile" to "does it still behave."

- [ ] **Blocklist / shield** — pick apps, save, shield triggers, "open app" action, weekly escalation charge
- [ ] **Live Activity** — start / update / end, idle LA stays alive, Dynamic Island, localized labels
- [ ] **Widgets + intents** — home widget start/stop, stale-unlock guard
- [ ] **Focus session lifecycle** — start, complete, manual entry, fruits awarded, focus rating
- [ ] **Auth transitions** — sign-up (data preserved + uploaded), sign-in to existing (wipe + pull), sign-out (full wipe), user switch, reinstall (Keychain session survives)
- [ ] **Sync** — cold-start merge, offline queue flush, no RLS error storms, no phantom re-upserts
- [ ] **IAP** — paywall loads products, purchase, restore, entitlement pushed on sign-in
- [ ] **Grove** — feed, friends, challenges, block/report
- [ ] **i18n** — all languages render; RTL (ar/ur) has no reload loop; non-Latin font fallback intact
- [ ] **Navigation** — tab bar, modals, CoachMark intros fire once per screen
- [ ] **Notifications** — heartbeat, re-engagement, permissions prompts

---

## Decision note on Expo UI

Expo UI is stable in 56+, so 57 gets it. It ships drop-in replacements for
`@react-native-community/datetimepicker`, `@react-native-community/slider`,
`@react-native-segmented-control/segmented-control`, `@gorhom/bottom-sheet`,
`react-native-pager-view`, and `@react-native-picker/picker`.

We hand-built `Slider`, `Toggle`, `BottomSheet`, and `TabBar`, and use
`@react-native-community/datetimepicker`. Worth confirming Expo UI actually replaces enough
of that to justify adopting it — but note this is now a *separate* decision from the
upgrade. With the fork gate cleared, the upgrade is justified on "get back onto a
maintained SDK" grounds alone.

---

## How the gate was verified (so it can be re-run)

Throwaway projects, no impact on the repo:

1. `create-expo-app` scaffold, pinned to `expo@~57.0.12` / `react-native@0.86.2`.
2. `npm install github:jasperpwu/react-native-device-activity-custom github:jasperpwu/expo-live-activity`
3. `app.json` plugins: `expo-build-properties` (deploymentTarget 18.0),
   `react-native-device-activity` (appGroup), `expo-live-activity` (appGroupIdentifier).
4. `npx expo prebuild --platform ios --clean`
5. Per target: `xcodebuild -workspace probe57.xcworkspace -scheme <T> -sdk iphonesimulator -configuration Debug -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`

Two false alarms encountered, noted so they aren't mistaken for real failures next time:
- Copying a probe directory carries a stale `expo-modules-jsi/apple/.DerivedData` module
  cache with baked-in absolute paths → `missing required module 'SwiftShims'`. Delete it.
- iOS builds are disk-hungry; `lipo`/`rsync` "No space left on device" reads like a build
  error but isn't. Keep 30–50 GB free.

---

## References

- [Upgrading to SDK 56](https://expo.dev/blog/upgrading-to-sdk-56) · [SDK 56 changelog](https://expo.dev/changelog/sdk-56) · [SDK 55](https://expo.dev/changelog/sdk-55) · [SDK 54](https://expo.dev/changelog/sdk-54)
- [Expo UI is now stable](https://expo.dev/blog/expo-ui-stable-sdk-56) · [Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Upgrade Expo SDK walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [NativeWind installation](https://www.nativewind.dev/v5/getting-started/installation)
- [expo-widgets](https://docs.expo.dev/versions/latest/sdk/widgets/) — successor suggested by the deprecated `expo-live-activity`
