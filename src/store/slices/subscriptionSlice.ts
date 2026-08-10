import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getActiveSubscriptions,
  getAvailablePurchases,
  hasActiveSubscriptions,
  restorePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
  type ProductSubscription,
} from 'expo-iap';
import i18n from '../../i18n';
import { SUBSCRIPTION_PRODUCTS } from '../../config/constants';
import { supabase } from '../../config/supabase';
import { AnalyticsTracker } from '../../services/analytics';

export type SubscriptionTier = 'free' | 'premium';

export type MembershipSource = 'none' | 'app_store' | 'referral' | 'manual';

export interface SubscriptionSlice {
  tier: SubscriptionTier;
  expiresAt: string | null;
  productId: string | null;
  membershipSource: MembershipSource;
  products: ProductSubscription[];
  isLoading: boolean;
  error: string | null;

  initializeIAP: () => Promise<void>;
  teardownIAP: () => void;
  loadProducts: () => Promise<void>;
  purchase: (productId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<void>;
  fetchTierFromServer: () => Promise<void>;
  syncEntitlementToServer: () => Promise<void>;
  clearSubscriptionError: () => void;
}

/**
 * Resolve Apple's ORIGINAL transaction id for an active subscription.
 *
 * `profiles.original_transaction_id` must hold the *original* id, because both
 * server functions key off it: `apple-server-notifications` finds the user with
 * `.eq('original_transaction_id', txInfo.originalTransactionId)` and drops the
 * notification when nothing matches, and `subscription-status-cron` only reads a
 * status after `tx.originalTransactionId === subscriber.original_transaction_id`.
 * Store the wrong id and that account silently stops receiving cancellations,
 * expiries and refunds.
 *
 * The catch: `ActiveSubscription` (from `getActiveSubscriptions`) carries only
 * `transactionId`, which is the LATEST transaction — identical to the original
 * on a first purchase, but different after any renewal. `PurchaseIOS` (from
 * `getAvailablePurchases`) is the only shape that exposes
 * `originalTransactionIdentifierIOS`, so look it up there and fall back to the
 * latest id rather than write nothing.
 */
const resolveOriginalTransactionId = async (
  productId: string,
  fallback: string | null
): Promise<string | null> => {
  try {
    const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    const match = (purchases as any[])?.find((p) => p.productId === productId);
    return match?.originalTransactionIdentifierIOS ?? fallback;
  } catch (error: any) {
    console.error('[IAP] Original transaction id lookup failed:', error);
    return fallback;
  }
};

/**
 * Write the device's App Store entitlement onto the signed-in account.
 *
 * Shared by every path that learns about an active subscription (purchase,
 * restore, status re-check) so the receipt row and the profile tier can never
 * drift apart. Caller must have already resolved a user — purchases made while
 * signed out simply skip this and live on the StoreKit entitlement alone.
 */
const persistEntitlementToServer = async (
  userId: string,
  productId: string,
  transactionId: string | null,
  receiptMeta?: Record<string, unknown>
) => {
  const { error: receiptError } = await supabase.from('subscription_receipts').upsert(
    {
      user_id: userId,
      product_id: productId,
      original_transaction_id: transactionId,
      raw_receipt: {
        purchaseToken: transactionId,
        productId,
        platform: 'ios',
        ...receiptMeta,
      },
    },
    { onConflict: 'user_id' }
  );

  if (receiptError) {
    console.error('[IAP] Receipt upsert error:', receiptError);
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      subscription_tier: 'premium',
      membership_source: 'app_store',
      original_transaction_id: transactionId,
    })
    .eq('id', userId);

  if (profileError) {
    console.error('[IAP] Profile update error:', profileError);
  }
};

let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

// Analytics only: true between the user confirming a plan and StoreKit delivering
// the result. `purchaseUpdatedListener` also fires for renewals and (depending on
// how AppStore.sync surfaces transactions) potentially restores, none of which are
// conversions. Gating subscription_started on this flag keeps the monetization
// funnel to purchases the user actually initiated from our paywall.
let purchaseInitiatedByUser = false;

