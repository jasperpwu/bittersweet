import React, { useState } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SetupStepIndicator } from '../../src/components/grove/SetupStepIndicator';
import { HandleInput } from '../../src/components/grove/HandleInput';
import { AvatarPicker } from '../../src/components/grove/AvatarPicker';
import { GenderPicker } from '../../src/components/grove/GenderPicker';
import { PrivacyToggleList } from '../../src/components/grove/PrivacyToggleList';
import { InterestPicker } from '../../src/components/grove/InterestPicker';
import { useHandleValidation } from '../../src/hooks/useHandleValidation';
import { useAppStore } from '../../src/store';

const TOTAL_STEPS = 4;

const AVATAR_COLORS = [
  '#6592E9', '#E96565', '#65C4E9', '#E9A365',
  '#65E9A3', '#C465E9', '#E9E265', '#E965C4',
];

type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export default function GroveSetupModal() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const userId = useAppStore((s) => s.auth.user?.id);
  const tags = useAppStore((s) => s.focus.tags);
  const createProfile = useAppStore((s) => s.grove.createProfile);
  const uploadAvatar = useAppStore((s) => s.grove.uploadAvatar);
  const isLoading = useAppStore((s) => s.grove.isLoading);

  const [step, setStep] = useState(0);

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
          'Handle Unavailable',
          'This handle was just claimed by someone else. Please go back and choose a different one.',
          [{ text: 'OK', onPress: () => setStep(0) }]
        );
      } else {
        Alert.alert('Error', 'Failed to create profile. Please check your connection and try again.');
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
              What should we call you?
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-6">
              Choose a display name and a unique handle for your Grove profile.
            </Typography>

            {/* Display Name */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              Display Name
            </Typography>
            <TextInput
              value={displayName}
              onChangeText={(text) => setDisplayName(text.slice(0, 20))}
              placeholder="Your name"
              placeholderTextColor={isDark ? '#575757' : '#B8A88A'}
              autoCapitalize="words"
              maxLength={20}
              style={{
                backgroundColor: isDark ? '#242540' : '#F0E0CC',
                borderRadius: 12,
                paddingHorizontal: 16,
                height: 48,
                fontSize: 14,
                color: isDark ? '#FFFFFF' : '#5D4E37',
                fontFamily: 'Poppins-Regular',
                borderWidth: 1,
                borderColor: isDark ? '#575757' : '#D4C4A8',
              }}
            />
            <Typography variant="body-12" color="secondary" className="mt-1 ml-1">
              {displayName.length}/20
            </Typography>

            {/* Handle */}
            <Typography variant="subtitle-14-medium" color="primary" className="mt-4 mb-2">
              Handle
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
              Add a profile photo
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-8">
              This is optional — you can always add one later.
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
              Tell us about yourself
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-6">
              Both fields are optional.
            </Typography>

            {/* Gender */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              Gender
            </Typography>
            <GenderPicker value={gender} onChange={setGender} />

            {/* Interests */}
            <Typography variant="subtitle-14-medium" color="primary" className="mt-6 mb-2">
              What are you interested in?
            </Typography>
            <InterestPicker value={interests} onChange={setInterests} />
            <Typography variant="body-12" color="secondary" className="mt-2 ml-1">
              Used to match you with themed challenges
            </Typography>
          </View>
        );

      case 3:
        return (
          <View>
            <Typography variant="headline-20" color="primary" className="mb-2">
              Privacy settings
            </Typography>
            <Typography variant="body-14" color="secondary" className="mb-6">
              Control what friends can see. You can change these anytime.
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
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          {step > 0 ? (
            <Pressable onPress={handleBack} className="active:opacity-70">
              <Typography variant="subtitle-14-medium" className="text-primary">
                Back
              </Typography>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}

          <SetupStepIndicator currentStep={step} totalSteps={TOTAL_STEPS} />

          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <Typography variant="subtitle-14-medium" color="secondary">
              Cancel
            </Typography>
          </Pressable>
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
        <View className="px-5 pb-8 pt-4" style={{ backgroundColor: isDark ? '#1B1C30' : '#F5E6D3' }}>
          <Pressable
            onPress={isLastStep ? handleComplete : handleNext}
            disabled={!canProceed || isLoading}
            className={`rounded-2xl py-4 items-center active:opacity-80 ${
              canProceed && !isLoading ? 'bg-primary' : 'bg-primary/40'
            }`}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Typography variant="subtitle-16" color="white" className="font-poppins-semibold">
                {isLastStep ? 'Create Profile' : 'Continue'}
              </Typography>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
