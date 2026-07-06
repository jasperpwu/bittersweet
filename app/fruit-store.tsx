import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  ScrollView,
  useColorScheme,
  Text,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../src/components/ui/Typography';
import { FruitCounter } from '../src/components/rewards';
import { Button } from '../src/components/ui/Button';
import { Modal } from '../src/components/ui/Modal';
import { useAppStore, useRewards } from '../src/store';
import { showToast } from '../src/components/ui/Toast';
import { SETUP_TASK_REWARD, type SetupTaskId } from '../src/services/sync/SyncMapper';
import { getInstalledWidgetFamilies } from '../modules/widget-info';
import { useTranslation } from 'react-i18next';
import type { Purchase } from '../src/types/models';
import { TIP_IDS, hasUnpurchasedTips } from '../src/config/tips';
import {
  SLIDER_THEMES,
  sliderThemeCostForUser,
  DEFAULT_SLIDER_COLORS,
  getSliderTheme,
  themeIdFromProductId,
  type SliderTheme,
} from '../src/config/sliderThemes';
import { useUnifiedStore } from '../src/store/unified-store';

// A history row's tipId is only renderable if it's still in the catalog —
// retired/unknown ids (see tips.ts contract) fall back to a generic label
// instead of leaking a raw `store.tips.*` i18n key.
const isKnownTipId = (tipId: string | undefined): tipId is string =>
  !!tipId && (TIP_IDS as readonly string[]).includes(tipId);

// History-row icon/title for any purchase, including theme purchases. A theme
// whose id was retired from the catalog falls back to a generic label — same
// contract as retired tips.
const purchaseIcon = (purchase: Purchase): string => {
  if (purchase.productId === 'accelerate_card') return '🚀';
  const themeId = themeIdFromProductId(purchase.productId);
  if (themeId) return getSliderTheme(themeId)?.flag ?? '⚽';
  return '💡';
};

const purchaseTitle = (
  purchase: Purchase,
  t: (key: string, opts?: Record<string, unknown>) => string
): string => {
  if (purchase.productId === 'accelerate_card') return t('store.accelerateTitle');
  const themeId = themeIdFromProductId(purchase.productId);
  if (themeId) {
    return getSliderTheme(themeId)
      ? t('store.themeItemTitle', { country: t(`store.themes.${themeId}`) })
      : t('store.themeGenericTitle');
  }
  return t('store.tipTitle');
};

const SETUP_TASK_META: { id: SetupTaskId; icon: string; titleKey: string; descKey: string }[] = [
  { id: 'widget', icon: '📱', titleKey: 'store.taskWidgetTitle', descKey: 'store.taskWidgetDesc' },
  { id: 'goal', icon: '🎯', titleKey: 'store.taskGoalTitle', descKey: 'store.taskGoalDesc' },
];

