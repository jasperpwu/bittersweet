import { useState } from 'react';
import { View, SafeAreaView, Pressable, TextInput, KeyboardAvoidingView, ScrollView, Platform, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from '../../src/components/ui';
import { FruitCounter } from '../../src/components/rewards';
import { calculateFruitsEarnedForDuration, useFocus, useFocusActions, useAppStore } from '../../src/store';
import { showToast } from '../../src/components/ui/Toast';

export default function SessionCompleteModal() {
  const colorScheme = useColorScheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, tags } = useFocus();
  const { updateSession } = useFocusActions();

  const session = sessionId ? sessions.byId[sessionId] : null;

  const [notes, setNotes] = useState('');

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg items-center justify-center">
        <Typography variant="body-14" color="secondary">
          Session not found
        </Typography>
      </SafeAreaView>
    );
  }

  const tag = session.tagId ? tags.byId[session.tagId] : null;
  const accelerateMultiplier = useAppStore((s) => s.rewards.isAccelerateActive()) ? 2 : 1;
  const fruitsEarned = calculateFruitsEarnedForDuration(
    session.duration,
    session.initialSetDuration ?? session.duration,
    accelerateMultiplier
  );

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasExistingNotes = !!session.notes;

  const handleDone = async () => {
    if (notes.trim()) {
      updateSession(session.id, { notes: notes.trim() });
    }

    // Auto-share to Grove if tag is in shared_tag_ids
    const grove = useAppStore.getState().grove;
    if (grove.profile && grove.isActive && grove.privacySettings && session.tagId) {
      const sharedTagIds = grove.privacySettings.shared_tag_ids || [];
      if (sharedTagIds.includes(session.tagId)) {
        const shareNotes = grove.privacySettings.share_notes ? (notes.trim() || session.notes || null) : null;
        grove.shareSession({
          sessionId: session.id,
          tagId: session.tagId,
          tagName: tag?.name || 'Focus',
          tagIcon: tag?.icon || '🎯',
          duration: session.duration,
          startTime: new Date(session.startTime).toISOString(),
          endTime: new Date(session.endTime).toISOString(),
          notes: shareNotes,
        });
        showToast('Shared to Grove', 'success');
      }

      // Check for active challenges matching this tag
      const activeChallenges = grove.challenges.filter(
        (c) => c.status === 'active' && c.tagId === session.tagId
      );
      for (const challenge of activeChallenges) {
        try {
          const result = await grove.recordChallengeProgress(challenge.id);
          if (result.status === 'completed' && result.reward) {
            useAppStore.getState().rewards.earnFruits(result.reward, 'Challenge completed');
            showToast(`Challenge complete! +${result.reward} fruits`, 'success');
          } else if (result.status === 'progress') {
            showToast(`Streak updated! Day ${result.streak}`, 'success');
          }
        } catch (error) {
          console.error('Failed to record challenge progress:', error);
        }
      }
    }

    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tag emoji + name */}
          <View className="items-center mb-6">
            <Typography variant="headline-24" color="primary" className="mb-2">
              {tag?.icon || '🏷️'}
            </Typography>
            <Typography variant="headline-20" color="primary">
              {tag?.name || 'Focus Session'}
            </Typography>
          </View>

          {/* Duration */}
          <View className="items-center">
            <Typography variant="headline-24" color="primary" className="mb-2">
              {formatDuration(session.duration)}
            </Typography>
          </View>

          {/* Start / End time */}
          <View className="items-center mb-8">
            <Typography variant="body-14" color="secondary">
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </Typography>
          </View>

          {/* Fruits earned */}
          {fruitsEarned > 0 && (
            <View className="items-center mb-8">
              <View className="bg-light-border/30 dark:bg-gray-700 rounded-2xl px-6 py-4 items-center">
                <Typography variant="body-12" color="secondary" className="mb-1">
                  Earned
                </Typography>
                <FruitCounter fruitCount={fruitsEarned} size="large" />
              </View>
            </View>
          )}

          {/* Inline notes input (only if no notes on the session) */}
          {!hasExistingNotes && (
            <View className="w-full mb-6">
              <Typography variant="body-14" color="secondary" className="mb-2">
                Add a note
              </Typography>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="How did this session go?"
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{
                  backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 14,
                  color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                  borderWidth: 1,
                  borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
                  minHeight: 80,
                }}
              />
              <Typography variant="body-12" color="secondary" className="mt-2" style={{ opacity: 0.6 }}>
                Your notes help summarize your week and generate tips.
              </Typography>
            </View>
          )}

          {hasExistingNotes && (
            <View className="w-full bg-light-border/30 dark:bg-gray-700 rounded-xl p-4 mb-6">
              <Typography variant="body-12" color="secondary" className="mb-1">
                Notes
              </Typography>
              <Typography variant="body-14" color="primary">
                {session.notes}
              </Typography>
            </View>
          )}

          {/* Done button */}
          <View className="mt-4">
            <Pressable
              onPress={handleDone}
              className="bg-white rounded-2xl py-4 items-center active:opacity-80"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
              }}
            >
              <Typography
                variant="subtitle-16"
                className="font-semibold"
                style={{ color: colorScheme === 'dark' ? '#1B1C30' : '#5D4E37' }}
              >
                Done
              </Typography>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
