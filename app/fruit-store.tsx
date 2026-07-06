import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  ScrollView,
  useColorScheme,
  Text,
  TextInput,
  Image,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal as RNModal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
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
import { EmojiPickerOverlay } from '../src/components/ui/EmojiPicker/EmojiPicker';
import type { CustomReward, Purchase } from '../src/types/models';
import { TIP_IDS, hasUnpurchasedTips } from '../src/config/tips';
import {
  customRewardIdFromProductId,
  DEFAULT_CUSTOM_REWARD_EMOJI,
} from '../src/config/customRewards';
import { savePurchasePhoto, uploadPurchasePhoto } from '../src/services/purchasePhotoService';
import { colors } from '../src/config/theme';
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

// History-row icon/title for any purchase, including theme and custom-reward
// purchases. A theme/custom-reward whose definition was retired/deleted falls
// back to a generic label — same contract as retired tips.
const purchaseIcon = (purchase: Purchase, customRewards: Record<string, CustomReward>): string => {
  if (purchase.productId === 'accelerate_card') return '🚀';
  const themeId = themeIdFromProductId(purchase.productId);
  if (themeId) return getSliderTheme(themeId)?.flag ?? '⚽';
  const rewardId = customRewardIdFromProductId(purchase.productId);
  if (rewardId) return customRewards[rewardId]?.emoji ?? DEFAULT_CUSTOM_REWARD_EMOJI;
  return '💡';
};

const purchaseTitle = (
  purchase: Purchase,
  t: (key: string, opts?: Record<string, unknown>) => string,
  customRewards: Record<string, CustomReward>
): string => {
  if (purchase.productId === 'accelerate_card') return t('store.accelerateTitle');
  const themeId = themeIdFromProductId(purchase.productId);
  if (themeId) {
    return getSliderTheme(themeId)
      ? t('store.themeItemTitle', { country: t(`store.themes.${themeId}`) })
      : t('store.themeGenericTitle');
  }
  const rewardId = customRewardIdFromProductId(purchase.productId);
  if (rewardId) return customRewards[rewardId]?.name ?? t('store.customGenericTitle');
  return t('store.tipTitle');
};

