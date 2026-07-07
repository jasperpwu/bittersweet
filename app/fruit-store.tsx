import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { giftIdFromProductId, DEFAULT_GIFT_EMOJI } from '../src/config/giftRewards';
import type { GiftItem } from '../src/services/grove/GiftRewardService';
import { GiftRewardModal } from '../src/components/rewards/GiftRewardModal';
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

// History-row icon/title for any purchase, including theme, custom-reward and
// gift purchases. A theme/custom-reward/gift whose definition was retired,
// deleted or not yet fetched falls back to a generic label — same contract as
// retired tips.
const purchaseIcon = (
  purchase: Purchase,
  customRewards: Record<string, CustomReward>,
  gifts: Record<string, GiftItem>
): string => {
  if (purchase.productId === 'accelerate_card') return '🚀';
  const themeId = themeIdFromProductId(purchase.productId);
  if (themeId) return getSliderTheme(themeId)?.flag ?? '⚽';
  const rewardId = customRewardIdFromProductId(purchase.productId);
  if (rewardId) return customRewards[rewardId]?.emoji ?? DEFAULT_CUSTOM_REWARD_EMOJI;
  const giftId = giftIdFromProductId(purchase.productId);
  if (giftId) return gifts[giftId]?.emoji ?? DEFAULT_GIFT_EMOJI;
  return '💡';
};

const purchaseTitle = (
  purchase: Purchase,
  t: (key: string, opts?: Record<string, unknown>) => string,
  customRewards: Record<string, CustomReward>,
  gifts: Record<string, GiftItem>
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
  const giftId = giftIdFromProductId(purchase.productId);
  if (giftId) return gifts[giftId]?.name ?? t('store.giftGenericTitle');
  return t('store.tipTitle');
};

