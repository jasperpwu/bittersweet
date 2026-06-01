import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getActiveSubscriptions,
  hasActiveSubscriptions,
  restorePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
  type ProductSubscription,
} from 'expo-iap';
import { SUBSCRIPTION_PRODUCTS } from '../../config/constants';
import { supabase } from '../../config/supabase';

export type SubscriptionTier = 'free' | 'premium';

export interface SubscriptionSlice {
  tier: SubscriptionTier;
  expiresAt: string | null;
  productId: string | null;
  products: ProductSubscription[];
  isLoading: boolean;
  error: string | null;

  initializeIAP: () => Promise<void>;
  teardownIAP: () => void;
  loadProducts: () => Promise<void>;
  purchase: (productId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<void>;
  clearSubscriptionError: () => void;
}

let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

export const createSubscriptionSlice = (set: any, get: any): SubscriptionSlice => ({
  tier: 'free',
  expiresAt: null,
  productId: null,
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
          // Persist subscription to Supabase (direct DB write, no Edge Function needed)
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Upsert receipt record
            const { error: receiptError } = await supabase
              .from('subscription_receipts')
              .upsert(
                {
                  user_id: user.id,
                  product_id: purchase.productId,
                  original_transaction_id: purchase.transactionId,
                  raw_receipt: {
                    purchaseToken: purchase.transactionId,
                    productId: purchase.productId,
                    platform: 'ios',
                  },
                },
                { onConflict: 'user_id' }
              );

            if (receiptError) {
              console.error('[IAP] Receipt upsert error:', receiptError);
            }

            // Update profile tier
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                subscription_tier: 'premium',
                original_transaction_id: purchase.transactionId,
              })
              .eq('id', user.id);

            if (profileError) {
              console.error('[IAP] Profile update error:', profileError);
            }
          }

          // Finish transaction
          await finishTransaction({ purchase, isConsumable: false });

          // Update local state
          set((state: any) => ({
            subscription: {
              ...state.subscription,
              tier: 'premium',
              productId: purchase.productId,
              isLoading: false,
              error: null,
            },
          }));
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

    try {
      await requestPurchase({
        request: {
          apple: { sku: productId },
        },
        type: 'subs',
      });
      // Result comes via purchaseUpdatedListener
    } catch (error: any) {
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

        const activeSub = (subs as any[])?.[0];

        // Persist restored subscription to Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user && activeSub) {
          const { error: receiptError } = await supabase
            .from('subscription_receipts')
            .upsert(
              {
                user_id: user.id,
                product_id: activeSub.productId,
                original_transaction_id: activeSub.transactionId ?? null,
                raw_receipt: {
                  purchaseToken: activeSub.transactionId,
                  productId: activeSub.productId,
                  platform: 'ios',
                  restored: true,
                },
              },
              { onConflict: 'user_id' }
            );

          if (receiptError) {
            console.error('[IAP] Restore receipt upsert error:', receiptError);
          }

          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              subscription_tier: 'premium',
              original_transaction_id: activeSub.transactionId ?? null,
            })
            .eq('id', user.id);

          if (profileError) {
            console.error('[IAP] Restore profile update error:', profileError);
          }
        }

        set((state: any) => ({
          subscription: {
            ...state.subscription,
            tier: 'premium',
            productId: activeSub?.productId ?? null,
            isLoading: false,
          },
        }));
      } else {
        set((state: any) => ({
          subscription: {
            ...state.subscription,
            tier: 'free',
            productId: null,
            isLoading: false,
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
      const isActive = await hasActiveSubscriptions([
        SUBSCRIPTION_PRODUCTS.monthly,
        SUBSCRIPTION_PRODUCTS.yearly,
      ]);

      const currentTier = get().subscription.tier;

      if (isActive) {
        set((state: any) => ({
          subscription: { ...state.subscription, tier: 'premium' },
        }));

        // Sync to DB if tier changed
        if (currentTier !== 'premium') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('profiles')
              .update({ subscription_tier: 'premium' })
              .eq('id', user.id);
          }
        }
      } else {
        set((state: any) => ({
          subscription: {
            ...state.subscription,
            tier: 'free',
            productId: null,
            expiresAt: null,
          },
        }));

        // Sync to DB if tier changed
        if (currentTier !== 'free') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('profiles')
              .update({ subscription_tier: 'free', original_transaction_id: null })
              .eq('id', user.id);
          }
        }
      }
    } catch (error: any) {
      console.error('Subscription status check error:', error);
    }
  },

  clearSubscriptionError: () => {
    set((state: any) => ({
      subscription: { ...state.subscription, error: null },
    }));
  },
});