// Success buzz for every completed purchase (accelerate, tip, theme, custom).
const purchaseSuccessHaptic = () =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

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

  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'themes' | 'custom'>('all');

  // Create-custom-reward modal, and the bought purchase whose photo is being
  // viewed/added (photo modal is open while non-null).
  const [showCreateReward, setShowCreateReward] = useState(false);
  const [photoPurchaseId, setPhotoPurchaseId] = useState<string | null>(null);

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
  // purchases, Themes ↔ theme purchases, Custom ↔ custom rewards, All ↔ everything.
  const visibleHistory = useMemo(() => {
    if (activeTab === 'all') return purchaseHistory;
    return purchaseHistory.filter((p) => {
      const isTheme = !!themeIdFromProductId(p.productId);
      const isCustom = !!customRewardIdFromProductId(p.productId);
      if (activeTab === 'themes') return isTheme;
      if (activeTab === 'custom') return isCustom;
      return !isTheme && !isCustom;
    });
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

  // Custom rewards: bought ones leave the catalog (ownership from history,
  // product_id `custom_<id>`) but their definitions stay for history rows.
  const customRewardsById = rewards.customRewards?.byId ?? {};
  const boughtCustomRewardIds = useMemo(
    () =>
      new Set(
        purchaseHistory
          .map((p) => customRewardIdFromProductId(p.productId))
          .filter((id): id is string => !!id)
      ),
    [purchaseHistory]
  );
  const catalogCustomRewards = useMemo(() => {
    const { byId, allIds } = rewards.customRewards ?? { byId: {}, allIds: [] };
    return allIds
      .map((id) => byId[id])
      .filter((r): r is CustomReward => !!r && !boughtCustomRewardIds.has(r.id));
  }, [rewards.customRewards, boughtCustomRewardIds]);

  // Purchase whose photo modal is open (null when closed).
  const photoPurchase = photoPurchaseId ? (rewards.purchases?.byId[photoPurchaseId] ?? null) : null;

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
            purchaseSuccessHaptic();
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
            purchaseSuccessHaptic();
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
              purchaseSuccessHaptic();
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

  const handlePurchaseCustomReward = (reward: CustomReward) => {
    if (rewards.balance < reward.cost) {
      showToast(t('store.notEnoughN', { cost: reward.cost }), 'error');
      return;
    }
    Alert.alert(
      t('store.purchaseCustomTitle', { name: reward.name }),
      t('store.purchaseCustomBody', { name: reward.name, cost: reward.cost }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('store.purchase'),
          onPress: () => {
            try {
              useAppStore.getState().rewards.purchaseCustomReward(reward.id);
              purchaseSuccessHaptic();
              showToast(t('store.customPurchased', { name: reward.name }), 'success');
            } catch {
              showToast(t('store.purchaseFailed'), 'error');
            }
          },
        },
      ]
    );
  };

  const handleDeleteCustomReward = (reward: CustomReward) => {
    Alert.alert(t('store.deleteCustomTitle'), t('store.deleteCustomBody', { name: reward.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => useAppStore.getState().rewards.deleteCustomReward(reward.id),
      },
    ]);
  };

  // Same permission + picker flow as the journal's photo attach.
  const pickImage = async (source: 'library' | 'camera', onPicked: (uri: string) => void) => {
    try {
      const permissionResult =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          t('journal.permissionTitle'),
          source === 'camera'
            ? t('journal.permissionBodyCamera')
            : t('journal.permissionBodyLibrary'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('journal.openSettings'), onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (!result.canceled && result.assets[0]) {
        onPicked(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  };

  // Save-local-then-try-upload, same sequence as session photos: the purchase
  // row gets the local file:// URL immediately (works offline) and is upgraded
  // to the public bucket URL when the upload succeeds (failure keeps local).
  const handleRewardPhotoPicked = async (purchaseId: string, uri: string) => {
    try {
      const localUrl = await savePurchasePhoto(uri, purchaseId);
      useAppStore.getState().rewards.setPurchasePhoto(purchaseId, localUrl);
      try {
        const cloudUrl = await uploadPurchasePhoto(uri, purchaseId);
        useAppStore.getState().rewards.setPurchasePhoto(purchaseId, cloudUrl);
      } catch (error) {
        console.warn('Failed to upload purchase photo (kept local copy):', error);
      }
    } catch (error) {
      console.error('Failed to save purchase photo:', error);
      showToast(t('journal.failedSavePhoto'), 'error');
    }
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

      {/* All / Products / Themes / Custom tabs (same pill style as grove's PeriodToggle) */}
      <View className="px-5 pb-2">
        <View className="flex-row rounded-xl bg-light-border/30 p-1 dark:bg-[#242540]">
          {(
            [
              { tab: 'all', labelKey: 'store.tabAll' },
              { tab: 'products', labelKey: 'store.products' },
              { tab: 'themes', labelKey: 'store.tabThemes' },
              { tab: 'custom', labelKey: 'store.tabCustom' },
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
        {(activeTab === 'all' || activeTab === 'products') && (
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
        {(activeTab === 'all' || activeTab === 'themes') && (
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

        {/* Custom Section — user-defined rewards; bought ones move to history */}
        {(activeTab === 'all' || activeTab === 'custom') && (
          <>
            <View className="mb-1 mt-4">
              <Typography variant="subtitle-14-semibold" color="secondary">
                {t('store.tabCustom')}
              </Typography>
            </View>
            <View className="mb-3">
              <Typography variant="body-12" color="secondary">
                {t('store.customSubtitle')}
              </Typography>
            </View>

            {catalogCustomRewards.map((reward) => (
              <CustomRewardCard
                key={reward.id}
                reward={reward}
                onBuy={() => handlePurchaseCustomReward(reward)}
                onDelete={() => handleDeleteCustomReward(reward)}
              />
            ))}

            {/* Create card — dashed outline, opens the create modal */}
            <Pressable
              onPress={() => setShowCreateReward(true)}
              className="
                mb-4 items-center rounded-2xl border border-dashed
                border-light-border bg-light-border/30 p-5
                active:opacity-80 dark:border-dark-border dark:bg-[#242540]
              ">
              <View className="flex-row items-center">
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <View className="ml-2">
                  <Typography variant="subtitle-14-semibold" color="primary">
                    {t('store.createCustom')}
                  </Typography>
                </View>
              </View>
            </Pressable>
          </>
        )}

        {/* Purchase History — newest first, filtered to the active tab; tapping a
            tip purchase reopens that tip, tapping a custom purchase opens its photo */}
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
              {visibleHistory.map((purchase, index) => {
                const isTipRow = purchase.productId === 'usage_tip' && isKnownTipId(purchase.tipId);
                const isCustomRow = !!customRewardIdFromProductId(purchase.productId);
                return (
                  <Pressable
                    key={purchase.id}
                    disabled={!isTipRow && !isCustomRow}
                    onPress={() => {
                      if (isTipRow) setActiveTipId(purchase.tipId!);
                      else if (isCustomRow) setPhotoPurchaseId(purchase.id);
                    }}
                    className={`
                      flex-row items-center py-4
                      ${index > 0 ? 'border-t border-light-border dark:border-dark-border' : ''}
                      ${isTipRow || isCustomRow ? 'active:opacity-70' : ''}
                    `}>
                    <Text style={{ fontSize: 20 }}>
                      {purchaseIcon(purchase, customRewardsById)}
                    </Text>
                    <View className="ml-3 flex-1">
                      {isTipRow ? (
                        <Typography variant="body-14">
                          {t(`store.tips.${purchase.tipId}`)}
                        </Typography>
                      ) : (
                        <Typography variant="body-14">
                          {purchaseTitle(purchase, t, customRewardsById)}
                        </Typography>
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
                    {/* Custom purchases: photo thumbnail, or a camera hint to add one */}
                    {isCustomRow &&
                      (purchase.photoUrl ? (
                        <Image
                          source={{ uri: purchase.photoUrl }}
                          style={{ width: 44, height: 44, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="camera-outline" size={20} color={colors.primary} />
                      ))}
                  </Pressable>
                );
              })}
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

      {/* Bought custom reward — view/add the photo capturing the reward */}
      <Modal isVisible={photoPurchase !== null} onClose={() => setPhotoPurchaseId(null)}>
        {photoPurchase && (
          <View className="items-center">
            <Text style={{ fontSize: 40, marginBottom: 12 }}>
              {purchaseIcon(photoPurchase, customRewardsById)}
            </Text>
            <Typography variant="headline-18" className="mb-1 text-center">
              {purchaseTitle(photoPurchase, t, customRewardsById)}
            </Typography>
            <Typography variant="body-12" color="secondary" className="mb-4 text-center">
              {new Date(photoPurchase.createdAt).toLocaleDateString(i18n.language, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Typography>

            {photoPurchase.photoUrl ? (
              <Image
                source={{ uri: photoPurchase.photoUrl }}
                style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 16 }}
                resizeMode="cover"
              />
            ) : (
              <Typography variant="body-14" color="secondary" className="mb-4 text-center">
                {t('store.addRewardPhotoHint')}
              </Typography>
            )}

            <View className="mb-5 flex-row gap-x-3">
              <Pressable
                onPress={() =>
                  pickImage('library', (uri) => handleRewardPhotoPicked(photoPurchase.id, uri))
                }
                className="flex-row items-center rounded-xl bg-primary/20 px-4 py-2.5 active:opacity-70">
                <Ionicons name="images-outline" size={16} color={colors.primary} />
                <Typography variant="body-12" className="ml-1.5 text-primary">
                  {t('journal.library')}
                </Typography>
              </Pressable>
              <Pressable
                onPress={() =>
                  pickImage('camera', (uri) => handleRewardPhotoPicked(photoPurchase.id, uri))
                }
                className="flex-row items-center rounded-xl bg-primary/20 px-4 py-2.5 active:opacity-70">
                <Ionicons name="camera-outline" size={16} color={colors.primary} />
                <Typography variant="body-12" className="ml-1.5 text-primary">
                  {t('journal.camera')}
                </Typography>
              </Pressable>
            </View>

            <Button onPress={() => setPhotoPurchaseId(null)} size="medium">
              {t('common.done')}
            </Button>
          </View>
        )}
      </Modal>

      {/* Create custom reward */}
      <CreateRewardModal
        visible={showCreateReward}
        onClose={() => setShowCreateReward(false)}
        onCreate={(name, cost, emoji) => {
          useAppStore.getState().rewards.addCustomReward(name, cost, emoji);
          setShowCreateReward(false);
        }}
      />
    </SafeAreaView>
  );
}

// An un-bought custom reward in the catalog: emoji + name + price badge; tap
// to buy, trash icon to delete (bought ones never render here — the parent
// filters them out of catalogCustomRewards).
function CustomRewardCard({
  reward,
  onBuy,
  onDelete,
}: {
  reward: CustomReward;
  onBuy: () => void;
  onDelete: () => void;
}) {
  return (
    <Pressable
      onPress={onBuy}
      className="
        mb-4 rounded-2xl
        border border-light-border bg-light-border/30 p-5
        active:opacity-80 dark:border-dark-border dark:bg-[#242540]
      ">
      <View className="flex-row items-center justify-between">
        <View className="mr-4 flex-1 flex-row items-center">
          <Text style={{ fontSize: 28 }}>{reward.emoji ?? DEFAULT_CUSTOM_REWARD_EMOJI}</Text>
          <View className="ml-3 flex-1">
            <Typography variant="subtitle-14-semibold">{reward.name}</Typography>
          </View>
        </View>
        <View className="flex-row items-center">
          <View className="rounded-xl bg-primary/15 px-3 py-1.5">
            <Typography variant="subtitle-14-semibold" color="primary">
              🍎 {reward.cost}
            </Typography>
          </View>
          <Pressable onPress={onDelete} hitSlop={8} className="ml-3 active:opacity-60">
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// Create-custom-reward form: optional emoji + name + fruit cost. Own RN Modal
// with KeyboardAvoidingView (same structure as CreateTagModal) because the
// shared Modal doesn't handle the keyboard.
function CreateRewardModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string, cost: number, emoji?: string) => void;
}) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [costText, setCostText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const cost = parseInt(costText, 10);
  const canCreate = !!name.trim() && Number.isFinite(cost) && cost >= 1;

  const reset = () => {
    setName('');
    setEmoji('');
    setCostText('');
    setShowEmojiPicker(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate(name.trim(), cost, emoji || undefined);
    reset();
  };

  if (!visible) return null;

  return (
    <RNModal visible transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/50 px-4"
          onPress={handleClose}>
          <Pressable
            onPress={() => {}}
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-light-bg dark:bg-dark-bg">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-light-border p-6 dark:border-gray-700">
              <Typography variant="headline-20" color="primary">
                {t('store.createCustomTitle')}
              </Typography>
              <Pressable
                onPress={handleClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-light-border/50 dark:bg-gray-700">
                <Ionicons
                  name="close"
                  size={20}
                  color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'}
                />
              </Pressable>
            </View>

            <View className="p-6">
              {/* Emoji (optional) + name row — same layout as CreateTagModal */}
              <View className="mb-4 flex-row items-center" style={{ gap: 12 }}>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowEmojiPicker(true);
                  }}
                  className="h-12 w-12 items-center justify-center rounded-xl border border-light-border bg-light-border/30 active:opacity-80 dark:border-gray-500 dark:bg-gray-700">
                  {emoji ? (
                    <Text className="text-2xl">{emoji}</Text>
                  ) : (
                    <Ionicons name="happy-outline" size={24} color={colors.primary} />
                  )}
                </Pressable>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t('store.customNamePlaceholder')}
                  placeholderTextColor="#666"
                  className="flex-1"
                  style={{
                    backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                    borderWidth: 1,
                    borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
                  }}
                  autoFocus={true}
                />
              </View>

              {/* Cost in fruits */}
              <Typography variant="body-14" color="primary" className="mb-2">
                {t('store.customCostLabel')}
              </Typography>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <Text style={{ fontSize: 24 }}>🍎</Text>
                <TextInput
                  value={costText}
                  onChangeText={(text) => setCostText(text.replace(/[^0-9]/g, ''))}
                  placeholder={t('store.customCostPlaceholder')}
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  className="flex-1"
                  style={{
                    backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 16,
                    color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                    borderWidth: 1,
                    borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
                  }}
                />
              </View>
            </View>

            {/* Actions */}
            <View
              className="flex-row border-t border-light-border p-4 dark:border-gray-700"
              style={{ gap: 12 }}>
              <Pressable
                onPress={handleClose}
                className="flex-1 items-center rounded-2xl bg-gray-600 py-4 active:opacity-80">
                <Typography variant="subtitle-16" color="white">
                  {t('common.cancel')}
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={!canCreate}
                className={`flex-1 items-center rounded-2xl py-4 ${
                  canCreate ? 'bg-blue-600 active:opacity-80' : 'bg-gray-500 opacity-50'
                }`}>
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  {t('store.createCustomAction')}
                </Typography>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>

      {/* Emoji Picker Overlay (optional emoji) */}
      {showEmojiPicker && (
        <EmojiPickerOverlay
          title={t('store.customEmojiTitle')}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={(picked) => {
            setEmoji(picked);
            setShowEmojiPicker(false);
          }}
        />
      )}
    </RNModal>
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
