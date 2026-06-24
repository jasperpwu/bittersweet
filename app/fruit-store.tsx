import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, useColorScheme, Text, Alert } from 'react-native';
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

const SETUP_TASK_META: { id: SetupTaskId; icon: string; titleKey: string; descKey: string }[] = [
  { id: 'widget', icon: '📱', titleKey: 'store.taskWidgetTitle', descKey: 'store.taskWidgetDesc' },
  { id: 'goal', icon: '🎯', titleKey: 'store.taskGoalTitle', descKey: 'store.taskGoalDesc' },
];

export default function FruitStoreScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const rewards = useRewards();
  const [showTipModal, setShowTipModal] = useState(false);

  const [claimedTitle, setClaimedTitle] = useState<string | null>(null);

  const isAccelerateActive = useAppStore((s) => s.rewards.isAccelerateActive());

  // Only surface tasks that are set up but not yet claimed — claimed tasks disappear.
  const pendingTasks = SETUP_TASK_META.filter(
    (meta) => rewards.tasks[meta.id].everSetup && !rewards.tasks[meta.id].claimed,
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
    Alert.alert(
      t('store.purchaseAccelTitle'),
      t('store.purchaseAccelBody'),
      [
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
      ],
    );
  };

  const handlePurchaseTip = () => {
    if (rewards.balance < 5) {
      showToast(t('store.notEnough5'), 'error');
      return;
    }
    Alert.alert(
      t('store.purchaseTipTitle'),
      t('store.purchaseTipBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('store.purchase'),
          onPress: () => {
            try {
              useAppStore.getState().rewards.spendFruits(5, 'product_tip', { product: 'usage_tip' });
              setShowTipModal(true);
            } catch {
              showToast(t('store.purchaseFailed'), 'error');
            }
          },
        },
      ],
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
      <View className="flex-row items-center justify-between px-5 pt-3 pb-4">
        <Pressable
          onPress={() => router.back()}
          className="flex-row items-center active:opacity-70"
          hitSlop={8}
        >
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
            }}
          >
            {t('store.back')}
          </Text>
        </Pressable>

        <Typography variant="headline-18">{t('store.title')}</Typography>

        <FruitCounter fruitCount={rewards.balance} size="small" />
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Tasks Section — one-time setup rewards, only shown while claimable */}
        {pendingTasks.length > 0 && (
          <>
            <View className="mt-4 mb-3">
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
        <View className="mt-4 mb-3">
          <Typography variant="subtitle-14-semibold" color="secondary">
            {t('store.products')}
          </Typography>
        </View>

        {/* Accelerate Card */}
        <Pressable
          onPress={handlePurchaseAccelerate}
          disabled={isAccelerateActive}
          className={`
            bg-light-border/30 dark:bg-[#242540]
            rounded-2xl border border-light-border dark:border-dark-border
            p-5 mb-4
            ${isAccelerateActive ? 'opacity-60' : 'active:opacity-80'}
          `}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-4">
              <View className="flex-row items-center mb-2">
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
            <View className="bg-primary/15 rounded-xl px-3 py-1.5">
              <Typography variant="subtitle-14-semibold" color="primary">
                🍎 50
              </Typography>
            </View>
          </View>
        </Pressable>

        {/* Product Usage Tip */}
        <Pressable
          onPress={handlePurchaseTip}
          className="
            bg-light-border/30 dark:bg-[#242540]
            rounded-2xl border border-light-border dark:border-dark-border
            p-5 mb-4
            active:opacity-80
          "
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-4">
              <View className="flex-row items-center mb-2">
                <Text style={{ fontSize: 28 }}>💡</Text>
                <View className="ml-3 flex-1">
                  <Typography variant="subtitle-14-semibold">
                    {t('store.tipTitle')}
                  </Typography>
                </View>
              </View>
              <Typography variant="body-14" color="secondary">
                {t('store.tipDesc')}
              </Typography>
            </View>
            <View className="bg-primary/15 rounded-xl px-3 py-1.5">
              <Typography variant="subtitle-14-semibold" color="primary">
                🍎 5
              </Typography>
            </View>
          </View>
        </Pressable>

        {/* Coming Soon Banner */}
        <View className="bg-primary/10 rounded-2xl p-5 mt-4 items-center">
          <Text style={{ fontSize: 24, marginBottom: 8 }}>🏪</Text>
          <Typography variant="subtitle-14-semibold" color="primary">
            {t('store.comingSoon')}
          </Typography>
          <View className="mt-2">
            <Typography
              variant="body-14"
              color="secondary"
              className="text-center"
            >
              {t('store.comingSoonDesc')}
            </Typography>
          </View>
        </View>

        <View className="mb-8" />
      </ScrollView>

      {/* Tip Modal */}
      <Modal isVisible={showTipModal} onClose={() => setShowTipModal(false)} size="small">
        <View className="items-center">
          <Text style={{ fontSize: 40, marginBottom: 16 }}>💡</Text>
          <Typography variant="headline-18" className="text-center mb-3">
            {t('store.proTip')}
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center mb-6">
            {t('store.proTipBody')}
          </Typography>
          <Button onPress={() => setShowTipModal(false)} size="medium">
            {t('store.gotIt')}
          </Button>
        </View>
      </Modal>

      {/* Task claimed pop-up */}
      <Modal isVisible={claimedTitle !== null} onClose={() => setClaimedTitle(null)} size="small">
        <View className="items-center">
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🎉</Text>
          <Typography variant="headline-18" className="text-center mb-3">
            {t('store.claimedTitle', { count: SETUP_TASK_REWARD })}
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center mb-6">
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
        bg-light-border/30 dark:bg-[#242540]
        rounded-2xl border border-light-border dark:border-dark-border
        p-5 mb-4
      "
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-4">
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
