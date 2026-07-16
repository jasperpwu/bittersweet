import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/config/theme';
import { SetupStepIndicator } from '../../src/components/grove/SetupStepIndicator';
import { HandleInput } from '../../src/components/grove/HandleInput';
import { AvatarPicker } from '../../src/components/grove/AvatarPicker';
import { GenderPicker } from '../../src/components/grove/GenderPicker';
import { PrivacyToggleList } from '../../src/components/grove/PrivacyToggleList';
import { InterestPicker } from '../../src/components/grove/InterestPicker';
import { useHandleValidation } from '../../src/hooks/useHandleValidation';
import { useAppStore } from '../../src/store';
import { isDeviceOffline } from '../../src/utils/network';
import { useTranslation } from 'react-i18next';

const TOTAL_STEPS = 4;

const AVATAR_COLORS = [
  '#6592E9', '#E96565', '#65C4E9', '#E9A365',
  '#65E9A3', '#C465E9', '#E9E265', '#E965C4',
];

type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export default function GroveSetupModal() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const userId = useAppStore((s) => s.auth.user?.id);
  const tags = useAppStore((s) => s.focus.tags);
  const createProfile = useAppStore((s) => s.grove.createProfile);
  const uploadAvatar = useAppStore((s) => s.grove.uploadAvatar);
  const isLoading = useAppStore((s) => s.grove.isLoading);

  const [step, setStep] = useState(0);

  // Grove setup is cloud-only (no offline queue) — if the device is offline,
  // say so up front instead of letting the user fill in four steps that can't save.
  useEffect(() => {
    (async () => {
      if (await isDeviceOffline()) {
        Alert.alert(t('common.offlineTitle'), t('common.offlineTryFocus'), [
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 0: Name & Handle
  const [displayName, setDisplayName] = useState('');
  const { handle, status: handleStatus, setHandle, isValid: isHandleValid } = useHandleValidation();

  // Step 1: Avatar
  const avatarColor = userId
    ? AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length]
    : AVATAR_COLORS[0];
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Step 2: About
  const [gender, setGender] = useState<Gender | null>(null);
  const [interests, setInterests] = useState<string[]>([]);

  // Step 3: Privacy
  const [sharedTagIds, setSharedTagIds] = useState<string[]>([]);
  const [shareNotes, setShareNotes] = useState(false);
  const [showLiveStatus, setShowLiveStatus] = useState(false);

  const activeTags = tags.allIds
    .map((id) => tags.byId[id])
    .filter((tag) => tag && !tag.deletedAt)
    .map((tag) => ({ id: tag.id, name: tag.name, icon: tag.icon || '🎯' }));

  const canProceedStep0 =
    displayName.trim().length >= 1 &&
    displayName.trim().length <= 20 &&
    isHandleValid;

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    try {
      await createProfile(
        {
          display_name: displayName.trim(),
          handle,
          avatar_color: avatarColor,
          gender,
          interests,
        },
        {
          shared_tag_ids: sharedTagIds,
          share_notes: shareNotes,
          show_live_status: showLiveStatus,
        }
      );

      // Upload avatar if one was selected
      if (avatarUri) {
        try {
          await uploadAvatar(avatarUri);
        } catch {
          // Avatar upload failure is non-fatal
          console.warn('Avatar upload failed, profile created without avatar');
        }
      }

      router.back();
    } catch (error: any) {
      if (error.message === 'HANDLE_TAKEN') {
        Alert.alert(
          t('groveSetup.handleTakenTitle'),
          t('groveSetup.handleTakenBody'),
          [{ text: t('common.ok'), onPress: () => setStep(0) }]
        );
      } else if (await isDeviceOffline()) {
        // Stay in the modal so the entered data survives a retry once online.
        Alert.alert(t('common.offlineTitle'), t('common.offlineTryFocus'));
      } else {
        Alert.alert(t('common.error'), t('groveSetup.failedCreate'));
      }
    }
  };

  const handleToggleTag = (tagId: string) => {
    setSharedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View>
            <Typography variant="headline-20" color="primary" className="mb-2">
              {t('groveSetup.step0Title')}
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-6">
              {t('groveSetup.step0Sub')}
            </Typography>

            {/* Display Name */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('groveSetup.displayName')}
            </Typography>
            <TextInput
              value={displayName}
              onChangeText={(text) => setDisplayName(text.slice(0, 20))}
              placeholder={t('groveSetup.yourName')}
              placeholderTextColor={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
              autoCapitalize="words"
              maxLength={20}
              style={{
                backgroundColor: isDark ? colors.dark.card : colors.light.input,
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 48,
                fontSize: 14,
                color: isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary,
                fontFamily: 'Poppins-Regular',
                borderWidth: 1,
                borderColor: isDark ? colors.dark.border : colors.light.screenBorder,
              }}
            />
            <Typography variant="body-12" color="secondary" className="mt-1 ml-1">
              {displayName.length}/20
            </Typography>

            {/* Handle */}
            <Typography variant="subtitle-14-medium" color="primary" className="mt-4 mb-2">
              {t('groveSetup.handle')}
            </Typography>
            <HandleInput
              value={handle}
              onChangeText={setHandle}
              status={handleStatus}
            />
          </View>
        );

      case 1:
        return (
          <View>
            <Typography variant="headline-20" color="primary" className="mb-2">
              {t('groveSetup.step1Title')}
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-6">
              {t('groveSetup.step1Sub')}
            </Typography>

            <AvatarPicker
              avatarUri={avatarUri}
              displayName={displayName}
              avatarColor={avatarColor}
              isUploading={isUploading}
              onImageSelected={setAvatarUri}
            />
          </View>
        );

      case 2:
        return (
          <View>
            <Typography variant="headline-20" color="primary" className="mb-2">
              {t('groveSetup.step2Title')}
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-6">
              {t('groveSetup.step2Sub')}
            </Typography>

            {/* Gender */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('groveSetup.gender')}
            </Typography>
            <GenderPicker value={gender} onChange={setGender} />

            {/* Interests */}
            <Typography variant="subtitle-14-medium" color="primary" className="mt-6 mb-2">
              {t('groveSetup.interestsQ')}
            </Typography>
            <InterestPicker value={interests} onChange={setInterests} />
            <Typography variant="body-12" color="secondary" className="mt-2 ml-1">
              {t('groveSetup.interestsHint')}
            </Typography>
          </View>
        );

      case 3:
        return (
          <View>
            <Typography variant="headline-20" color="primary" className="mb-2">
              {t('groveSetup.step3Title')}
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-6">
              {t('groveSetup.step3Sub')}
            </Typography>

            <PrivacyToggleList
              tags={activeTags}
              sharedTagIds={sharedTagIds}
              shareNotes={shareNotes}
              showLiveStatus={showLiveStatus}
              onToggleTag={handleToggleTag}
              onToggleShareNotes={setShareNotes}
              onToggleShowLiveStatus={setShowLiveStatus}
            />
          </View>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;
  const canProceed =
    step === 0 ? canProceedStep0 :
    step === 1 ? true :  // avatar is optional
    step === 2 ? true :  // about is optional
    true;                // privacy always valid

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="h-[56px] px-5 flex-row items-center justify-between">
          {step > 0 ? (
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
              hitSlop={8}
            >
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
              />
            </Pressable>
          )}

          <SetupStepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

          <View className="w-10 h-10 -mr-2" />
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>

        {/* Bottom button */}
        <View className="px-5 pb-8 pt-4 bg-light-bg dark:bg-dark-bg border-t border-light-border/50 dark:border-dark-border/50">
          <Button
            variant="primary"
            size="large"
            fullWidth
            loading={isLoading}
            disabled={!canProceed}
            onPress={isLastStep ? handleComplete : handleNext}
          >
            {isLastStep ? t('groveSetup.createProfile') : t('groveSetup.continue')}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
