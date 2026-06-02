import { useState } from 'react';
import { View, SafeAreaView, Pressable, TextInput, KeyboardAvoidingView, ScrollView, Platform, useColorScheme, Image, ActivityIndicator, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Typography } from '../../src/components/ui';
import { FruitCounter } from '../../src/components/rewards';
import { calculateFruitsEarnedForDuration, useFocus, useFocusActions, useAppStore } from '../../src/store';
import { showToast } from '../../src/components/ui/Toast';
import { saveSessionPhoto, uploadSessionPhoto } from '../../src/services/sessionPhotoService';

export default function SessionCompleteModal() {
  const colorScheme = useColorScheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, tags } = useFocus();
  const { updateSession } = useFocusActions();

  const session = sessionId ? sessions.byId[sessionId] : null;

  const [notes, setNotes] = useState(session?.notes ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSavingPhoto, setIsUploadingPhoto] = useState(false);

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

  const hasExistingPhoto = !!session.photoUrl;

  const pickImage = async (source: 'library' | 'camera') => {
    try {
      // Request appropriate permission first
      const permissionResult =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        const target = source === 'camera' ? 'camera' : 'photo library';
        Alert.alert(
          'Permission Required',
          `Please allow access to your ${target} in Settings to add photos.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
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
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  };

  const handleDone = async () => {
    const trimmedNotes = notes.trim();
    if (trimmedNotes !== (session.notes ?? '')) {
      updateSession(session.id, { notes: trimmedNotes || undefined });
    }

    // Upload photo if one was selected
    if (photoUri) {
      setIsUploadingPhoto(true);
      try {
        // Save locally first (fast, works offline)
        const localUrl = await saveSessionPhoto(photoUri, session.id);
        updateSession(session.id, { photoUrl: localUrl });

        // Upload to Supabase for feed visibility, update to cloud URL on success
        try {
          const cloudUrl = await uploadSessionPhoto(photoUri, session.id);
          updateSession(session.id, { photoUrl: cloudUrl });
        } catch (uploadError) {
          console.warn('Failed to upload photo to cloud (local copy saved):', uploadError);
        }
      } catch (error) {
        console.error('Failed to save session photo:', error);
        showToast('Failed to save photo', 'error');
        setIsUploadingPhoto(false);
        return;
      }
      setIsUploadingPhoto(false);
    }

    // Check for active challenges matching this tag
    const grove = useAppStore.getState().grove;
    if (grove.profile && grove.isActive && session.tagId) {
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

          {/* Notes input */}
          <View className="w-full mb-6">
            <Typography variant="body-14" color="secondary" className="mb-2">
              Note
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

          {/* Photo section */}
          {!hasExistingPhoto && (
            <View className="w-full mb-6">
              <Typography variant="body-14" color="secondary" className="mb-2">
                Add a photo
              </Typography>
              {photoUri ? (
                <View>
                  <Image
                    source={{ uri: photoUri }}
                    style={{ width: '100%', height: 200, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => setPhotoUri(null)}
                    className="mt-2 flex-row items-center justify-center rounded-xl py-2.5 active:opacity-70"
                    style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Typography variant="body-12" className="ml-1.5" style={{ color: '#DC2626' }}>
                      Remove Photo
                    </Typography>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row gap-x-3">
                  <Pressable
                    onPress={() => pickImage('library')}
                    disabled={isSavingPhoto}
                    className="flex-row items-center bg-primary/20 rounded-xl px-4 py-3 active:opacity-70"
                  >
                    <Ionicons name="images-outline" size={18} color="#6592E9" />
                    <Typography variant="subtitle-14-medium" className="text-primary ml-2">
                      Library
                    </Typography>
                  </Pressable>

                  <Pressable
                    onPress={() => pickImage('camera')}
                    disabled={isSavingPhoto}
                    className="flex-row items-center bg-primary/20 rounded-xl px-4 py-3 active:opacity-70"
                  >
                    <Ionicons name="camera-outline" size={18} color="#6592E9" />
                    <Typography variant="subtitle-14-medium" className="text-primary ml-2">
                      Camera
                    </Typography>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {hasExistingPhoto && (
            <View className="w-full mb-6">
              <Typography variant="body-12" color="secondary" className="mb-2">
                Photo
              </Typography>
              <Image
                source={{ uri: session.photoUrl }}
                style={{ width: '100%', height: 200, borderRadius: 12 }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Done button */}
          <View className="mt-4">
            <Pressable
              onPress={handleDone}
              disabled={isSavingPhoto}
              className="bg-white rounded-2xl py-4 items-center active:opacity-80"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                opacity: isSavingPhoto ? 0.6 : 1,
              }}
            >
              {isSavingPhoto ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#1B1C30' : '#5D4E37'} />
                  <Typography
                    variant="subtitle-16"
                    className="font-semibold ml-2"
                    style={{ color: colorScheme === 'dark' ? '#1B1C30' : '#5D4E37' }}
                  >
                    Saving...
                  </Typography>
                </View>
              ) : (
                <Typography
                  variant="subtitle-16"
                  className="font-semibold"
                  style={{ color: colorScheme === 'dark' ? '#1B1C30' : '#5D4E37' }}
                >
                  Done
                </Typography>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
