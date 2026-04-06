import { useState } from 'react';
import { View, SafeAreaView, Pressable, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from '../../src/components/ui';
import { FruitCounter } from '../../src/components/rewards';
import { useFocus, useFocusActions } from '../../src/store';

export default function SessionCompleteModal() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, tags } = useFocus();
  const { updateSession } = useFocusActions();

  const session = sessionId ? sessions.byId[sessionId] : null;

  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

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
  const fruitsEarned = Math.floor(session.duration / 5);

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

  const handleSaveNotes = () => {
    if (notes.trim()) {
      updateSession(session.id, { notes: notes.trim() });
      setNotesSaved(true);
    }
  };

  const handleDone = () => {
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      <View className="flex-1 items-center justify-center px-6">
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
        <Typography variant="headline-24" color="white" className="mb-2">
          {formatDuration(session.duration)}
        </Typography>

        {/* Start / End time */}
        <Typography variant="body-14" color="secondary" className="mb-8">
          {formatTime(session.startTime)} – {formatTime(session.endTime)}
        </Typography>

        {/* Fruits earned */}
        {fruitsEarned > 0 && (
          <View className="bg-gray-700 rounded-2xl px-6 py-4 items-center mb-8">
            <Typography variant="body-12" color="secondary" className="mb-1">
              Earned
            </Typography>
            <FruitCounter fruitCount={fruitsEarned} size="large" />
          </View>
        )}

        {/* Inline notes input (only if no notes on the session) */}
        {!hasExistingNotes && !notesSaved && (
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
            {notes.trim().length > 0 && (
              <Pressable
                onPress={handleSaveNotes}
                className="mt-3 bg-blue-600 rounded-xl py-3 items-center active:opacity-80"
              >
                <Typography variant="body-14" color="white" className="font-semibold">
                  Save Note
                </Typography>
              </Pressable>
            )}
          </View>
        )}

        {notesSaved && (
          <Typography variant="body-14" color="primary" className="mb-6">
            Note saved
          </Typography>
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
      </View>

      {/* Done button */}
      <View className="px-6 pb-8">
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
    </SafeAreaView>
  );
}
