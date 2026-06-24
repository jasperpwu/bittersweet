import React, { useState, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { AvatarPicker } from '../../src/components/grove/AvatarPicker';
import { GenderPicker } from '../../src/components/grove/GenderPicker';
import { HandleInput } from '../../src/components/grove/HandleInput';
import { InterestPicker } from '../../src/components/grove/InterestPicker';
import { useHandleValidation } from '../../src/hooks/useHandleValidation';
import { useAppStore } from '../../src/store';
import { useTranslation } from 'react-i18next';

type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

export default function GroveEditModal() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const profile = useAppStore((s) => s.grove.profile);
  const updateProfile = useAppStore((s) => s.grove.updateProfile);
  const uploadAvatar = useAppStore((s) => s.grove.uploadAvatar);
  const removeAvatar = useAppStore((s) => s.grove.removeAvatar);

  // Profile fields
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const {
    handle,
    status: handleStatus,
    setHandle,
  } = useHandleValidation();
  const [handleInitialized, setHandleInitialized] = useState(false);

  // Initialize handle from profile on first render without triggering availability check
  const currentHandle = profile?.handle ?? '';
  const effectiveHandle = handleInitialized ? handle : currentHandle;
  const effectiveHandleStatus = handleInitialized
    ? (handle === currentHandle ? 'available' as const : handleStatus)
    : ('idle' as const);

  const handleHandleChange = (value: string) => {
    if (!handleInitialized) setHandleInitialized(true);
    setHandle(value);
  };

  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);

  // Avatar state: track new selection and removal separately
  const [newAvatarUri, setNewAvatarUri] = useState<string | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const displayAvatarUri = avatarRemoved
    ? null
    : (newAvatarUri ?? profile?.avatar_url ?? null);

  const handleImageSelected = (uri: string) => {
    setNewAvatarUri(uri);
    setAvatarRemoved(false);
  };

  const handleRemoveAvatar = () => {
    setNewAvatarUri(null);
    setAvatarRemoved(true);
  };

  const [isSaving, setIsSaving] = useState(false);

  // Change detection
  const hasChanges = useMemo(() => {
    if (!profile) return false;

    const profileChanged =
      displayName.trim() !== profile.display_name ||
      effectiveHandle !== profile.handle ||
      gender !== profile.gender ||
      JSON.stringify([...interests].sort()) !==
        JSON.stringify([...(profile.interests ?? [])].sort());

    const avatarChanged = newAvatarUri !== null || avatarRemoved;

    return profileChanged || avatarChanged;
  }, [
    displayName, effectiveHandle, gender, interests,
    newAvatarUri, avatarRemoved,
    profile,
  ]);

  // Validation
  const isValid = useMemo(() => {
    const nameValid = displayName.trim().length >= 1 && displayName.trim().length <= 20;
    const handleValid = !handleInitialized || effectiveHandle === currentHandle
      ? true
      : handleStatus === 'available';
    return nameValid && handleValid;
  }, [displayName, handleInitialized, effectiveHandle, currentHandle, handleStatus]);

  const canSave = hasChanges && isValid && !isSaving;

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);

    try {
      // Update profile fields if changed
      const profileChanged =
        displayName.trim() !== profile.display_name ||
        effectiveHandle !== profile.handle ||
        gender !== profile.gender ||
        JSON.stringify([...interests].sort()) !==
          JSON.stringify([...(profile.interests ?? [])].sort());

      if (profileChanged) {
        await updateProfile({
          display_name: displayName.trim(),
          handle: effectiveHandle,
          gender,
          interests,
        });
      }

      // Handle avatar changes
      if (newAvatarUri) {
        await uploadAvatar(newAvatarUri);
      } else if (avatarRemoved && profile.avatar_url) {
        await removeAvatar();
      }

      router.back();
    } catch (error: any) {
      if (error.message === 'HANDLE_TAKEN') {
        Alert.alert(
          t('groveSetup.handleTakenTitle'),
          t('groveEdit.handleTakenBody')
        );
      } else {
        Alert.alert(t('common.error'), t('groveEdit.failedSave'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <Ionicons name="close" size={24} color={isDark ? '#CACACA' : '#8B7355'} />
          </Pressable>

          <Typography variant="subtitle-16" color="primary" className="font-poppins-semibold">
            {t('groveEdit.editProfile')}
          </Typography>

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            className="active:opacity-70"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#6592E9" />
            ) : (
              <Typography
                variant="subtitle-14-medium"
                className={canSave ? 'text-primary' : 'text-primary/40'}
              >
                {t('common.save')}
              </Typography>
            )}
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 24, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View className="mb-8">
            <AvatarPicker
              avatarUri={displayAvatarUri}
              displayName={displayName || profile.display_name}
              avatarColor={profile.avatar_color}
              onImageSelected={handleImageSelected}
            />
            {(displayAvatarUri || profile.avatar_url) && !avatarRemoved && (
              <Pressable
                onPress={handleRemoveAvatar}
                className="self-center mt-3 active:opacity-70"
              >
                <Typography variant="body-12" className="text-[#EF786C]">
                  {t('journal.removePhoto')}
                </Typography>
              </Pressable>
            )}
          </View>

          {/* Display Name */}
          <View className="mb-6">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('groveSetup.displayName')}
            </Typography>
            <TextInput
              value={displayName}
              onChangeText={(text) => setDisplayName(text.slice(0, 20))}
              placeholder={t('groveSetup.yourName')}
              placeholderTextColor={isDark ? '#575757' : '#B8A88A'}
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
              {displayName.trim().length}/20
            </Typography>
          </View>

          {/* Handle */}
          <View className="mb-6">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('groveSetup.handle')}
            </Typography>
            <HandleInput
              value={effectiveHandle}
              onChangeText={handleHandleChange}
              status={effectiveHandleStatus}
            />
          </View>

          {/* Gender */}
          <View className="mb-6">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('groveSetup.gender')}
            </Typography>
            <GenderPicker value={gender} onChange={setGender} />
          </View>

          {/* Interests */}
          <View className="mb-8">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('groveEdit.interests')}
            </Typography>
            <InterestPicker value={interests} onChange={setInterests} />
            <Typography variant="body-12" color="secondary" className="mt-2 ml-1">
              {t('groveSetup.interestsHint')}
            </Typography>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
