import { useState } from 'react';
import { View, SafeAreaView, Pressable, TextInput, Alert, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui';
import { useRewards, useAppStore, useFocus } from '../../src/store';
import { showToast } from '../../src/components/ui/Toast';

export default function DevToolsModal() {
  const colorScheme = useColorScheme();
  const rewards = useRewards();
  const { sessions } = useFocus();
  const [fruitInput, setFruitInput] = useState(String(rewards.balance));
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const referralCount = useAppStore((s) => s.referral.referralCount);
  const claimedTier = useAppStore((s) => s.referral.claimedTier);
  const referralCode = useAppStore((s) => s.referral.referralCode);
  const applyReferralCode = useAppStore((s) => s.referral.applyReferralCode);
  const fetchReferralStatus = useAppStore((s) => s.referral.fetchReferralStatus);

  const setFruitBalance = (value: number) => {
    useAppStore.setState((state) => ({
      rewards: {
        ...state.rewards,
        balance: value,
      },
    }));
    setFruitInput(String(value));
  };

  const handleSetFruits = () => {
    const value = parseInt(fruitInput, 10);
    if (isNaN(value) || value < 0) {
      Alert.alert('Invalid', 'Enter a non-negative number');
      return;
    }
    setFruitBalance(value);
  };

  const handleClearSessions = () => {
    Alert.alert('Clear all sessions?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          useAppStore.setState((state) => ({
            focus: {
              ...state.focus,
              sessions: { ...state.focus.sessions, byId: {}, allIds: [] },
            },
          }));
        },
      },
    ]);
  };

  const sessionCount = sessions.allIds.length;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <Typography variant="headline-18" color="primary">
          Dev Tools
        </Typography>
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <Typography variant="body-14" className="text-primary">
            Done
          </Typography>
        </Pressable>
      </View>

      <View className="px-5 mt-4" style={{ gap: 24 }}>
        {/* Fruit Balance */}
        <View>
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            Fruit Balance (current: {rewards.balance})
          </Typography>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <TextInput
              value={fruitInput}
              onChangeText={setFruitInput}
              keyboardType="number-pad"
              style={{
                flex: 1,
                backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
              }}
            />
            <Pressable
              onPress={handleSetFruits}
              className="bg-primary rounded-xl px-5 py-3 active:opacity-80"
            >
              <Typography variant="subtitle-14-semibold" color="white">
                Set
              </Typography>
            </Pressable>
          </View>
          {/* Quick presets */}
          <View className="flex-row mt-3" style={{ gap: 8 }}>
            {[0, 10, 50, 100, 500].map((val) => (
              <Pressable
                key={val}
                onPress={() => setFruitBalance(val)}
                className="bg-gray-700 rounded-lg px-3 py-2 active:opacity-80"
              >
                <Typography variant="body-12" color="white">
                  {val}
                </Typography>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Sessions */}
        <View>
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            Sessions ({sessionCount})
          </Typography>
          <Pressable
            onPress={handleClearSessions}
            className="bg-red-900 rounded-xl py-3 items-center active:opacity-80"
          >
            <Typography variant="subtitle-14-semibold" color="white">
              Clear All Sessions
            </Typography>
          </Pressable>
        </View>

        {/* Onboarding */}
        <View>
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            Onboarding
          </Typography>
          <Pressable
            onPress={() => router.push('/onboarding')}
            className="bg-primary rounded-xl py-3 items-center active:opacity-80"
          >
            <Typography variant="subtitle-14-semibold" color="white">
              Replay Onboarding
            </Typography>
          </Pressable>
          <Typography variant="body-12" color="secondary" className="mt-2">
            Finish the flow to emit the onboarding_completed event.
          </Typography>
        </View>

        {/* Referral Testing */}
        <View>
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            Referral Testing
          </Typography>
          <View className="bg-gray-700 rounded-xl p-4 mb-3" style={{ gap: 4 }}>
            <Typography variant="body-12" color="secondary">
              My Code: {referralCode ?? 'none'}
            </Typography>
            <Typography variant="body-12" color="secondary">
              Referral Count: {referralCount}
            </Typography>
            <Typography variant="body-12" color="secondary">
              Claimed Tier: {claimedTier}
            </Typography>
          </View>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <TextInput
              value={referralCodeInput}
              onChangeText={setReferralCodeInput}
              placeholder="Enter referral code"
              placeholderTextColor="#666"
              style={{
                flex: 1,
                backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              onPress={async () => {
                if (!referralCodeInput.trim()) return;
                try {
                  await applyReferralCode(referralCodeInput.trim());
                  showToast('Referral code applied', 'success');
                  setReferralCodeInput('');
                  fetchReferralStatus();
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Failed to apply code');
                }
              }}
              className="bg-primary rounded-xl px-5 py-3 active:opacity-80"
            >
              <Typography variant="subtitle-14-semibold" color="white">
                Apply
              </Typography>
            </Pressable>
          </View>
          {/* Quick actions */}
          <View className="flex-row mt-3" style={{ gap: 8 }}>
            <Pressable
              onPress={() => fetchReferralStatus()}
              className="bg-gray-700 rounded-lg px-3 py-2 active:opacity-80"
            >
              <Typography variant="body-12" color="white">
                Refresh Status
              </Typography>
            </Pressable>
            <Pressable
              onPress={() => {
                useAppStore.setState((state: any) => ({
                  referral: {
                    ...state.referral,
                    referralCount: referralCount + 1,
                  },
                }));
              }}
              className="bg-gray-700 rounded-lg px-3 py-2 active:opacity-80"
            >
              <Typography variant="body-12" color="white">
                +1 Referral (local)
              </Typography>
            </Pressable>
            <Pressable
              onPress={() => {
                useAppStore.setState((state: any) => ({
                  referral: {
                    ...state.referral,
                    referralCount: 0,
                    claimedTier: 0,
                  },
                }));
              }}
              className="bg-gray-700 rounded-lg px-3 py-2 active:opacity-80"
            >
              <Typography variant="body-12" color="white">
                Reset
              </Typography>
            </Pressable>
          </View>
        </View>

        {/* Store snapshot */}
        <View>
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            Store Snapshot
          </Typography>
          <View className="bg-gray-700 rounded-xl p-4" style={{ gap: 4 }}>
            <Typography variant="body-12" color="secondary">
              Fruits: {rewards.balance} (earned: {rewards.totalEarned}, spent: {rewards.totalSpent})
            </Typography>
            <Typography variant="body-12" color="secondary">
              Sessions: {sessionCount}
            </Typography>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
