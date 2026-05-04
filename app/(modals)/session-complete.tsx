import { useState } from 'react';
import { View, SafeAreaView, Pressable, TextInput, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from '../../src/components/ui';
import { FruitCounter } from '../../src/components/rewards';
import { calculateFruitsEarnedForDuration, useFocus, useFocusActions } from '../../src/store';

export default function SessionCompleteModal() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, tags } = useFocus();
  const { updateSession } = useFocusActions();

  const session = sessionId ? sessions.byId[sessionId] : null;

  const [notes, setNotes] = useState('');

  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-dark-bg items-center justify-center">
        <Typography variant="body-14" color="secondary">
          Session not found
        </Typography>
      </SafeAreaView>
    );
  }

  const tag = session.tagName ? tags.byName[session.tagName] : null;
  const fruitsEarned = calculateFruitsEarnedForDuration(
    session.duration,
    session.initialSetDuration ?? session.duration
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

  const handleDone = () => {
    if (notes.trim()) {
      updateSession(session.id, { notes: notes.trim() });
    }
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
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
            <Typography variant="headline-24" color="white" className="mb-2">
              {tag?.icon || '🏷️'}
            </Typography>
            <Typography variant="headline-20" color="white">
              {tag?.name || session.tagName}
            </Typography>
          </View>

          {/* Duration */}
          <View className="items-center">
            <Typography variant="headline-24" color="white" className="mb-2">
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
              <View className="bg-gray-700 rounded-2xl px-6 py-4 items-center">
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
                  backgroundColor: '#2A2A2A',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 14,
                  color: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#444',
                  minHeight: 80,
                }}
              />
              <Typography variant="body-12" color="secondary" className="mt-2" style={{ opacity: 0.6 }}>
                Your notes help summarize your week and generate tips.
              </Typography>
            </View>
          )}

          {hasExistingNotes && (
            <View className="w-full bg-gray-700 rounded-xl p-4 mb-6">
              <Typography variant="body-12" color="secondary" className="mb-1">
                Notes
              </Typography>
              <Typography variant="body-14" color="white">
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
                style={{ color: '#1B1C30' }}
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
