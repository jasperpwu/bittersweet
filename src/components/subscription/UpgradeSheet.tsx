import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator, Linking, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';
import { useAppStore } from '../../store';
import { SUBSCRIPTION_PRODUCTS, LEGAL_URLS } from '../../config/constants';
import { colors } from '../../config/theme';
import { PREMIUM_PERKS } from './premiumPerks';
import { AnalyticsTracker } from '../../services/analytics';

interface UpgradeSheetProps {
  isVisible: boolean;
  onClose: () => void;
  /** Which gate opened the paywall — becomes the `source` on `paywall_viewed`. */
  source?: string;
}

type PlanKey = 'yearly' | 'monthly';

/**
 * Format a numeric `amount` using the same currency style as a reference
 * StoreKit-formatted string (e.g. "$59.99" → "$4.99", "59,99 €" → "4,99 €").
 * Avoids depending on Intl currency formatting (unreliable under Hermes) by
 * reusing the symbol/placement the platform already gave us in `displayPrice`.
 */
const formatFromTemplate = (template: string, amount: number): string => {
  const match = template.match(/[\d.,\s]*\d/);
  if (!match || match.index === undefined) return amount.toFixed(2);
  const numStr = match[0];
  const prefix = template.slice(0, match.index);
  const suffix = template.slice(match.index + numStr.length);
  const usesComma = numStr.lastIndexOf(',') > numStr.lastIndexOf('.');
  const formatted = usesComma ? amount.toFixed(2).replace('.', ',') : amount.toFixed(2);
  return `${prefix}${formatted}${suffix}`;
};

