import { useState } from 'react';
import { View, SafeAreaView, Pressable, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui';
import { useRewards, useAppStore, useFocus } from '../../src/store';

export default function DevToolsModal() {
  const rewards = useRewards();
  const { sessions } = useFocus();
  const [fruitInput, setFruitInput] = useState(String(rewards.balance));

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
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <Typography variant="headline-18" color="white">
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
                backgroundColor: '#2A2A2A',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#444',
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
            <Typography variant="body-12" color="secondary">
              Transactions: {rewards.transactions.length}
            </Typography>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
