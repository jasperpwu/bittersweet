import { useState, useRef, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useColorScheme,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { Typography } from '../../src/components/ui';
import { HorizontalTagSelector } from '../../src/components/focus/TagSelector';
import { GoalProgressBanner } from '../../src/components/focus/GoalProgressBanner';
import { FocusRatingBlock, FocusRatingInsightsSheet } from '../../src/components/focus';
import { FruitCounter } from '../../src/components/rewards';
import {
  calculateFruitsEarnedForDuration,
  useFocus,
  useFocusActions,
  useAppStore,
} from '../../src/store';
import { suggestRating, shouldAutoRate } from '../../src/utils/focusRating';
import {
  getSessionMotionSnapshot,
  getMotionPermissionStatus,
  ensureMotionPermission,
} from '../../src/services/motionInsights';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { showToast } from '../../src/components/ui/Toast';
import { saveSessionPhoto, uploadSessionPhoto } from '../../src/services/sessionPhotoService';
import { CoachMark } from '../../src/components/ui/CoachMark/CoachMark';
import { useAppSettings } from '../../src/store/unified-store';
import { useSecondaryTagEnabled } from '../../src/hooks/useSecondaryTagEnabled';
import { useTranslation } from 'react-i18next';

export default function SessionCompleteModal() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { sessions, tags } = useFocus();
  const { updateSession, applyFocusRating } = useFocusActions();

  const session = sessionId ? sessions.byId[sessionId] : null;

  const secondaryTagEnabled = useSecondaryTagEnabled();
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [secondaryTag, setSecondaryTag] = useState<string>(session?.secondaryTagId ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSavingPhoto, setIsUploadingPhoto] = useState(false);

  // Coach mark
  const fruitRef = useRef<View>(null);
  const { preferences, updatePreferences } = useAppSettings();
  const [showFruitCoachMark, setShowFruitCoachMark] = useState(false);

  // Focus rating
  const [analyzingRating, setAnalyzingRating] = useState(false);
  const [showRatingInsights, setShowRatingInsights] = useState(false);
  const [showMotionPrimer, setShowMotionPrimer] = useState(false);
  const ratingComputedRef = useRef(false);

  // Give the full reward with no motion penalty (too short/manual, permission
  // declined, or no signal available).
  const applyFullRating = () => {
    if (!session) return;
    updateSession(session.id, {
      motionSummary: { signal: 'none', profile: 'unknown', recorder: null, activity: null, steps: null },
    });
    applyFocusRating(session.id, 5, 'suggested');
  };

  // Read motion for the session window and apply the suggested rating. Assumes the
  // Motion & Fitness permission has already been granted by the caller.
  const computeRatingFromMotion = async () => {
    if (!session) return;
    const tagForSession = session.tagId ? tags.byId[session.tagId] : null;
    setAnalyzingRating(true);
    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();
    try {
      const snapshot = await getSessionMotionSnapshot(startMs, endMs);
      updateSession(session.id, { motionSummary: snapshot });
      applyFocusRating(session.id, suggestRating(tagForSession?.activityType, snapshot), 'suggested');
    } catch {
      applyFullRating();
    } finally {
      setAnalyzingRating(false);
    }
  };

  // Compute the suggested focus rating from motion once per session. If the
  // session already has a rating (revisited, or user-set), leave it alone.
  useEffect(() => {
    if (!session || ratingComputedRef.current) return;
    ratingComputedRef.current = true;
    if (session.focusRating != null) return;

    if (
      !shouldAutoRate({ durationMinutes: session.duration, isManualEntry: session.isManualEntry })
    ) {
      // Too short / manual — give full reward, no penalty.
      applyFullRating();
      return;
    }

    (async () => {
      const status = await getMotionPermissionStatus();
      if (status === 'granted') {
        await computeRatingFromMotion();
        return;
      }
      if (status === 'denied') {
        // Can't read motion — full reward, no penalty.
        applyFullRating();
        return;
      }
      // Undetermined: explain why we need motion before the one-shot OS prompt.
      // Show the primer only once; after that, default to full reward.
      if (preferences.hasSeenMotionPrimer) {
        applyFullRating();
        return;
      }
      setShowMotionPrimer(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const handleMotionPrimerEnable = async () => {
    setShowMotionPrimer(false);
    await updatePreferences({ hasSeenMotionPrimer: true });
    const granted = await ensureMotionPermission();
    if (granted) await computeRatingFromMotion();
    else applyFullRating();
  };

  const handleMotionPrimerDecline = async () => {
    setShowMotionPrimer(false);
    await updatePreferences({ hasSeenMotionPrimer: true });
    applyFullRating();
  };

  // Celebration animations
  const emojiScale = useSharedValue(0);
  const durationTranslateY = useSharedValue(12);
  const durationOpacity = useSharedValue(0);
  const fruitScale = useSharedValue(1);

  // Trigger animations on mount
  useState(() => {
    // Emoji bounces in from scale 0 -> 1 with spring
    emojiScale.value = withSpring(1, { damping: 8, stiffness: 120 });

    // Duration fades in with upward slide after slight delay
    durationOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    durationTranslateY.value = withDelay(200, withTiming(0, { duration: 400 }));

    // Fruit counter pulses once after emoji lands
    fruitScale.value = withDelay(
      500,
      withSequence(
        withTiming(1.15, { duration: 200 }),
        withSpring(1, { damping: 10, stiffness: 150 })
      )
    );

    // Show fruit coach mark after animations settle (if applicable)
    setTimeout(() => {
      setShowFruitCoachMark(true);
    }, 1000);
  });

  const emojiAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));

  const durationAnimStyle = useAnimatedStyle(() => ({
    opacity: durationOpacity.value,
    transform: [{ translateY: durationTranslateY.value }],
  }));

  const fruitAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fruitScale.value }],
  }));

  // Read before any early return so hook order stays stable across renders.
  const accelerateMultiplier = useAppStore((s) => s.rewards.isAccelerateActive()) ? 2 : 1;

  if (!session) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-light-bg dark:bg-dark-bg">
        <Typography variant="body-14" color="secondary">
          {t('sessionComplete.notFound')}
        </Typography>
      </SafeAreaView>
    );
  }

  const tag = session.tagId ? tags.byId[session.tagId] : null;
  const fruitsEarned = calculateFruitsEarnedForDuration(
    session.duration,
    session.initialSetDuration ?? session.duration,
    accelerateMultiplier
  );
  // Base = pre-rating reward; displayed = after the focus-rating discount.
  const baseFruits = session.baseFruits ?? fruitsEarned;
  const displayFruits = session.awardedFruits ?? baseFruits;

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

    // Persist the optional secondary tag if the user changed it. The session was
    // created with only its primary tag, so the secondary tag's challenge
    // contribution must be recomputed here (await so the toast below is fresh).
    const prevSecondary = session.secondaryTagId ?? '';
    if (secondaryTag !== prevSecondary) {
      updateSession(session.id, { secondaryTagId: secondaryTag || undefined });
      const groveState = useAppStore.getState().grove;
      for (const tagId of [prevSecondary, secondaryTag]) {
        if (tagId && tagId !== session.tagId) {
          await groveState.recomputeChallengeHitsForTag(tagId).catch(() => {});
        }
      }
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
        showToast(t('journal.failedSavePhoto'), 'error');
        setIsUploadingPhoto(false);
        return;
      }
      setIsUploadingPhoto(false);
    }

    // Challenge hits were already recomputed when the session was created
    // (createCompletedSession). Just surface the current progress as a toast.
    const grove = useAppStore.getState().grove;
    if (grove.profile && grove.isActive && session.tagId) {
      const activeChallenges = grove.challenges.filter(
        (c) =>
          c.status === 'active' &&
          (c.tagId === session.tagId || (!!secondaryTag && c.tagId === secondaryTag))
      );
      for (const challenge of activeChallenges) {
        const myHits = challenge.myParticipant?.hits ?? 0;
        const periodLabel = challenge.period === 'daily' ? t('sessionComplete.day') : t('sessionComplete.week');
        showToast(t('sessionComplete.challengeToast', { period: periodLabel, hits: myHits, total: challenge.totalPeriods }), 'success');
      }
    }

    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 60,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled">
          {/* Tag emoji + name */}
          <View className="mb-6 items-center">
            <Animated.View style={emojiAnimStyle}>
              <Typography variant="headline-24" color="primary" className="mb-2">
                {tag?.icon || '🏷️'}
              </Typography>
            </Animated.View>
            <Typography variant="headline-20" color="primary">
              {tag?.name || t('journal.focusSession')}
            </Typography>
          </View>

          {/* Duration */}
          <Animated.View className="items-center" style={durationAnimStyle}>
            <Typography variant="headline-24" color="primary" className="mb-2">
              {formatDuration(session.duration)}
            </Typography>
          </Animated.View>

          {/* Start / End time */}
          <View className="mb-8 items-center">
            <Typography variant="body-14" color="secondary">
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </Typography>
          </View>

          {/* Suggested focus rating — scales the fruit reward */}
          {baseFruits > 0 && (
            <FocusRatingBlock
              rating={session.focusRating ?? null}
              analyzing={analyzingRating}
              onChange={(r) => applyFocusRating(session.id, r, 'user')}
              onWhyPress={() => setShowRatingInsights(true)}
            />
          )}

          {/* Fruits earned (after the rating discount) */}
          {baseFruits > 0 && (
            <View className="mb-8 items-center">
              <Animated.View
                ref={fruitRef}
                className="items-center rounded-2xl bg-light-border/30 px-6 py-4 dark:bg-gray-700"
                style={fruitAnimStyle}>
                <Typography variant="body-12" color="secondary" className="mb-1">
                  {t('sessionComplete.earned')}
                </Typography>
                <FruitCounter fruitCount={displayFruits} size="large" />
              </Animated.View>
            </View>
          )}

          {/* Notes input */}
          <View className="mb-6 w-full">
            <Typography variant="body-14" color="secondary" className="mb-2">
              {t('journal.note')}
            </Typography>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder={t('journal.notePlaceholder')}
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
            <Typography
              variant="body-12"
              color="secondary"
              className="mt-2"
              style={{ opacity: 0.6 }}>
              {t('sessionComplete.notesHelp')}
            </Typography>
          </View>

          {/* Optional secondary tag (premium Multi-Task mode) — two activities at once */}
          {secondaryTagEnabled && (
            <View className="mb-6 w-full">
              <Typography variant="body-14" color="secondary" className="mb-2">
                {t('journal.secondaryTag')}
              </Typography>
              <HorizontalTagSelector
                tags={tags.allIds
                  .map((id) => tags.byId[id])
                  .filter((t) => t && !t.deletedAt && t.id !== session.tagId)}
                selectedTags={secondaryTag ? [secondaryTag] : []}
                onTagSelect={(id) => setSecondaryTag((prev) => (prev === id ? '' : id))}
                maxSelections={1}
              />
            </View>
          )}

          {/* Photo section */}
          {!hasExistingPhoto && (
            <View className="mb-6 w-full">
              <Typography variant="body-14" color="secondary" className="mb-2">
                {t('journal.addPhoto')}
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
                    style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}>
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Typography variant="body-12" className="ml-1.5" style={{ color: '#DC2626' }}>
                      {t('journal.removePhoto')}
                    </Typography>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row gap-x-3">
                  <Pressable
                    onPress={() => pickImage('library')}
                    disabled={isSavingPhoto}
                    className="flex-row items-center rounded-xl bg-primary/20 px-4 py-3 active:opacity-70">
                    <Ionicons name="images-outline" size={18} color="#6592E9" />
                    <Typography variant="subtitle-14-medium" className="ml-2 text-primary">
                      {t('journal.library')}
                    </Typography>
                  </Pressable>

                  <Pressable
                    onPress={() => pickImage('camera')}
                    disabled={isSavingPhoto}
                    className="flex-row items-center rounded-xl bg-primary/20 px-4 py-3 active:opacity-70">
                    <Ionicons name="camera-outline" size={18} color="#6592E9" />
                    <Typography variant="subtitle-14-medium" className="ml-2 text-primary">
                      {t('journal.camera')}
                    </Typography>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {hasExistingPhoto && (
            <View className="mb-6 w-full">
              <Typography variant="body-12" color="secondary" className="mb-2">
                {t('journal.photo')}
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
              className="items-center rounded-2xl bg-white py-4 active:opacity-80"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8,
                opacity: isSavingPhoto ? 0.6 : 1,
              }}>
              {isSavingPhoto ? (
                <View className="flex-row items-center">
                  <ActivityIndicator
                    size="small"
                    color={colorScheme === 'dark' ? '#1B1C30' : '#5D4E37'}
                  />
                  <Typography
                    variant="subtitle-16"
                    className="ml-2 font-semibold"
                    style={{ color: colorScheme === 'dark' ? '#1B1C30' : '#5D4E37' }}>
                    {t('journal.saving')}
                  </Typography>
                </View>
              ) : (
                <Typography
                  variant="subtitle-16"
                  className="font-semibold"
                  style={{ color: colorScheme === 'dark' ? '#1B1C30' : '#5D4E37' }}>
                  {t('common.done')}
                </Typography>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Goal progress banner — animates the goal bar for this session's tag */}
      <GoalProgressBanner session={session} />

      {/* Fruit Coach Mark */}
      {fruitsEarned > 0 && (
        <CoachMark
          targetRef={fruitRef as React.RefObject<View>}
          title={t('sessionComplete.coachTitle')}
          message={t('sessionComplete.coachMessage')}
          visible={showFruitCoachMark && !preferences.hasSeenFruitCoachMark}
          onDismiss={() => {
            setShowFruitCoachMark(false);
            updatePreferences({ hasSeenFruitCoachMark: true });
          }}
        />
      )}

      {/* Focus rating insights */}
      <FocusRatingInsightsSheet
        visible={showRatingInsights}
        onClose={() => setShowRatingInsights(false)}
        snapshot={session.motionSummary ?? null}
        activityType={tag?.activityType}
        rating={session.focusRating ?? null}
      />

      {/* Motion permission priming — explains why before the one-shot OS prompt */}
      <BottomSheet
        isVisible={showMotionPrimer}
        onClose={handleMotionPrimerDecline}
        height={400}
      >
        <View className="items-center mb-4">
          <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4 bg-primary/15">
            <Ionicons name="walk-outline" size={32} color="#8B7FFF" />
          </View>
          <Typography variant="headline-20" color="primary" className="text-center">
            {t('sessionComplete.motionPrimerTitle')}
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center mt-2">
            {t('sessionComplete.motionPrimerBody')}
          </Typography>
          <Typography variant="body-12" color="secondary" className="text-center mt-3" style={{ opacity: 0.7 }}>
            {t('sessionComplete.motionPrimerPrivacy')}
          </Typography>
        </View>

        <Pressable
          onPress={handleMotionPrimerEnable}
          className="items-center rounded-2xl bg-primary py-4 active:opacity-80"
        >
          <Typography variant="subtitle-16" className="font-semibold text-white">
            {t('sessionComplete.motionPrimerEnable')}
          </Typography>
        </Pressable>
        <Pressable
          onPress={handleMotionPrimerDecline}
          className="items-center py-3 mt-1 active:opacity-70"
        >
          <Typography variant="subtitle-14-medium" color="secondary">
            {t('sessionComplete.motionPrimerDecline')}
          </Typography>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}