// The purchase history interleaves the user's own purchase rows with gifts
// they SENT that got bought (the sender has no local purchase row — the
// recipient paid — so their history entry renders straight from the gift row).
type HistoryEntry =
  | { kind: 'purchase'; purchase: Purchase; date: string }
  | { kind: 'sentGift'; gift: GiftItem; date: string };

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

  // `tab=custom` deep link (from a gift notification tap) opens the Custom tab.
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'themes' | 'custom'>(
    tab === 'custom' ? 'custom' : 'all'
  );

  // Create-custom-reward modal, and the bought purchase whose photo is being
  // viewed/added (photo modal is open while non-null).
  const [showCreateReward, setShowCreateReward] = useState(false);
  const [photoPurchaseId, setPhotoPurchaseId] = useState<string | null>(null);

  // Gift creation modal, the gift whose photo modal is open, and an in-flight
  // flag for the gift photo upload (it hits the network, unlike the local-first
  // custom-reward photo flow).
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [photoGiftId, setPhotoGiftId] = useState<string | null>(null);
  const [giftPhotoSaving, setGiftPhotoSaving] = useState(false);

  // Gifts are cross-user grove state (see GiftRewardService), not the rewards slice.
  const groveGifts = useAppStore((s) => s.grove.gifts);
  const groveProfile = useAppStore((s) => s.grove.profile);
  const groveActive = useAppStore((s) => s.grove.isActive);

  const isAccelerateActive = useAppStore((s) => s.rewards.isAccelerateActive());

  const sliderThemeId = useUnifiedStore((s) => s.preferences.sliderThemeId);
  const updatePreferences = useUnifiedStore((s) => s.updatePreferences);

  // Dev accounts pay a 1-apple test price (see config/devUsers.ts).
  const authUserId = useAppStore((s) => s.auth.user?.id);
  const themeCost = sliderThemeCostForUser(authUserId);

  // Themes tab: 48 countries, sorted alphabetically by localized name with an
  // A-Z fast-scroll index (like iOS Contacts). `themeRows` flags the first card
  // of each letter — those cards report their y so the index can scroll to them.
  const scrollRef = useRef<ScrollView>(null);
  const themeOffsets = useRef<Record<string, number>>({});
  const themeRows = useMemo(() => {
    const sorted = SLIDER_THEMES.map((theme) => ({
      theme,
      name: t(`store.themes.${theme.id}`),
    })).sort((a, b) => a.name.localeCompare(b.name, i18n.language));
    let lastLetter = '';
    return sorted.map(({ theme, name }) => {
      const letter = name.charAt(0).toUpperCase();
      const sectionStart = letter !== lastLetter;
      lastLetter = letter;
      return { theme, name, letter, sectionStart };
    });
  }, [t, i18n.language]);
  const indexLetters = useMemo(() => {
    const letters: string[] = [];
    for (const row of themeRows) if (row.sectionStart) letters.push(row.letter);
    return letters;
  }, [themeRows]);
  const jumpToThemeLetter = (letter: string) => {
    const y = themeOffsets.current[letter];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: false });
  };

  const purchaseHistory = useMemo(() => {
    const purchases = rewards.purchases ?? { byId: {}, allIds: [] };
    return purchases.allIds
      .map((id) => purchases.byId[id])
      .filter((p): p is Purchase => !!p)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rewards.purchases]);

  const giftsById = useMemo(() => {
    const map: Record<string, GiftItem> = {};
    for (const g of groveGifts) map[g.id] = g;
    return map;
  }, [groveGifts]);

  // History = own purchase rows (incl. bought incoming gifts, product_id
  // `gift_<id>`) + synthesized entries for sent gifts that were bought. The
  // sender/recipient split prevents double entries: recipients render from
  // their purchase row, senders from the gift row.
  const historyEntries = useMemo<HistoryEntry[]>(() => {
    const entries: HistoryEntry[] = purchaseHistory.map((p) => ({
      kind: 'purchase',
      purchase: p,
      date: p.createdAt,
    }));
    for (const g of groveGifts) {
      if (!g.isIncoming && g.purchasedAt) {
        entries.push({ kind: 'sentGift', gift: g, date: g.purchasedAt });
      }
    }
    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchaseHistory, groveGifts]);

  // Each tab shows only its own slice of the history: Products ↔ accelerate/tip
  // purchases, Themes ↔ theme purchases, Custom ↔ custom rewards + gifts,
  // All ↔ everything.
  const visibleHistory = useMemo(() => {
    if (activeTab === 'all') return historyEntries;
    return historyEntries.filter((entry) => {
      if (entry.kind === 'sentGift') return activeTab === 'custom';
      const p = entry.purchase;
      const isTheme = !!themeIdFromProductId(p.productId);
      const isCustom =
        !!customRewardIdFromProductId(p.productId) || !!giftIdFromProductId(p.productId);
      if (activeTab === 'themes') return isTheme;
      if (activeTab === 'custom') return isCustom;
      return !isTheme && !isCustom;
    });
  }, [historyEntries, activeTab]);

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

  // Gift lifecycle buckets: incoming unbought → recipient's catalog (gift band
  // card); sent unbought → sender's cancellable list; purchased without a
  // photo → the "capture the moment" pending action shown to BOTH parties.
  const incomingGifts = useMemo(
    () => groveGifts.filter((g) => g.isIncoming && !g.purchasedAt),
    [groveGifts]
  );
  const sentUnboughtGifts = useMemo(
    () => groveGifts.filter((g) => !g.isIncoming && !g.purchasedAt),
    [groveGifts]
  );
  const pendingPhotoGifts = useMemo(
    () => groveGifts.filter((g) => g.purchasedAt && !g.photoUrl),
    [groveGifts]
  );

  // Purchase whose photo modal is open (null when closed).
  const photoPurchase = photoPurchaseId ? (rewards.purchases?.byId[photoPurchaseId] ?? null) : null;

  // Gift whose photo modal is open (null when closed).
  const photoGift = photoGiftId ? (giftsById[photoGiftId] ?? null) : null;

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

  // Refresh gifts on entry — they're server state another user can change at
  // any time (a friend sending/buying a gift), unlike the local-only catalog.
  useEffect(() => {
    const grove = useAppStore.getState().grove;
    if (grove.profile && grove.isActive) grove.fetchGifts();
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

  // Gifting requires an active Grove profile — the recipient picker is the
  // friends list. Without one, the button routes to Grove setup instead.
  const handleGiftButtonPress = () => {
    if (!groveProfile || !groveActive) {
      Alert.alert(t('store.giftSetupGroveTitle'), t('store.giftSetupGroveBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('store.giftSetupGroveAction'),
          onPress: () => router.push('/(modals)/grove-setup'),
        },
      ]);
      return;
    }
    // Refresh the recipient picker — the store can be reached without ever
    // visiting the Grove tab, so the friends list may be stale or unfetched.
    useAppStore.getState().grove.fetchFriends();
    setShowGiftModal(true);
  };

  const handleCreateGift = async (
    recipientId: string,
    name: string,
    cost: number,
    emoji?: string
  ) => {
    setShowGiftModal(false);
    try {
      await useAppStore.getState().grove.createGift({ recipientId, name, cost, emoji });
      showToast(t('store.giftCreated'), 'success');
    } catch (error) {
      console.error('Failed to create gift:', error);
      showToast(t('store.giftActionFailed'), 'error');
    }
  };

  const handlePurchaseGift = (gift: GiftItem) => {
    if (rewards.balance < gift.cost) {
      showToast(t('store.notEnoughN', { cost: gift.cost }), 'error');
      return;
    }
    Alert.alert(
      t('store.purchaseGiftTitle', { name: gift.name }),
      t('store.purchaseGiftBody', {
        name: gift.name,
        cost: gift.cost,
        sender: gift.otherProfile?.display_name ?? '',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('store.purchase'),
          onPress: async () => {
            try {
              await useAppStore.getState().grove.purchaseGift(gift.id);
              purchaseSuccessHaptic();
              showToast(t('store.giftPurchased', { name: gift.name }), 'success');
            } catch (error: any) {
              if (error?.message === 'ALREADY_PURCHASED') {
                showToast(t('store.giftAlreadyPurchased'), 'error');
              } else {
                showToast(t('store.purchaseFailed'), 'error');
              }
            }
          },
        },
      ]
    );
  };

  const handleCancelGift = (gift: GiftItem) => {
    Alert.alert(t('store.giftCancelTitle'), t('store.giftCancelBody', { name: gift.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await useAppStore.getState().grove.cancelGift(gift.id);
          } catch (error) {
            console.error('Failed to cancel gift:', error);
            showToast(t('store.giftActionFailed'), 'error');
          }
        },
      },
    ]);
  };

  // Gift photos are shared state (either party may capture, first wins), so
  // there is no local-first fallback — the pending action only clears once the
  // upload + RPC succeed. PHOTO_ALREADY_SET means the other party won the race;
  // the store already adopted their photo.
  const handleGiftPhotoPicked = async (giftId: string, uri: string) => {
    setGiftPhotoSaving(true);
    try {
      await useAppStore.getState().grove.setGiftPhoto(giftId, uri);
    } catch (error: any) {
      if (error?.message === 'PHOTO_ALREADY_SET') {
        showToast(t('store.giftPhotoAlreadySet'), 'neutral');
      } else {
        console.error('Failed to set gift photo:', error);
        showToast(t('journal.failedSavePhoto'), 'error');
      }
    } finally {
      setGiftPhotoSaving(false);
    }
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

      <ScrollView ref={scrollRef} className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Gift pending actions — bought gifts still missing their photo; shown
            to both sender and receiver until either captures the moment */}
        {(activeTab === 'all' || activeTab === 'custom') && pendingPhotoGifts.length > 0 && (
          <>
            <View className="mb-3 mt-4">
              <Typography variant="subtitle-14-semibold" color="secondary">
                {t('store.giftPendingSection')}
              </Typography>
            </View>

            {pendingPhotoGifts.map((gift) => (
              <View
                key={gift.id}
                className="
                  mb-4 rounded-2xl
                  border border-primary bg-light-border/30 p-5
                  dark:bg-[#242540]
                ">
                <View className="flex-row items-center justify-between">
                  <View className="mr-4 flex-1 flex-row items-center">
                    <Text style={{ fontSize: 28 }}>📸</Text>
                    <View className="ml-3 flex-1">
                      <Typography variant="subtitle-14-semibold">{gift.name}</Typography>
                      <View className="mt-1">
                        <Typography variant="body-12" color="secondary">
                          {gift.isIncoming
                            ? t('store.giftPendingDescReceiver', {
                                name: gift.otherProfile?.display_name ?? '',
                              })
                            : t('store.giftPendingDescSender', {
                                name: gift.otherProfile?.display_name ?? '',
                              })}
                        </Typography>
                      </View>
                    </View>
                  </View>

                  <Button size="small" onPress={() => setPhotoGiftId(gift.id)}>
                    {t('store.giftAddPhoto')}
                  </Button>
                </View>
              </View>
            ))}
          </>
        )}

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

            {themeRows.map(({ theme, name, letter, sectionStart }) => (
              <ThemeCard
                key={theme.id}
                flag={theme.flag}
                name={name}
                trackColors={theme.trackColors}
                thumbEmoji={theme.thumbEmoji}
                cost={themeCost}
                owned={ownedThemeIds.has(theme.id)}
                applied={sliderThemeId === theme.id}
                onBuy={() => handlePurchaseTheme(theme)}
                onApply={() => handleApplyTheme(theme.id)}
                // Only the first card of each letter reports its y — that's the
                // scroll target for the A-Z index.
                onLayout={
                  sectionStart
                    ? (e) => {
                        themeOffsets.current[letter] = e.nativeEvent.layout.y;
                      }
                    : undefined
                }
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

            {/* Incoming gifts — sit above the user's own rewards with a gift band */}
            {incomingGifts.map((gift) => (
              <GiftRewardCard key={gift.id} gift={gift} onBuy={() => handlePurchaseGift(gift)} />
            ))}

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

            {/* Gift card — dashed outline like Create; prompts Grove setup if needed */}
            <Pressable
              onPress={handleGiftButtonPress}
              className="
                mb-4 items-center rounded-2xl border border-dashed
                border-light-border bg-light-border/30 p-5
                active:opacity-80 dark:border-dark-border dark:bg-[#242540]
              ">
              <View className="flex-row items-center">
                <Ionicons name="gift-outline" size={22} color={colors.primary} />
                <View className="ml-2">
                  <Typography variant="subtitle-14-semibold" color="primary">
                    {t('store.giftCreate')}
                  </Typography>
                </View>
              </View>
            </Pressable>

            {/* Sent gifts — unbought, still cancellable */}
            {sentUnboughtGifts.length > 0 && (
              <>
                <View className="mb-3 mt-2">
                  <Typography variant="subtitle-14-semibold" color="secondary">
                    {t('store.giftSentSection')}
                  </Typography>
                </View>

                {sentUnboughtGifts.map((gift) => (
                  <View
                    key={gift.id}
                    className="
                      mb-4 rounded-2xl
                      border border-light-border bg-light-border/30 p-5
                      dark:border-dark-border dark:bg-[#242540]
                    ">
                    <View className="flex-row items-center justify-between">
                      <View className="mr-4 flex-1 flex-row items-center">
                        <Text style={{ fontSize: 28 }}>{gift.emoji ?? DEFAULT_GIFT_EMOJI}</Text>
                        <View className="ml-3 flex-1">
                          <Typography variant="subtitle-14-semibold">{gift.name}</Typography>
                          <View className="mt-1">
                            <Typography variant="body-12" color="secondary">
                              {t('store.giftForRecipient', {
                                name: gift.otherProfile?.display_name ?? '',
                              })}
                            </Typography>
                          </View>
                        </View>
                      </View>
                      <View className="flex-row items-center">
                        <View className="rounded-xl bg-primary/15 px-3 py-1.5">
                          <Typography variant="subtitle-14-semibold" color="primary">
                            🍎 {gift.cost}
                          </Typography>
                        </View>
                        <Pressable
                          onPress={() => handleCancelGift(gift)}
                          hitSlop={8}
                          className="ml-3 active:opacity-60">
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
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
              {visibleHistory.map((entry, index) => {
                const rowDate = new Date(entry.date).toLocaleDateString(i18n.language, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });

                // Sent gift that was bought — rendered straight from the gift
                // row (the recipient paid; the sender has no purchase row).
                if (entry.kind === 'sentGift') {
                  const gift = entry.gift;
                  return (
                    <Pressable
                      key={`gift-${gift.id}`}
                      onPress={() => setPhotoGiftId(gift.id)}
                      className={`
                        flex-row items-center py-4
                        ${index > 0 ? 'border-t border-light-border dark:border-dark-border' : ''}
                        active:opacity-70
                      `}>
                      <Text style={{ fontSize: 20 }}>{gift.emoji ?? DEFAULT_GIFT_EMOJI}</Text>
                      <View className="ml-3 flex-1">
                        <Typography variant="body-14">{gift.name}</Typography>
                        <View className="mt-1">
                          <Typography variant="body-12" color="secondary">
                            {t('store.giftForRecipient', {
                              name: gift.otherProfile?.display_name ?? '',
                            })}{' '}
                            · {rowDate}
                          </Typography>
                        </View>
                      </View>
                      {gift.photoUrl ? (
                        <Image
                          source={{ uri: gift.photoUrl }}
                          style={{ width: 44, height: 44, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="camera-outline" size={20} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                }

                const purchase = entry.purchase;
                const isTipRow = purchase.productId === 'usage_tip' && isKnownTipId(purchase.tipId);
                const isCustomRow = !!customRewardIdFromProductId(purchase.productId);
                // Bought incoming gift: the local purchase row carries the debit,
                // but name/emoji/photo resolve from the gift row (single source
                // of truth for the shared photo). Not tappable until fetched.
                const giftId = giftIdFromProductId(purchase.productId);
                const gift = giftId ? (giftsById[giftId] ?? null) : null;
                const isGiftRow = !!gift;
                return (
                  <Pressable
                    key={purchase.id}
                    disabled={!isTipRow && !isCustomRow && !isGiftRow}
                    onPress={() => {
                      if (isTipRow) setActiveTipId(purchase.tipId!);
                      else if (isCustomRow) setPhotoPurchaseId(purchase.id);
                      else if (gift) setPhotoGiftId(gift.id);
                    }}
                    className={`
                      flex-row items-center py-4
                      ${index > 0 ? 'border-t border-light-border dark:border-dark-border' : ''}
                      ${isTipRow || isCustomRow || isGiftRow ? 'active:opacity-70' : ''}
                    `}>
                    <Text style={{ fontSize: 20 }}>
                      {purchaseIcon(purchase, customRewardsById, giftsById)}
                    </Text>
                    <View className="ml-3 flex-1">
                      {isTipRow ? (
                        <Typography variant="body-14">
                          {t(`store.tips.${purchase.tipId}`)}
                        </Typography>
                      ) : (
                        <Typography variant="body-14">
                          {purchaseTitle(purchase, t, customRewardsById, giftsById)}
                        </Typography>
                      )}
                      <View className="mt-1">
                        <Typography variant="body-12" color="secondary">
                          {gift
                            ? `${t('store.giftFromSender', {
                                name: gift.otherProfile?.display_name ?? '',
                              })} · ${rowDate}`
                            : rowDate}
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
                    {/* Gift purchases: shared photo from the gift row */}
                    {isGiftRow &&
                      (gift?.photoUrl ? (
                        <Image
                          source={{ uri: gift.photoUrl }}
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

      {/* A-Z fast-scroll index — Themes tab only (the only long, purely
          alphabetical list). Floats in the right screen margin. */}
      {activeTab === 'themes' && (
        <AlphabetIndex letters={indexLetters} onSelect={jumpToThemeLetter} />
      )}

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
              {purchaseIcon(photoPurchase, customRewardsById, giftsById)}
            </Text>
            <Typography variant="headline-18" className="mb-1 text-center">
              {purchaseTitle(photoPurchase, t, customRewardsById, giftsById)}
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

      {/* Gift photo — view or capture the gifting moment. Either party can add
          the photo (first wins); once set, it's locked and the buttons hide. */}
      <Modal isVisible={photoGift !== null} onClose={() => setPhotoGiftId(null)}>
        {photoGift && (
          <View className="items-center">
            <Text style={{ fontSize: 40, marginBottom: 12 }}>
              {photoGift.emoji ?? DEFAULT_GIFT_EMOJI}
            </Text>
            <Typography variant="headline-18" className="mb-1 text-center">
              {photoGift.name}
            </Typography>
            <Typography variant="body-12" color="secondary" className="mb-4 text-center">
              {photoGift.isIncoming
                ? t('store.giftFromSender', { name: photoGift.otherProfile?.display_name ?? '' })
                : t('store.giftForRecipient', { name: photoGift.otherProfile?.display_name ?? '' })}
              {photoGift.purchasedAt
                ? ` · ${new Date(photoGift.purchasedAt).toLocaleDateString(i18n.language, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}`
                : ''}
            </Typography>

            {photoGift.photoUrl ? (
              <Image
                source={{ uri: photoGift.photoUrl }}
                style={{ width: '100%', height: 200, borderRadius: 12, marginBottom: 16 }}
                resizeMode="cover"
              />
            ) : (
              <Typography variant="body-14" color="secondary" className="mb-4 text-center">
                {t('store.giftAddPhotoHint')}
              </Typography>
            )}

            {!photoGift.photoUrl && (
              <View className="mb-5 flex-row gap-x-3">
                <Pressable
                  disabled={giftPhotoSaving}
                  onPress={() =>
                    pickImage('library', (uri) => handleGiftPhotoPicked(photoGift.id, uri))
                  }
                  className={`flex-row items-center rounded-xl bg-primary/20 px-4 py-2.5 ${
                    giftPhotoSaving ? 'opacity-50' : 'active:opacity-70'
                  }`}>
                  <Ionicons name="images-outline" size={16} color={colors.primary} />
                  <Typography variant="body-12" className="ml-1.5 text-primary">
                    {t('journal.library')}
                  </Typography>
                </Pressable>
                <Pressable
                  disabled={giftPhotoSaving}
                  onPress={() =>
                    pickImage('camera', (uri) => handleGiftPhotoPicked(photoGift.id, uri))
                  }
                  className={`flex-row items-center rounded-xl bg-primary/20 px-4 py-2.5 ${
                    giftPhotoSaving ? 'opacity-50' : 'active:opacity-70'
                  }`}>
                  <Ionicons name="camera-outline" size={16} color={colors.primary} />
                  <Typography variant="body-12" className="ml-1.5 text-primary">
                    {t('journal.camera')}
                  </Typography>
                </Pressable>
              </View>
            )}

            <Button onPress={() => setPhotoGiftId(null)} size="medium">
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

      {/* Create gift for a Grove friend */}
      <GiftRewardModal
        visible={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        onCreate={handleCreateGift}
      />
    </SafeAreaView>
  );
}

// An incoming, un-bought gift in the recipient's catalog: same card layout as
// CustomRewardCard plus the "gift band" — a 🎀 ribbon tab and primary border —
// and a "from {sender}" note. No delete affordance: only the sender can cancel.
function GiftRewardCard({ gift, onBuy }: { gift: GiftItem; onBuy: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onBuy}
      className="
        mb-4 rounded-2xl
        border border-primary bg-light-border/30 p-5
        active:opacity-80 dark:bg-[#242540]
      ">
      {/* Gift band — ribbon tab hanging from the card's top edge */}
      <View className="absolute rounded-b-lg bg-primary px-2 py-0.5" style={{ top: 0, left: 16 }}>
        <Text style={{ fontSize: 12 }}>🎀</Text>
      </View>
      <View className="flex-row items-center justify-between">
        <View className="mr-4 flex-1 flex-row items-center">
          <Text style={{ fontSize: 28 }}>{gift.emoji ?? DEFAULT_GIFT_EMOJI}</Text>
          <View className="ml-3 flex-1">
            <Typography variant="subtitle-14-semibold">{gift.name}</Typography>
            <View className="mt-1">
              <Typography variant="body-12" color="secondary">
                {t('store.giftFromSender', { name: gift.otherProfile?.display_name ?? '' })}
              </Typography>
            </View>
          </View>
        </View>
        <View className="rounded-xl bg-primary/15 px-3 py-1.5">
          <Typography variant="subtitle-14-semibold" color="primary">
            🍎 {gift.cost}
          </Typography>
        </View>
      </View>
    </Pressable>
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
  onLayout,
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
  /** Reports the card's y within the scroll content (used by the A-Z index). */
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onLayout={onLayout}
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

// iOS-Contacts-style A-Z fast-scroll index for the Themes tab. Floats in the
// right margin; touching/dragging a letter jumps the list to the first country
// under that letter (offsets reported by the section-start ThemeCards). Letters
// are derived from the localized names, so the index adapts per language.
const LETTER_ROW_HEIGHT = 16;

function AlphabetIndex({
  letters,
  onSelect,
}: {
  letters: string[];
  onSelect: (letter: string) => void;
}) {
  const colorScheme = useColorScheme();
  const lastLetter = useRef<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const pick = (e: GestureResponderEvent) => {
    if (letters.length === 0) return;
    const idx = Math.min(
      letters.length - 1,
      Math.max(0, Math.floor(e.nativeEvent.locationY / LETTER_ROW_HEIGHT))
    );
    const letter = letters[idx];
    if (letter && letter !== lastLetter.current) {
      lastLetter.current = letter;
      setActive(letter);
      Haptics.selectionAsync().catch(() => {});
      onSelect(letter);
    }
  };

  const release = () => {
    lastLetter.current = null;
    setActive(null);
  };

  if (letters.length === 0) return null;
  const inactiveColor =
    colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' }}>
      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={release}
        onResponderTerminate={release}
        style={{ paddingHorizontal: 6 }}>
        {letters.map((letter) => (
          <View
            key={letter}
            style={{
              height: LETTER_ROW_HEIGHT,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text
              allowFontScaling={false}
              style={{
                fontSize: 11,
                fontWeight: active === letter ? '800' : '600',
                color: active === letter ? colors.primary : inactiveColor,
              }}>
              {letter}
            </Text>
          </View>
        ))}
      </View>
    </View>
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