export default function FruitStoreScreen() {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const rewards = useRewards();
  // Tip currently shown in the modal (just purchased, or reopened from history).
  const [activeTipId, setActiveTipId] = useState<string | null>(null);

  const [claimedTitle, setClaimedTitle] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'themes'>('all');

  const isAccelerateActive = useAppStore((s) => s.rewards.isAccelerateActive());

  const sliderThemeId = useUnifiedStore((s) => s.preferences.sliderThemeId);
  const updatePreferences = useUnifiedStore((s) => s.updatePreferences);

  // Dev accounts pay a 1-apple test price (see config/devUsers.ts).
  const authUserId = useAppStore((s) => s.auth.user?.id);
  const themeCost = sliderThemeCostForUser(authUserId);

  const purchaseHistory = useMemo(() => {
    const purchases = rewards.purchases ?? { byId: {}, allIds: [] };
    return purchases.allIds
      .map((id) => purchases.byId[id])
      .filter((p): p is Purchase => !!p)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rewards.purchases]);

  // Each tab shows only its own slice of the history: Products ↔ accelerate/tip
  // purchases, Themes ↔ theme purchases, All ↔ everything.
  const visibleHistory = useMemo(() => {
    if (activeTab === 'all') return purchaseHistory;
    return purchaseHistory.filter(
      (p) => !!themeIdFromProductId(p.productId) === (activeTab === 'themes')
    );
  }, [purchaseHistory, activeTab]);

  // Tips are never re-sold: once the whole catalog is owned the product shows a
  // "come back later" state instead of charging for a repeat.
  const allTipsOwned = useMemo(
    () =>
      !hasUnpurchasedTips(
        purchaseHistory.map((p) => p.tipId).filter((tipId): tipId is string => !!tipId)
      ),
    [purchaseHistory]
  );

  // Theme ownership derives from purchase history (product_id `theme_<id>`).
  const ownedThemeIds = useMemo(
    () =>
      new Set(
        purchaseHistory
          .map((p) => themeIdFromProductId(p.productId))
          .filter((id): id is string => !!id)
      ),
    [purchaseHistory]
  );

  // Only surface tasks that are set up but not yet claimed — claimed tasks disappear.
  const pendingTasks = SETUP_TASK_META.filter(
    (meta) => rewards.tasks[meta.id].everSetup && !rewards.tasks[meta.id].claimed
  );

  // Re-detect setup on entry so a widget/goal added since launch becomes claimable
  // right away without restarting the app.
  useEffect(() => {
    useAppStore.getState().rewards.reconcileSetupTasks();
    getInstalledWidgetFamilies().then((families) => {
      if (families.length > 0) useAppStore.getState().rewards.markTaskSetup('widget');
    });
  }, []);

  const handleClaimTask = (taskId: SetupTaskId, title: string) => {
    const claimed = useAppStore.getState().rewards.claimTask(taskId);
    if (claimed) {
      // Pop-up confirmation; the task then disappears from the list (pendingTasks filter).
      setClaimedTitle(title);
    } else {
      showToast(t('store.rewardUnavailable'), 'error');
    }
  };

  const handlePurchaseAccelerate = () => {
    if (rewards.balance < 50) {
      showToast(t('store.notEnough50'), 'error');
      return;
    }
    Alert.alert(t('store.purchaseAccelTitle'), t('store.purchaseAccelBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('store.purchase'),
        onPress: () => {
          try {
            useAppStore.getState().rewards.activateAccelerateCard();
            showToast(t('store.accelActivated'), 'success');
          } catch {
            showToast(t('store.purchaseFailed'), 'error');
          }
        },
      },
    ]);
  };

  const handlePurchaseTip = () => {
    if (allTipsOwned) {
      showToast(t('store.tipsExhausted'), 'neutral');
      return;
    }
    if (rewards.balance < 5) {
      showToast(t('store.notEnough5'), 'error');
      return;
    }
    Alert.alert(t('store.purchaseTipTitle'), t('store.purchaseTipBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('store.purchase'),
        onPress: () => {
          try {
            const tipId = useAppStore.getState().rewards.purchaseTip();
            setActiveTipId(tipId);
          } catch {
            showToast(t('store.purchaseFailed'), 'error');
          }
        },
      },
    ]);
  };

  // Applying a theme is instant and free; the preference change is picked up by
  // the sync middleware and pushed to user_settings.slider_theme_id.
  const handleApplyTheme = (themeId: string | null) => {
    updatePreferences({ sliderThemeId: themeId });
  };

  const handlePurchaseTheme = (theme: SliderTheme) => {
    const country = t(`store.themes.${theme.id}`);
    if (rewards.balance < themeCost) {
      showToast(t('store.notEnough50'), 'error');
      return;
    }
    Alert.alert(
      t('store.purchaseThemeTitle', { country }),
      t('store.purchaseThemeBody', { country, cost: themeCost }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('store.purchase'),
          onPress: () => {
            try {
              useAppStore.getState().rewards.purchaseTheme(theme.id);
              // A just-bought theme applies right away (the confirm dialog says so).
              updatePreferences({ sliderThemeId: theme.id });
              showToast(t('store.themeActivated', { country }), 'success');
            } catch {
              showToast(t('store.purchaseFailed'), 'error');
            }
          },
        },
      ]
    );
  };

  const accelerateTimeRemaining = () => {
    const card = rewards.accelerateCard;
    if (!card) return null;
    const expiresAt = new Date(card.expiresAt);
    const now = new Date();
    if (expiresAt <= now) return null;
    const diffMs = expiresAt.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return t('store.timeRemaining', { hours, minutes });
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pb-4 pt-3">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center active:opacity-70"
          hitSlop={8}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={colorScheme === 'dark' ? '#CACACA' : '#8B7355'}
          />
          <Text
            style={{
              color: colorScheme === 'dark' ? '#CACACA' : '#8B7355',
              fontSize: 16,
              fontWeight: '500',
              marginLeft: 2,
            }}>
            {t('store.back')}
          </Text>
        </Pressable>

        <Typography variant="headline-18">{t('store.title')}</Typography>

        <FruitCounter fruitCount={rewards.balance} size="small" />
      </View>

      {/* All / Products / Themes tabs (same pill style as grove's PeriodToggle) */}
      <View className="px-5 pb-2">
        <View className="flex-row rounded-xl bg-light-border/30 p-1 dark:bg-[#242540]">
          {(
            [
              { tab: 'all', labelKey: 'store.tabAll' },
              { tab: 'products', labelKey: 'store.products' },
              { tab: 'themes', labelKey: 'store.tabThemes' },
            ] as const
          ).map(({ tab, labelKey }) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 items-center rounded-lg py-2 ${
                activeTab === tab ? 'bg-primary' : ''
              }`}>
              <Typography
                variant="subtitle-14-medium"
                color={activeTab === tab ? 'white' : 'secondary'}>
                {t(labelKey)}
              </Typography>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Tasks Section — one-time setup rewards, only shown while claimable */}
        {activeTab === 'all' && pendingTasks.length > 0 && (
          <>
            <View className="mb-3 mt-4">
              <Typography variant="subtitle-14-semibold" color="secondary">
                {t('store.tasks')}
              </Typography>
            </View>

            {pendingTasks.map((meta) => (
              <SetupTaskCard key={meta.id} meta={meta} onClaim={handleClaimTask} />
            ))}
          </>
        )}

        {/* Products Section */}
        {activeTab !== 'themes' && (
          <>
            <View className="mb-3 mt-4">
              <Typography variant="subtitle-14-semibold" color="secondary">
                {t('store.products')}
              </Typography>
            </View>

            {/* Accelerate Card */}
            <Pressable
              onPress={handlePurchaseAccelerate}
              disabled={isAccelerateActive}
              className={`
            mb-4 rounded-2xl
            border border-light-border bg-light-border/30 p-5
            dark:border-dark-border dark:bg-[#242540]
            ${isAccelerateActive ? 'opacity-60' : 'active:opacity-80'}
          `}>
              <View className="flex-row items-start justify-between">
                <View className="mr-4 flex-1">
                  <View className="mb-2 flex-row items-center">
                    <Text style={{ fontSize: 28 }}>🚀</Text>
                    <View className="ml-3 flex-1">
                      <Typography variant="subtitle-14-semibold">
                        {t('store.accelerateTitle')}
                      </Typography>
                    </View>
                  </View>
                  <Typography variant="body-14" color="secondary">
                    {t('store.accelerateDesc')}
                  </Typography>
                  {isAccelerateActive && (
                    <View className="mt-2">
                      <Typography variant="body-12" color="success">
                        {t('store.accelerateActive', { time: accelerateTimeRemaining() })}
                      </Typography>
                    </View>
                  )}
                </View>
                <View className="rounded-xl bg-primary/15 px-3 py-1.5">
                  <Typography variant="subtitle-14-semibold" color="primary">
                    🍎 50
                  </Typography>
                </View>
              </View>
            </Pressable>

            {/* Product Usage Tip — stays tappable when exhausted so the tap explains why */}
            <Pressable
              onPress={handlePurchaseTip}
              className={`
            mb-4 rounded-2xl
            border border-light-border bg-light-border/30 p-5
            dark:border-dark-border dark:bg-[#242540]
            ${allTipsOwned ? 'opacity-60' : 'active:opacity-80'}
          `}>
              <View className="flex-row items-start justify-between">
                <View className="mr-4 flex-1">
                  <View className="mb-2 flex-row items-center">
                    <Text style={{ fontSize: 28 }}>💡</Text>
                    <View className="ml-3 flex-1">
                      <Typography variant="subtitle-14-semibold">{t('store.tipTitle')}</Typography>
                    </View>
                  </View>
                  <Typography variant="body-14" color="secondary">
                    {t('store.tipDesc')}
                  </Typography>
                  {allTipsOwned && (
                    <View className="mt-2">
                      <Typography variant="body-12" color="success">
                        {t('store.tipsExhausted')}
                      </Typography>
                    </View>
                  )}
                </View>
                <View className="rounded-xl bg-primary/15 px-3 py-1.5">
                  <Typography variant="subtitle-14-semibold" color="primary">
                    🍎 5
                  </Typography>
                </View>
              </View>
            </Pressable>
          </>
        )}

        {/* Themes Section — shown in the All and Themes tabs */}
        {activeTab !== 'products' && (
          <>
            <View className="mb-1 mt-4">
              <Typography variant="subtitle-14-semibold" color="secondary">
                {t('store.tabThemes')}
              </Typography>
            </View>
            <View className="mb-3">
              <Typography variant="body-12" color="secondary">
                {t('store.themesSubtitle')}
              </Typography>
            </View>

            {/* Classic — the default look, always owned, free to re-apply */}
            <ThemeCard
              flag="🍎"
              name={t('store.themeClassic')}
              trackColors={[DEFAULT_SLIDER_COLORS.activeTrack]}
              owned
              applied={sliderThemeId === null}
              onBuy={() => {}}
              onApply={() => handleApplyTheme(null)}
            />

            {SLIDER_THEMES.map((theme) => (
              <ThemeCard
                key={theme.id}
                flag={theme.flag}
                name={t(`store.themes.${theme.id}`)}
                trackColors={theme.trackColors}
                thumbEmoji={theme.thumbEmoji}
                cost={themeCost}
                owned={ownedThemeIds.has(theme.id)}
                applied={sliderThemeId === theme.id}
                onBuy={() => handlePurchaseTheme(theme)}
                onApply={() => handleApplyTheme(theme.id)}
              />
            ))}
          </>
        )}

        {/* Purchase History — newest first, filtered to the active tab; tapping a
            tip purchase reopens that tip */}
        {visibleHistory.length > 0 && (
          <>
            <View className="mb-3 mt-4">
              <Typography variant="subtitle-14-semibold" color="secondary">
                {t('store.history')}
              </Typography>
            </View>

            <View
              className="
                mb-4 rounded-2xl
                border border-light-border bg-light-border/30 px-5
                dark:border-dark-border dark:bg-[#242540]
              ">
              {visibleHistory.map((purchase, index) => (
                <Pressable
                  key={purchase.id}
                  disabled={purchase.productId !== 'usage_tip' || !isKnownTipId(purchase.tipId)}
                  onPress={() => isKnownTipId(purchase.tipId) && setActiveTipId(purchase.tipId)}
                  className={`
                    flex-row items-start py-4
                    ${index > 0 ? 'border-t border-light-border dark:border-dark-border' : ''}
                    ${purchase.productId === 'usage_tip' && isKnownTipId(purchase.tipId) ? 'active:opacity-70' : ''}
                  `}>
                  <Text style={{ fontSize: 20 }}>{purchaseIcon(purchase)}</Text>
                  <View className="ml-3 flex-1">
                    {purchase.productId === 'usage_tip' && isKnownTipId(purchase.tipId) ? (
                      <Typography variant="body-14">{t(`store.tips.${purchase.tipId}`)}</Typography>
                    ) : (
                      <Typography variant="body-14">{purchaseTitle(purchase, t)}</Typography>
                    )}
                    <View className="mt-1">
                      <Typography variant="body-12" color="secondary">
                        {new Date(purchase.createdAt).toLocaleDateString(i18n.language, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* Coming Soon Banner */}
        {activeTab === 'all' && (
          <View className="mt-4 items-center rounded-2xl bg-primary/10 p-5">
            <Text style={{ fontSize: 24, marginBottom: 8 }}>🏪</Text>
            <Typography variant="subtitle-14-semibold" color="primary">
              {t('store.comingSoon')}
            </Typography>
            <View className="mt-2">
              <Typography variant="body-14" color="secondary" className="text-center">
                {t('store.comingSoonDesc')}
              </Typography>
            </View>
          </View>
        )}

        <View className="mb-8" />
      </ScrollView>

      {/* Tip Modal */}
      <Modal isVisible={activeTipId !== null} onClose={() => setActiveTipId(null)} size="small">
        <View className="items-center">
          <Text style={{ fontSize: 40, marginBottom: 16 }}>💡</Text>
          <Typography variant="headline-18" className="mb-3 text-center">
            {t('store.proTip')}
          </Typography>
          <Typography variant="body-14" color="secondary" className="mb-6 text-center">
            {activeTipId ? t(`store.tips.${activeTipId}`) : ''}
          </Typography>
          <Button onPress={() => setActiveTipId(null)} size="medium">
            {t('store.gotIt')}
          </Button>
        </View>
      </Modal>

      {/* Task claimed pop-up */}
      <Modal isVisible={claimedTitle !== null} onClose={() => setClaimedTitle(null)} size="small">
        <View className="items-center">
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🎉</Text>
          <Typography variant="headline-18" className="mb-3 text-center">
            {t('store.claimedTitle', { count: SETUP_TASK_REWARD })}
          </Typography>
          <Typography variant="body-14" color="secondary" className="mb-6 text-center">
            {t('store.claimedBody', { count: SETUP_TASK_REWARD, title: claimedTitle })}
          </Typography>
          <Button onPress={() => setClaimedTitle(null)} size="medium">
            {t('store.awesome')}
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// A purchasable slider theme (or the always-owned Classic look). Card states:
// unowned → tap to buy; owned → tap to apply; applied → highlighted, inert.
function ThemeCard({
  flag,
  name,
  trackColors,
  thumbEmoji,
  cost,
  owned,
  applied,
  onBuy,
  onApply,
}: {
  flag: string;
  name: string;
  trackColors: string[];
  thumbEmoji?: string;
  /** Price badge for unowned themes; omit for the always-owned Classic card. */
  cost?: number;
  owned: boolean;
  applied: boolean;
  onBuy: () => void;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={owned ? onApply : onBuy}
      disabled={applied}
      className={`
        mb-4 rounded-2xl
        border bg-light-border/30 p-5 dark:bg-[#242540]
        ${applied ? 'border-primary' : 'border-light-border active:opacity-80 dark:border-dark-border'}
      `}>
      <View className="flex-row items-center justify-between">
        <View className="mr-4 flex-1">
          <View className="flex-row items-center">
            <Text style={{ fontSize: 28 }}>{flag}</Text>
            <View className="ml-3 flex-1">
              <Typography variant="subtitle-14-semibold">{name}</Typography>
            </View>
          </View>

          {/* Mini slider preview: theme stripes + thumb */}
          <View style={{ height: 20, justifyContent: 'center', marginTop: 10 }}>
            <View style={{ flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden' }}>
              {trackColors.map((color, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: color }} />
              ))}
            </View>
            {thumbEmoji ? (
              <Text
                allowFontScaling={false}
                style={{ position: 'absolute', left: '60%', fontSize: 14 }}>
                {thumbEmoji}
              </Text>
            ) : (
              <View
                className="border border-light-border dark:border-dark-border"
                style={{
                  position: 'absolute',
                  left: '60%',
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: DEFAULT_SLIDER_COLORS.thumb,
                }}
              />
            )}
          </View>
        </View>

        {applied ? (
          <View className="rounded-xl bg-primary/15 px-3 py-1.5">
            <Typography variant="subtitle-14-semibold" color="primary">
              ✓ {t('store.applied')}
            </Typography>
          </View>
        ) : owned ? (
          <Button size="small" onPress={onApply}>
            {t('store.apply')}
          </Button>
        ) : (
          <View className="rounded-xl bg-primary/15 px-3 py-1.5">
            <Typography variant="subtitle-14-semibold" color="primary">
              🍎 {cost}
            </Typography>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// Only rendered for tasks that are set up but not yet claimed (parent filters via
// pendingTasks), so this is always the claimable state.
function SetupTaskCard({
  meta,
  onClaim,
}: {
  meta: { id: SetupTaskId; icon: string; titleKey: string; descKey: string };
  onClaim: (taskId: SetupTaskId, title: string) => void;
}) {
  const { t } = useTranslation();
  const title = t(meta.titleKey);
  return (
    <View
      className="
        mb-4 rounded-2xl
        border border-light-border bg-light-border/30 p-5
        dark:border-dark-border dark:bg-[#242540]
      ">
      <View className="flex-row items-center justify-between">
        <View className="mr-4 flex-1 flex-row items-center">
          <Text style={{ fontSize: 28 }}>{meta.icon}</Text>
          <View className="ml-3 flex-1">
            <Typography variant="subtitle-14-semibold">{title}</Typography>
            <View className="mt-1">
              <Typography variant="body-12" color="secondary">
                {t('store.readyToClaim', { count: SETUP_TASK_REWARD })}
              </Typography>
            </View>
          </View>
        </View>

        <Button size="small" onPress={() => onClaim(meta.id, title)}>
          {t('store.claim', { count: SETUP_TASK_REWARD })}
        </Button>
      </View>
    </View>
  );
}
