Signup + Payment + Data Sync — Implementation Plan     

 Context

 Bittersweet is currently a fully offline iOS app. All user data (sessions, tags,
 goals, fruits) lives in local Zustand stores persisted to AsyncStorage. There is
 no user identity, no backend, and no payment system.

 This plan adds three foundational capabilities:
 1. Apple Sign-In — account creation via Supabase Auth
 2. Subscription — monthly/yearly premium via StoreKit 2
 3. Data Sync — local-first sync to Supabase (backup, cross-device, social
 foundation)

 Constraints: Offline users must experience zero changes. Sync is additive — the
 local store remains the UI source of truth.

 ---
 Libraries to Install

 ┌───────────────────────────┬─────────┬───────────────────────────────────────┐
 │          Package          │ Version │                Purpose                │
 ├───────────────────────────┼─────────┼───────────────────────────────────────┤
 │ @supabase/supabase-js     │ ^2.49.9 │ Supabase client (auth, DB, edge       │
 │                           │         │ functions)                            │
 ├───────────────────────────┼─────────┼───────────────────────────────────────┤
 │ expo-apple-authentication │ ~7.2.0  │ Native Apple Sign-In                  │
 ├───────────────────────────┼─────────┼───────────────────────────────────────┤
 │ expo-iap                  │ 3.0.0   │ StoreKit 2 subscriptions              │
 └───────────────────────────┴─────────┴───────────────────────────────────────┘

 Metro fix required: Expo 53 sets unstable_enablePackageExports = true by default,
  which breaks @supabase/supabase-js (ws/stream.js import error). Must set it to
 false in metro.config.js before the withNativeWind call.

 Prebuild required: After installing expo-apple-authentication and expo-iap, a npx
  expo prebuild --clean is needed for native module linking.

 ---
 Phase 1: Infrastructure Setup

 1.1 — metro.config.js (modify)

 Add config.resolver.unstable_enablePackageExports = false; before
 withNativeWind(config, ...).

 1.2 — app.json (modify)

 - Add "expo-apple-authentication" to plugins array
 - Add "expo-iap" to plugins array
 - The Sign in with Apple entitlement is auto-added by the
 expo-apple-authentication plugin

 1.3 — .env (create)

 EXPO_PUBLIC_SUPABASE_URL=<your-project-url>
 EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

 1.4 — src/config/constants.ts (modify)

 Add subscription product IDs:
 export const SUBSCRIPTION_PRODUCTS = {
   monthly: 'com.path2us.bittersweet.premium.monthly',
   yearly: 'com.path2us.bittersweet.premium.yearly',
 };

 1.5 — src/config/supabase.ts (create)

 Initialize Supabase client with:
 - URL and anon key from env vars
 - Custom SecureStoreAdapter using expo-secure-store (not AsyncStorage) for auth
 token storage
 - autoRefreshToken: true, persistSession: true

 ---
 Phase 2: Supabase Backend (manual setup in Supabase Dashboard)

 2.1 — Auth Configuration

 - Enable Apple provider in Supabase Dashboard > Authentication > Providers
 - Add bundle ID com.path2us.bittersweet (native iOS uses signInWithIdToken, no
 OAuth redirect needed)

 2.2 — Database Schema

 Tables (all with RLS — users can only access their own rows):

 ┌───────────────────────┬────────────────────┬───────────────────────────────┐
 │         Table         │    Primary Key     │          Key Columns          │
 ├───────────────────────┼────────────────────┼───────────────────────────────┤
 │                       │                    │ display_name,                 │
 │ profiles              │ id (uuid, refs     │ subscription_tier,            │
 │                       │ auth.users)        │ subscription_expires_at,      │
 │                       │                    │ original_transaction_id       │
 ├───────────────────────┼────────────────────┼───────────────────────────────┤
 │                       │ id (text,          │ user_id, start_time,          │
 │ focus_sessions        │ client-generated)  │ end_time, duration, tag_id,   │
 │                       │                    │ notes, deleted_at             │
 ├───────────────────────┼────────────────────┼───────────────────────────────┤
 │                       │ id (text,          │ user_id, name, icon, color,   │
 │ session_tags          │ client-generated)  │ usage_count, sort_order,      │
 │                       │                    │ deleted_at                    │
 ├───────────────────────┼────────────────────┼───────────────────────────────┤
 │                       │ id (text,          │ user_id, name,                │
 │ focus_goals           │ client-generated)  │ target_minutes, period,       │
 │                       │                    │ tag_ids[], deleted_at         │
 ├───────────────────────┼────────────────────┼───────────────────────────────┤
 │ rewards               │ user_id (uuid)     │ balance, total_earned,        │
 │                       │                    │ total_spent                   │
 ├───────────────────────┼────────────────────┼───────────────────────────────┤
 │ reward_transactions   │ id (text)          │ user_id, amount, type,        │
 │                       │                    │ source, metadata(jsonb)       │
 ├───────────────────────┼────────────────────┼───────────────────────────────┤
 │                       │                    │ user_id, product_id,          │
 │ subscription_receipts │ id (uuid, auto)    │ original_transaction_id,      │
 │                       │                    │ expires_date,                 │
 │                       │                    │ raw_receipt(jsonb)            │
 └───────────────────────┴────────────────────┴───────────────────────────────┘

 Trigger: Auto-create profiles + rewards row on new user signup.

 Soft deletes: Sessions, tags, and goals use deleted_at instead of hard deletes to
  prevent sync conflicts.

 2.3 — Edge Function: verify-subscription

 Receives StoreKit 2 JWS transaction, verifies signature via Apple's certificate
 chain, upserts receipt, updates profiles.subscription_tier.

 ---
 Phase 3: Auth Implementation

 3.1 — src/store/slices/authSlice.ts (create)

 State: user { id, email, fullName, avatarUrl } | null, isAuthenticated,
 isLoading, error
 Actions: signInWithApple(), signOut(), restoreSession(), deleteAccount()

 signInWithApple flow:
 1. Call AppleAuthentication.signInAsync() to get identityToken + fullName
 2. Call supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken
  })
 3. Store fullName via supabase.auth.updateUser() (Apple only sends name on first
 sign-in)
 4. Update auth slice state

 3.2 — src/store/index.ts (modify)

 Add auth: AuthSlice to AppStore interface and create() composition.

 3.3 — src/store/middleware/persistence.ts (modify)

 Add auth: { user, isAuthenticated } to partialize. Bump version 1 -> 2 with
 migration.

 3.4 — src/components/auth/AccountSection.tsx (create)

 Settings section component:
 - Signed out: Apple Sign-In button + pitch text ("Sync data across devices")
 - Signed in: User email, subscription tier badge, sign-out button

 3.5 — app/(tabs)/settings.tsx (modify)

 Add <AccountSection /> as the first section in settings.

 3.6 — app/_layout.tsx (modify)

 - Add supabase.auth.onAuthStateChange() listener
 - Call restoreSession() during hydration

 ---
 Phase 4: Subscription Implementation

 4.1 — src/store/slices/subscriptionSlice.ts (create)

 State: tier ('free'|'premium'), expiresAt, productId, products[], isLoading,
 error
 Actions: loadProducts(), purchase(productId), restorePurchases(),
 verifySubscription()

 4.2 — src/components/subscription/UpgradeSheet.tsx (create)

 Bottom sheet with monthly/yearly pricing cards and purchase buttons.

 4.3 — src/components/subscription/SubscriptionGate.tsx (create)

 Wrapper component: renders children if premium, otherwise shows upgrade prompt.

 4.4 — app/(tabs)/settings.tsx (modify)

 Show subscription status in Account section. Add "Manage Subscription" /
 "Upgrade" button.

 4.5 — App Store Connect (manual)

 Create subscription group with monthly + yearly products. Configure sandbox
 testers.

 4.6 — Feature gating

 ┌──────────────────────────┬─────────────────┐
 │           Free           │     Premium     │
 ├──────────────────────────┼─────────────────┤
 │ Full app experience      │ Unlimited tags  │
 ├──────────────────────────┼─────────────────┤
 │ Full cloud sync & backup │ Unlimited goals │
 ├──────────────────────────┼─────────────────┤
 │ Grove social features    │                 │
 ├──────────────────────────┼─────────────────┤
 │ Max 3 tags               │                 │
 ├──────────────────────────┼─────────────────┤
 │ Max 1 goal               │                 │
 └──────────────────────────┴─────────────────┘

 Implementation: Add useSubscriptionGate() hook that checks tag/goal counts before
  creation. When the user hits the limit, show <UpgradeSheet />. Gate lives in the
  createTag() and createGoal() store actions (or at the UI layer before calling
 them).

 ---
 Phase 5: Data Sync Implementation

 5.1 — src/services/sync/SyncMapper.ts (create)

 Bidirectional mapping between Zustand state (camelCase, Date objects) and
 Supabase rows (snake_case, ISO strings). Handles the normalized { byId, allIds }
 structure.

 5.2 — src/services/sync/SyncQueue.ts (create)

 Offline operation queue persisted to AsyncStorage:
 Entry: { table, operation: 'upsert'|'soft_delete', data, timestamp }
 Flushes in-order on connectivity restoration.

 5.3 — src/services/sync/SyncService.ts (create)

 Core sync orchestrator:
 - initialUpload(localState) — batch-insert all local data on first sign-in
 (chunks of 100)
 - pullAll() — fetch all user data from Supabase, return as store-shaped snapshot
 - merge(local, remote) — last-write-wins on updatedAt, union of unique IDs
 - enqueue(operation) — add to offline queue
 - flush() — push queued operations to Supabase with 2s debounce

 5.4 — src/store/slices/syncSlice.ts (create)

 State: lastSyncTime, isSyncing, syncError, offlineQueueSize, syncStatus
 Actions: triggerSync(), initialUpload(), pullFromCloud(), flushOfflineQueue()

 5.5 — src/store/middleware/syncMiddleware.ts (create)

 Zustand middleware that:
 1. Subscribes to store changes via subscribe()
 2. Diffs syncable slices (focus, rewards) against last-synced snapshot
 3. If diff detected and user is authenticated: enqueue sync operations
 4. Debounce 2s, then batch-push

 This keeps existing slice code 100% untouched — sync is a transparent layer.

 5.6 — src/store/index.ts (modify)

 Add sync: SyncSlice, wrap store with sync middleware.

 5.7 — app/_layout.tsx (modify)

 - On auth state SIGNED_IN: check if first sign-in (no cloud data) ->
 initialUpload(), else -> pullFromCloud() + merge
 - On app foreground: flushOfflineQueue() if authenticated
 - Show sync status indicator (optional, subtle)

 ---
 Implementation Order Summary

 Phase 1: Infrastructure (metro, app.json, deps, supabase client)
    |
 Phase 2: Supabase backend (dashboard + SQL — done outside the app)
    |
 Phase 3: Auth (slice, UI, settings integration)
    |
 Phase 4: Subscription (slice, UI, edge function, App Store Connect)
    |
 Phase 5: Sync (mapper, queue, service, middleware, layout wiring)

 Phases 3 and 4 can be developed in parallel since they're independent. Phase 5
 depends on both (sync requires auth to know the user, and subscription to gate
 sync depth).

 ---
 Files Changed/Created Summary

 ┌────────┬──────────────────────────────────────────────────┐
 │ Action │                       File                       │
 ├────────┼──────────────────────────────────────────────────┤
 │ Modify │ metro.config.js                                  │
 ├────────┼──────────────────────────────────────────────────┤
 │ Modify │ app.json                                         │
 ├────────┼──────────────────────────────────────────────────┤
 │ Modify │ src/config/constants.ts                          │
 ├────────┼──────────────────────────────────────────────────┤
 │ Modify │ src/store/index.ts                               │
 ├────────┼──────────────────────────────────────────────────┤
 │ Modify │ src/store/middleware/persistence.ts              │
 ├────────┼──────────────────────────────────────────────────┤
 │ Modify │ app/(tabs)/settings.tsx                          │
 ├────────┼──────────────────────────────────────────────────┤
 │ Modify │ app/_layout.tsx                                  │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ .env                                             │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/config/supabase.ts                           │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/store/slices/authSlice.ts                    │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/store/slices/subscriptionSlice.ts            │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/store/slices/syncSlice.ts                    │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/store/middleware/syncMiddleware.ts           │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/services/sync/SyncService.ts                 │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/services/sync/SyncQueue.ts                   │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/services/sync/SyncMapper.ts                  │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/services/sync/index.ts                       │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/components/auth/AccountSection.tsx           │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/components/subscription/UpgradeSheet.tsx     │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ src/components/subscription/SubscriptionGate.tsx │
 ├────────┼──────────────────────────────────────────────────┤
 │ Create │ supabase/functions/verify-subscription/index.ts  │
 └────────┴──────────────────────────────────────────────────┘

 ---
 Verification Plan

 1. Auth: Sign in with Apple in Settings > Account. Verify Supabase dashboard
 shows new user. Sign out and back in — session restores.
 2. Subscription: Purchase sandbox subscription. Verify edge function validates
 receipt. Check profiles.subscription_tier = 'premium' in Supabase.
 3. Initial sync: Sign in on fresh install with existing local data. Verify all
 sessions, tags, goals, rewards appear in Supabase tables.
 4. Cross-device: Sign in on second device. Verify all data appears locally from
 cloud pull.
 5. Ongoing sync: Complete a focus session while signed in. Verify it appears in
 Supabase within 2-3 seconds.
 6. Offline resilience: Enable airplane mode, complete a session, disable airplane
  mode. Verify session syncs after reconnect.
 7. No regression: Use the app without signing in. Verify all existing
 functionality works identically.