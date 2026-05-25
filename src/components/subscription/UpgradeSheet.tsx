import React, { useEffect } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { useAppStore } from '../../store';
import { SUBSCRIPTION_PRODUCTS } from '../../config/constants';
interface UpgradeSheetProps {
  isVisible: boolean;
  onClose: () => void;
}

export const UpgradeSheet: React.FC<UpgradeSheetProps> = ({ isVisible, onClose }) => {
  const { products, isLoading, error } = useAppStore((state) => state.subscription);
  const loadProducts = useAppStore((state) => state.subscription.loadProducts);
  const purchase = useAppStore((state) => state.subscription.purchase);
  const restorePurchases = useAppStore((state) => state.subscription.restorePurchases);

  useEffect(() => {
    if (isVisible && products.length === 0) {
      loadProducts();
    }
  }, [isVisible]);

  const monthlyProduct = products.find(
    (p: any) => p.id === SUBSCRIPTION_PRODUCTS.monthly
  );
  const yearlyProduct = products.find(
    (p: any) => p.id === SUBSCRIPTION_PRODUCTS.yearly
  );

  const handlePurchase = async (id: string) => {
    await purchase(id);
    onClose();
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} height={480}>
      <Typography variant="headline-20" color="primary" className="mb-2">
        Upgrade to Premium
      </Typography>
      <Typography variant="body-14" color="secondary" className="mb-6">
        Unlock unlimited tags, unlimited goals, and more.
      </Typography>

      {isLoading && products.length === 0 ? (
        <View className="items-center py-8">
          <ActivityIndicator size="small" color="#8B7FFF" />
        </View>
      ) : (
        <View className="gap-3">
          {/* Monthly option */}
          <Pressable
            onPress={() =>
              monthlyProduct && handlePurchase(monthlyProduct.id)
            }
            disabled={isLoading || !monthlyProduct}
            className="bg-light-border/30 dark:bg-[#2A2B4A] rounded-2xl p-4 border border-light-border dark:border-dark-border active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Typography variant="subtitle-14-medium" color="primary">
                  Monthly
                </Typography>
                <Typography variant="body-12" color="secondary" className="mt-0.5">
                  Billed monthly
                </Typography>
              </View>
              <Typography variant="subtitle-14-semibold" color="primary">
                {monthlyProduct?.displayPrice ?? '...'}
              </Typography>
            </View>
          </Pressable>

          {/* Yearly option */}
          <Pressable
            onPress={() =>
              yearlyProduct && handlePurchase(yearlyProduct.id)
            }
            disabled={isLoading || !yearlyProduct}
            className="bg-light-border/30 dark:bg-[#2A2B4A] rounded-2xl p-4 border border-light-border dark:border-dark-border active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Typography variant="subtitle-14-medium" color="primary">
                  Yearly
                </Typography>
                <Typography variant="body-12" color="secondary" className="mt-0.5">
                  Best value — save ~40%
                </Typography>
              </View>
              <Typography variant="subtitle-14-semibold" color="primary">
                {yearlyProduct?.displayPrice ?? '...'}
              </Typography>
            </View>
          </Pressable>
        </View>
      )}

      {isLoading && products.length > 0 ? (
        <View className="items-center py-4">
          <ActivityIndicator size="small" color="#8B7FFF" />
        </View>
      ) : null}

      {error ? (
        <Typography variant="body-12" className="text-[#FF6B6B] mt-3 text-center">
          {error}
        </Typography>
      ) : null}

      {/* Restore purchases link */}
      <Pressable
        onPress={restorePurchases}
        disabled={isLoading}
        className="mt-4 items-center active:opacity-70"
      >
        <Typography variant="body-12" color="secondary">
          Restore Purchases
        </Typography>
      </Pressable>

      {/* Terms */}
      <Typography
        variant="tiny-10"
        color="secondary"
        className="mt-4 text-center"
      >
        Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.
      </Typography>
    </BottomSheet>
  );
};