export const createSubscriptionSlice = (set: any, get: any): SubscriptionSlice => ({
  tier: 'free',
  expiresAt: null,
  productId: null,
  membershipSource: 'none',
  products: [],
  isLoading: false,
  error: null,

  initializeIAP: async () => {
    try {
      console.log('[IAP] Initializing connection...');
      const connected = await initConnection();
      console.log('[IAP] Connection result:', connected);

      // Listen for purchase updates
      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
        try {
          // Persist subscription to Supabase (direct DB write, no Edge Function
          // needed). No user is a legitimate state, not a failure: buying does
          // not require an account (guideline 5.1.1), so the entitlement stays
          // on StoreKit + local state until the user chooses to sign in, at
          // which point syncEntitlementToServer() attaches it to the account.
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // `originalTransactionIdentifierIOS`, not `transactionId`: the two
            // are equal on a first purchase but diverge on renewals, and this
            // listener fires for renewals too. See resolveOriginalTransactionId.
            const originalTransactionId =
              (purchase as any).originalTransactionIdentifierIOS ?? purchase.transactionId ?? null;
            await persistEntitlementToServer(user.id, purchase.productId, originalTransactionId);
          }

          // Finish transaction
          await finishTransaction({ purchase, isConsumable: false });

          // Update local state
          set((state: any) => ({
            subscription: {
              ...state.subscription,
              tier: 'premium',
              membershipSource: 'app_store',
              productId: purchase.productId,
              isLoading: false,
              error: null,
            },
          }));

          // Analytics: bottom of the monetization funnel. Fired here rather than in
          // `purchase()` because that only *requests* the purchase — StoreKit
          // delivers the actual result through this listener, so this is the only
          // place a subscription is genuinely confirmed. is_premium is a person
          // property so every other chart can be split free-vs-paid.
          if (purchaseInitiatedByUser) {
            purchaseInitiatedByUser = false;
            AnalyticsTracker.track(
              'subscription_started',
              { product_id: purchase.productId },
              {
                set: { is_premium: true },
                setOnce: { first_subscribed_at: new Date().toISOString() },
              }
            );
          } else {
            // Renewal or restore — premium state is still true, so keep the cohort
            // property current without counting a conversion.
            AnalyticsTracker.setPersonProperties({ is_premium: true });
          }
        } catch (error: any) {
          console.error('Purchase verification error:', error);
          set((state: any) => ({
            subscription: {
              ...state.subscription,
              isLoading: false,
              error: error.message || 'Purchase verification failed',
            },
          }));
        }
      });

      purchaseErrorSub = purchaseErrorListener((error) => {
        // Clear the analytics in-flight flag on any failure, or a later renewal
        // would inherit it and be miscounted as a conversion.
        purchaseInitiatedByUser = false;
        // user-cancelled is not a real error
        if (error.code === 'user-cancelled') {
          set((state: any) => ({
            subscription: { ...state.subscription, isLoading: false },
          }));
          return;
        }
        console.error('Purchase error:', error);
        set((state: any) => ({
          subscription: {
            ...state.subscription,
            isLoading: false,
            error: error.message || 'Purchase failed',
          },
        }));
      });
    } catch (error: any) {
      console.error('[IAP] Connection error:', error);
    }
  },

  teardownIAP: () => {
    purchaseUpdateSub?.remove();
    purchaseErrorSub?.remove();
    purchaseUpdateSub = null;
    purchaseErrorSub = null;
    endConnection().catch(console.error);
  },

  loadProducts: async () => {
    set((state: any) => ({
      subscription: { ...state.subscription, isLoading: true },
    }));

    try {
      console.log('[IAP] Loading products with SKUs:', SUBSCRIPTION_PRODUCTS);
      const result = await fetchProducts({
        skus: [SUBSCRIPTION_PRODUCTS.monthly, SUBSCRIPTION_PRODUCTS.yearly],
        type: 'subs',
      });
      console.log('[IAP] Products loaded:', JSON.stringify(result, null, 2));

      set((state: any) => ({
        subscription: {
          ...state.subscription,
          products: (result as ProductSubscription[]) ?? [],
          isLoading: false,
        },
      }));
    } catch (error: any) {
      console.error('[IAP] Failed to load products:', error);
      set((state: any) => ({
        subscription: {
          ...state.subscription,
          isLoading: false,
          error: error.message || 'Failed to load products',
        },
      }));
    }
  },

  purchase: async (productId: string) => {
    set((state: any) => ({
      subscription: { ...state.subscription, isLoading: true, error: null },
    }));

    purchaseInitiatedByUser = true;
    try {
      await requestPurchase({
        request: {
          apple: { sku: productId },
        },
        type: 'subs',
      });
      // Result comes via purchaseUpdatedListener
    } catch (error: any) {
      purchaseInitiatedByUser = false;
      // User cancellation is not a real error
      const msg = error.message || '';
      if (msg.includes('cancelled') || msg.includes('canceled')) {
        set((state: any) => ({
          subscription: { ...state.subscription, isLoading: false },
        }));
        return;
      }
      console.error('Purchase request error:', error);
      set((state: any) => ({
        subscription: {
          ...state.subscription,
          isLoading: false,
          error: msg || 'Purchase request failed',
        },
      }));
    }
  },

  restorePurchases: async () => {
    set((state: any) => ({
      subscription: { ...state.subscription, isLoading: true, error: null },
    }));

    try {
      await restorePurchases();

      const isActive = await hasActiveSubscriptions([
        SUBSCRIPTION_PRODUCTS.monthly,
        SUBSCRIPTION_PRODUCTS.yearly,
      ]);

      if (isActive) {
        const subs = await getActiveSubscriptions([
          SUBSCRIPTION_PRODUCTS.monthly,
          SUBSCRIPTION_PRODUCTS.yearly,
        ]);

        // `getActiveSubscriptions` is a misnomer: it returns every entitlement
        // in `Transaction.currentEntitlements` that isn't an upgrade — expired
        // and cancelled ones included, flagged `isActive: false`. Only
        // `hasActiveSubscriptions` filters on that flag. Taking [0] blindly
        // could therefore persist a lapsed monthly over the live yearly (the
        // enumeration order is not guaranteed) and pin the wrong product/
        // transaction id onto the profile.
        const activeSub = (subs as any[])?.find((s) => s.isActive);

        // Persist restored subscription to Supabase. Restoring works signed out
        // too — the local tier below is what unlocks the app in that case.
        const { data: { user } } = await supabase.auth.getUser();
        if (user && activeSub) {
          await persistEntitlementToServer(
            user.id,
            activeSub.productId,
            await resolveOriginalTransactionId(activeSub.productId, activeSub.transactionId ?? null),
            { restored: true }
          );
        }

        set((state: any) => ({
          subscription: {
            ...state.subscription,
            tier: 'premium',
            membershipSource: 'app_store',
            productId: activeSub?.productId ?? null,
            isLoading: false,
          },
        }));
      } else {
        // Nothing to restore. Only clear an App Store tier — premium granted by
        // referral or manually lives on the server and must survive this.
        //
        // Say so out loud: this used to end in silence, so a tap on "Restore
        // Purchases" with nothing to restore was indistinguishable from a dead
        // button. Surfaced through `error` because that is the one slot the pay
        // sheet already renders (a global toast can't paint over a native
        // Modal), and it is genuinely the outcome of a failed user intent.
        set((state: any) => ({
          subscription: {
            ...state.subscription,
            ...(state.subscription.membershipSource === 'referral' ||
            state.subscription.membershipSource === 'manual'
              ? {}
              : { tier: 'free', productId: null }),
            isLoading: false,
            error: i18n.t('subscription.nothingToRestore'),
          },
        }));
      }
    } catch (error: any) {
      console.error('Restore purchases error:', error);
      set((state: any) => ({
        subscription: {
          ...state.subscription,
          isLoading: false,
          error: error.message || 'Restore failed',
        },
      }));
    }
  },

  checkSubscriptionStatus: async () => {
    try {
      // Check StoreKit locally for optimistic UI
      const isActive = await hasActiveSubscriptions([
        SUBSCRIPTION_PRODUCTS.monthly,
        SUBSCRIPTION_PRODUCTS.yearly,
      ]);

      if (isActive) {
        // StoreKit says active — set optimistic premium locally
        set((state: any) => ({
          subscription: { ...state.subscription, tier: 'premium', membershipSource: 'app_store' },
        }));
        // Attach it to the account if there is one. This is what carries a
        // subscription bought while signed out onto the profile the first time
        // the user signs in (no-op when signed out, or already recorded).
        await get().subscription.syncEntitlementToServer();
      }

      // Defer to the server for entitlements it alone knows about (referral,
      // manual grants, expiry recorded by webhooks).
      await get().subscription.fetchTierFromServer();

      // StoreKit is the authority for App Store premium in BOTH directions, and
      // this runs after the server fetch so `membershipSource` already reflects
      // whatever the profile granted.
      const { tier, membershipSource } = get().subscription;

      if (isActive && tier !== 'premium') {
        // Never let a stale/unreachable profile row take Premium away from a
        // device whose subscription is genuinely active. Buying requires no
        // account, so the write above can legitimately have failed (offline, or
        // signed out entirely) — or there may be no profile row at all.
        set((state: any) => ({
          subscription: { ...state.subscription, tier: 'premium', membershipSource: 'app_store' },
        }));
      } else if (
        !isActive &&
        tier === 'premium' &&
        membershipSource !== 'referral' &&
        membershipSource !== 'manual'
      ) {
        // The App Store subscription is gone (cancelled, expired, refunded) —
        // drop to free. Signed-in users are also corrected server-side by
        // subscription-status-cron, but a signed-out subscriber has no profile
        // row, so without this Premium would survive cancellation forever.
        //
        // Safe against a StoreKit outage: hasActiveSubscriptions() calls
        // ensureConnection() and THROWS when the store is unreachable, which the
        // catch below swallows — we only ever revoke on a definite `false`.
        // Referral/manual grants are server-owned and exempt.
        set((state: any) => ({
          subscription: {
            ...state.subscription,
            tier: 'free',
            productId: null,
            expiresAt: null,
          },
        }));
      }
    } catch (error: any) {
      console.error('Subscription status check error:', error);
    }
  },

  fetchTierFromServer: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // maybeSingle (not single): on a fresh reinstall fetchTierFromServer can
      // run before the profile row exists for the authenticated user (mount-time
      // call races ahead of the signup trigger / sign-in reconciliation). single()
      // would turn that benign "0 rows" state into a logged PGRST116 error; with
      // maybeSingle a missing profile is data:null and we simply no-op below.
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, membership_source, subscription_expires_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[IAP] Failed to fetch tier from server:', error);
        return;
      }

      if (profile) {
        set((state: any) => ({
          subscription: {
            ...state.subscription,
            tier: profile.subscription_tier as SubscriptionTier,
            membershipSource: (profile.membership_source ?? 'none') as MembershipSource,
            expiresAt: profile.subscription_expires_at ?? null,
          },
        }));
      }
    } catch (error: any) {
      console.error('[IAP] fetchTierFromServer error:', error);
    }
  },

  /**
   * Push the device's active App Store subscription onto the signed-in account.
   *
   * The bridge between "bought without an account" (guideline 5.1.1 — we cannot
   * require registration to purchase) and "usable on my other devices": the
   * moment a subscriber signs in, their existing entitlement is written to the
   * profile, so every other device of theirs picks it up from the server.
   *
   * Reads current entitlements only — no `AppStore.sync()`, so it never triggers
   * an Apple ID password prompt. Safe to call on every sign-in / foreground.
   */
  syncEntitlementToServer: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const subs = await getActiveSubscriptions([
        SUBSCRIPTION_PRODUCTS.monthly,
        SUBSCRIPTION_PRODUCTS.yearly,
      ]);
      // `.find(isActive)`, not [0] — see the note in restorePurchases: this
      // list includes expired/cancelled entitlements.
      const activeSub = (subs as any[])?.find((s) => s.isActive);
      if (!activeSub) return;

      await persistEntitlementToServer(
        user.id,
        activeSub.productId,
        await resolveOriginalTransactionId(activeSub.productId, activeSub.transactionId ?? null)
      );
    } catch (error: any) {
      console.error('[IAP] syncEntitlementToServer error:', error);
    }
  },

  clearSubscriptionError: () => {
    set((state: any) => ({
      subscription: { ...state.subscription, error: null },
    }));
  },
});