export const UpgradeSheet: React.FC<UpgradeSheetProps> = ({ isVisible, onClose, source }) => {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const { products, isLoading, error } = useAppStore((state) => state.subscription);
  const loadProducts = useAppStore((state) => state.subscription.loadProducts);
  const purchase = useAppStore((state) => state.subscription.purchase);
  const restorePurchases = useAppStore((state) => state.subscription.restorePurchases);

  // Select-then-confirm: yearly is pre-selected as the best-value default.
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('yearly');
  // StoreKit omits unknown SKUs from the result instead of throwing, so a
  // misconfigured store resolves to an empty product list with no error. Track
  // whether a fetch has actually completed to tell that apart from "loading"
  // — otherwise the only symptom is a permanently disabled Continue button.
  const [loadAttempted, setLoadAttempted] = useState(false);

  const load = useCallback(async () => {
    setLoadAttempted(false);
    await loadProducts();
    setLoadAttempted(true);
  }, [loadProducts]);

  useEffect(() => {
    if (isVisible && products.length === 0) {
      load();
    }
    // Analytics: this sheet is the one place plans are ever shown, so it is the
    // canonical paywall impression. `source` is the gate that opened it, which is
    // what turns this into "which feature actually drives upgrades".
    if (isVisible) {
      AnalyticsTracker.track('paywall_viewed', { source: source ?? 'unknown' });
    }
  }, [isVisible]);

  const monthlyProduct = products.find((p: any) => p.id === SUBSCRIPTION_PRODUCTS.monthly);
  const yearlyProduct = products.find((p: any) => p.id === SUBSCRIPTION_PRODUCTS.yearly);

  // Derive per-month equivalent + savings from the real store prices so the copy
  // is always truthful for the user's storefront/currency.
  const pricing = useMemo(() => {
    const monthlyPrice = monthlyProduct?.price ?? null;
    const yearlyPrice = yearlyProduct?.price ?? null;
    const yearlyTemplate = yearlyProduct?.displayPrice ?? '';

    let yearlyPerMonth: string | null = null;
    let savePercent: number | null = null;

    if (yearlyPrice != null && yearlyTemplate) {
      yearlyPerMonth = formatFromTemplate(yearlyTemplate, yearlyPrice / 12);
    }
    if (monthlyPrice != null && monthlyPrice > 0 && yearlyPrice != null) {
      const pct = Math.round((1 - yearlyPrice / 12 / monthlyPrice) * 100);
      if (pct > 0) savePercent = pct;
    }
    return { yearlyPerMonth, savePercent };
  }, [monthlyProduct, yearlyProduct]);

  // Sign-in is gated BEFORE this sheet opens (the flow shows the sign-in sheet
  // first), so a user reaching Continue is already authenticated and the
  // purchase's entitlement will attach to their account.
  const proceedPurchase = async () => {
    const product = selectedPlan === 'yearly' ? yearlyProduct : monthlyProduct;
    if (!product) return;
    await purchase(product.id);
    onClose();
  };

  const productsReady = products.length > 0;
  const productsUnavailable = loadAttempted && !isLoading && !productsReady;

  const PlanCard = ({ plan }: { plan: PlanKey }) => {
    const isSelected = selectedPlan === plan;
    const product = plan === 'yearly' ? yearlyProduct : monthlyProduct;
    const price =
      plan === 'yearly' ? (pricing.yearlyPerMonth ?? product?.displayPrice) : product?.displayPrice;

    return (
      <Pressable
        onPress={() => setSelectedPlan(plan)}
        className={`flex-row items-center rounded-2xl border p-4 ${
          isSelected
            ? 'border-2 border-primary bg-primary/10'
            : 'border-light-border bg-light-border/20 dark:border-dark-border dark:bg-white/[0.03]'
        }`}>
        {/* Radio */}
        <View
          className={`h-5 w-5 items-center justify-center rounded-full ${
            isSelected ? 'bg-primary' : 'border-2 border-light-border dark:border-dark-border'
          }`}>
          {isSelected ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
        </View>

        {/* Plan name + billing detail */}
        <View className="ml-3 flex-1">
          <View className="flex-row items-center">
            <Typography variant="subtitle-14-semibold" color="primary">
              {t(plan === 'yearly' ? 'subscription.yearly' : 'subscription.monthly')}
            </Typography>
            {plan === 'yearly' && pricing.savePercent ? (
              <View className="ml-2 rounded-full bg-success px-2 py-0.5">
                <Typography variant="tiny-10" color="white" className="font-semibold">
                  {t('subscription.savePercent', { percent: pricing.savePercent })}
                </Typography>
              </View>
            ) : null}
          </View>
          {plan === 'yearly' && product?.displayPrice ? (
            <Typography variant="body-12" color="secondary" className="mt-0.5">
              {t('subscription.billedAnnually', { price: product.displayPrice })}
            </Typography>
          ) : (
            <Typography variant="body-12" color="secondary" className="mt-0.5">
              {t('subscription.billedMonthly')}
            </Typography>
          )}
        </View>

        {/* Per-month price */}
        <Typography variant="subtitle-16" color="primary">
          {price ? t('subscription.perMonth', { price }) : '...'}
        </Typography>
      </Pressable>
    );
  };

  const footer = (
    <View className="px-6 pt-2">
      {error ? (
        <Typography variant="body-12" color="error" className="mb-2 text-center">
          {error}
        </Typography>
      ) : null}

      {/* Single Continue CTA — buys the selected plan. */}
      <Button
        variant="primary"
        size="large"
        fullWidth
        haptic
        loading={isLoading}
        disabled={!productsReady}
        className="rounded-2xl"
        onPress={proceedPurchase}>
        {t('subscription.continue')}
      </Button>

      {/* Restore purchases */}
      <Button
        variant="ghost"
        size="small"
        fullWidth
        disabled={isLoading}
        textColor="secondary"
        textVariant="body-12"
        className="mt-2"
        onPress={restorePurchases}>
        {t('subscription.restorePurchases')}
      </Button>

      {/* Terms */}
      <Typography variant="tiny-10" color="secondary" className="mt-3 text-center">
        {t('subscription.autoRenewTerms')}
      </Typography>

      {/* Guideline 3.1.2 requires the purchase screen itself to link the EULA
          and privacy policy — not just the App Store description. */}
      <View className="mt-2 flex-row items-center justify-center">
        <Pressable onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
          <Typography variant="tiny-10" color="secondary" className="underline">
            {t('settings.tab.terms')}
          </Typography>
        </Pressable>
        <Typography variant="tiny-10" color="secondary" className="mx-2">
          ·
        </Typography>
        <Pressable onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
          <Typography variant="tiny-10" color="secondary" className="underline">
            {t('settings.tab.privacy')}
          </Typography>
        </Pressable>
      </View>
    </View>
  );

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} scrollable footer={footer}>
      {/* Hero */}
      <View className="mb-5 mt-1 items-center">
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <Ionicons name="sparkles" size={30} color={colors.primary} />
        </View>
        <Typography variant="headline-20" color="primary" className="mb-2 text-center">
          {t('subscription.upgradeTitle')}
        </Typography>
        <Typography variant="body-14" color="secondary" className="text-center">
          {t('subscription.upgradeSubtitle')}
        </Typography>
      </View>

      {/* Perks — single source of truth (premiumPerks.ts) */}
      <View className="mb-5 rounded-2xl bg-light-border/20 p-4 dark:bg-white/[0.03]">
        {PREMIUM_PERKS.map((perk, i) => (
          <View
            key={perk.labelKey}
            className={`flex-row items-center py-2 ${
              i < PREMIUM_PERKS.length - 1
                ? 'border-b border-light-border dark:border-dark-border'
                : ''
            }`}>
            <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/15">
              <Ionicons name={perk.icon} size={16} color={colors.primary} />
            </View>
            <Typography variant="subtitle-14-medium" color="primary" className="ml-3 flex-1">
              {t(perk.labelKey)}
            </Typography>
          </View>
        ))}
      </View>

      {/* Plan selection */}
      {productsUnavailable ? (
        <View className="items-center rounded-2xl bg-light-border/20 px-4 py-6 dark:bg-white/[0.03]">
          <Ionicons
            name="cloud-offline-outline"
            size={26}
            color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
          />
          <Typography variant="subtitle-14-semibold" color="primary" className="mt-3 text-center">
            {t('subscription.plansUnavailable')}
          </Typography>
          <Typography variant="body-12" color="secondary" className="mt-1 text-center">
            {t('subscription.plansUnavailableSub')}
          </Typography>
          <Button variant="secondary" size="small" className="mt-4" onPress={load}>
            {t('subscription.retry')}
          </Button>
        </View>
      ) : !productsReady ? (
        <View className="items-center py-8">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View className="gap-3">
          <PlanCard plan="yearly" />
          <PlanCard plan="monthly" />
        </View>
      )}
    </BottomSheet>
  );
};
