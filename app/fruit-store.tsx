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

const SETUP_TASK_META: { id: SetupTaskId; icon: string; title: string; description: string }[] = [
  { id: 'widget', icon: '📱', title: 'Set Up a Widget', description: 'Add a Bittersweet widget to your home screen' },
  { id: 'goal', icon: '🎯', title: 'Set a Goal', description: 'Create a focus goal for any tag' },
];

export default function FruitStoreScreen() {
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
      showToast('This reward is no longer available to claim.', 'error');
    }
  };

  const handlePurchaseAccelerate = () => {
    if (rewards.balance < 50) {
      showToast('Not enough apples! You need 50 apples.', 'error');
      return;
    }
    Alert.alert(
      'Purchase Accelerate Card',
      'This will cost 50 apples and take effect immediately. Double your apple generation speed for 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: () => {
            try {
              useAppStore.getState().rewards.activateAccelerateCard();
              showToast('Accelerate card activated! Double apples for 24 hours.', 'success');
            } catch {
              showToast('Purchase failed. Please try again.', 'error');
            }
          },
        },
      ],
    );
  };

  const handlePurchaseTip = () => {
    if (rewards.balance < 5) {
      showToast('Not enough apples! You need 5 apples.', 'error');
      return;
    }
    Alert.alert(
      'Purchase Usage Tip',
      'Are you sure you want to spend 5 apples on a pro tip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: () => {
            try {
              useAppStore.getState().rewards.spendFruits(5, 'product_tip', { product: 'usage_tip' });
              setShowTipModal(true);
            } catch {
              showToast('Purchase failed. Please try again.', 'error');
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
    return `${hours}h ${minutes}m remaining`;
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
            Back
          </Text>
        </Pressable>

        <Typography variant="headline-18">Apple Store</Typography>

        <FruitCounter fruitCount={rewards.balance} size="small" />
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Tasks Section — one-time setup rewards, only shown while claimable */}
        {pendingTasks.length > 0 && (
          <>
            <View className="mt-4 mb-3">
              <Typography variant="subtitle-14-semibold" color="secondary">
                Tasks
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
            Products
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
                    Accelerate Card
                  </Typography>
                </View>
              </View>
              <Typography variant="body-14" color="secondary">
                Double apple generation speed for 1 day
              </Typography>
              {isAccelerateActive && (
                <View className="mt-2">
                  <Typography variant="body-12" color="success">
                    Active — {accelerateTimeRemaining()}
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
                    Product Usage Tip
                  </Typography>
                </View>
              </View>
              <Typography variant="body-14" color="secondary">
                Get a pro tip for the app
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
            Coming Soon
          </Typography>
          <View className="mt-2">
            <Typography
              variant="body-14"
              color="secondary"
              className="text-center"
            >
              We are working closely with merchants to bring coupons for you!
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
            Pro Tip
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center mb-6">
            Use infinite session when you want to focus as long as you can, to
            maximize fruit accumulation
          </Typography>
          <Button onPress={() => setShowTipModal(false)} size="medium">
            Got it!
          </Button>
        </View>
      </Modal>

      {/* Task claimed pop-up */}
      <Modal isVisible={claimedTitle !== null} onClose={() => setClaimedTitle(null)} size="small">
        <View className="items-center">
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🎉</Text>
          <Typography variant="headline-18" className="text-center mb-3">
            {`+${SETUP_TASK_REWARD} 🍎 Claimed!`}
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center mb-6">
            {`You earned ${SETUP_TASK_REWARD} apples for "${claimedTitle}". Enjoy!`}
          </Typography>
          <Button onPress={() => setClaimedTitle(null)} size="medium">
            Awesome!
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
  meta: { id: SetupTaskId; icon: string; title: string; description: string };
  onClaim: (taskId: SetupTaskId, title: string) => void;
}) {
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
            <Typography variant="subtitle-14-semibold">{meta.title}</Typography>
            <View className="mt-1">
              <Typography variant="body-12" color="secondary">
                {`Ready to claim 🍎 ${SETUP_TASK_REWARD}`}
              </Typography>
            </View>
          </View>
        </View>

        <Button size="small" onPress={() => onClaim(meta.id, meta.title)}>
          {`Claim 🍎 ${SETUP_TASK_REWARD}`}
        </Button>
      </View>
    </View>
  );
}
