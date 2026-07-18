import React, { useState } from 'react';
import { View, Pressable, Alert, ActivityIndicator, Linking, useColorScheme, TextInput } from 'react-native';
import { Image } from 'expo-image';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { DefaultAvatar } from '../grove/DefaultAvatar';
import { useAppStore } from '../../store';
import { colors } from '../../config/theme';
import { PENDING_REFERRAL_KEY } from '../../hooks/useDeepLinkHandler';
import { GoogleSignInButton } from './SignInSheet';
import { useTranslation } from 'react-i18next';

export const AccountActions: React.FC = () => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAppStore((state) => state.auth);
  const signOut = useAppStore((state) => state.auth.signOut);
  const deleteAccount = useAppStore((state) => state.auth.deleteAccount);

  if (!isAuthenticated) return null;

  const handleSignOut = () => {
    Alert.alert(t('account.signOut'), t('account.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.signOut'),
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('account.deleteAccount'),
      t('account.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('account.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error: any) {
              Alert.alert(
                t('account.deletionFailed'),
                error?.message || t('account.deletionFailedBody')
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        {t('account.other')}
      </Typography>
      <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl px-4">
        <Pressable
          onPress={handleSignOut}
          disabled={isLoading}
          className="py-3 border-b border-light-border dark:border-dark-border active:opacity-70"
        >
          <View className="flex-row items-center">
            <View className="w-8 items-center mr-3">
              <Ionicons name="log-out-outline" size={20} color={colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary} />
            </View>
            <Typography variant="subtitle-14-medium" color="primary">
              {t('account.signOut')}
            </Typography>
            {isLoading && (
              <ActivityIndicator size="small" color={colors.primary} className="ml-auto" />
            )}
          </View>
        </Pressable>

        <Pressable
          onPress={handleDeleteAccount}
          disabled={isLoading}
          className="py-3 active:opacity-70"
        >
          <View className="flex-row items-center">
            <View className="w-8 items-center mr-3">
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </View>
            <Typography variant="subtitle-14-medium" className="text-error">
              {t('account.deleteAccount')}
            </Typography>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export const AccountSection: React.FC = () => {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary;

  const { user, isAuthenticated, isLoading, error } = useAppStore(
    (state) => state.auth
  );
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const signInWithGoogle = useAppStore((state) => state.auth.signInWithGoogle);
  const signInWithEmail = useAppStore((state) => state.auth.signInWithEmail);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [referralSaved, setReferralSaved] = useState(false);
  const userSinceLabel = user?.createdAt
    ? t('account.userSince', { date: new Date(user.createdAt).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }) })
    : null;

  const profile = useAppStore((s) => s.grove.profile);
  const isActive = useAppStore((s) => s.grove.isActive);
  const isGroveLoading = useAppStore((s) => s.grove.isLoading);
  const toggleGroveActive = useAppStore((s) => s.grove.toggleGroveActive);
  const friendCount = useAppStore((s) => s.grove.friends.length);

  const handleSetupPress = () => {
    router.push('/(modals)/grove-setup');
  };

  const handleToggleActive = async () => {
    try {
      await toggleGroveActive(!isActive);
    } catch {
      Alert.alert(t('common.error'), t('groveSettings.failedStatus'));
    }
  };

  // Authenticated state
  if (isAuthenticated && user) {
    return (
      <View className="px-5 mt-6">
        <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
          {t('account.account')}
        </Typography>
        <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl px-4">
          {/* Profile identity */}
          {profile ? (
            // Grove profile: avatar + name + handle
            <Pressable
              onPress={() => router.push('/(modals)/grove-edit')}
              className="py-3 border-b border-light-border dark:border-dark-border active:opacity-70"
            >
              <View className="flex-row items-center">
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                  />
                ) : (
                  <View className="mr-3">
                    <DefaultAvatar
                      displayName={profile.display_name}
                      color={profile.avatar_color}
                      size={40}
                    />
                  </View>
                )}
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {profile.display_name}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    @{profile.handle}
                  </Typography>
                  {userSinceLabel && (
                    <Typography variant="body-12" color="secondary" className="mt-0.5">
                      {userSinceLabel}
                    </Typography>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? colors.dark.border : colors.light.screenBorder} />
              </View>
            </Pressable>
          ) : (
            // No Grove profile: show user name + setup CTA
            <>
              <View className="py-3 border-b border-light-border dark:border-dark-border">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
                    <Ionicons name="person" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Typography variant="subtitle-14-medium" color="primary">
                      {user.fullName || user.email || t('account.appleUser')}
                    </Typography>
                    {userSinceLabel && (
                      <Typography variant="body-12" color="secondary" className="mt-0.5">
                        {userSinceLabel}
                      </Typography>
                    )}
                  </View>
                </View>
              </View>

              <Pressable
                onPress={handleSetupPress}
                className="flex-row items-center py-3 active:opacity-70"
              >
                <View className="w-8 items-center mr-3">
                  <Ionicons name="people-outline" size={20} color={iconColor} />
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {t('account.setupGroveProfile')}
                  </Typography>
                  <Typography variant="body-12" color="secondary" className="mt-0.5">
                    {t('account.shareJourney')}
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? colors.dark.border : colors.light.screenBorder} />
              </Pressable>
            </>
          )}

          {/* Friends count (only when Grove is active) */}
          {profile && isActive && (
            <Pressable
              onPress={() => router.push('/(modals)/add-friends')}
              className="flex-row items-center justify-between py-3 border-b border-light-border dark:border-dark-border active:opacity-70"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-8 items-center mr-3">
                  <Ionicons name="people-outline" size={20} color={iconColor} />
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {t('groveSettings.friendCount', { count: friendCount })}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    {t('account.inviteViaLink')}
                  </Typography>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? colors.dark.border : colors.light.screenBorder} />
            </Pressable>
          )}

          {/* Inner Circle (only when Grove is active) */}
          {profile && isActive && (
            <Pressable
              onPress={() => router.push('/(modals)/inner-circle')}
              className="flex-row items-center justify-between py-3 border-b border-light-border dark:border-dark-border active:opacity-70"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-8 items-center mr-3">
                  <Ionicons name="heart-outline" size={20} color={iconColor} />
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {t('groveSettings.innerCircle')}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    {t('groveSettings.innerCircleSub')}
                  </Typography>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? colors.dark.border : colors.light.screenBorder} />
            </Pressable>
          )}

          {/* Toggle Grove active (only when profile exists) */}
          {profile && (
            <Pressable
              onPress={handleToggleActive}
              disabled={isGroveLoading}
              className="flex-row items-center justify-between py-3 active:opacity-70"
            >
              <View className="flex-row items-center flex-1">
                <View className="w-8 items-center mr-3">
                  <Ionicons
                    name={isActive ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={iconColor}
                  />
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {isActive ? t('groveSettings.profileActive') : t('groveSettings.profilePaused')}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    {isActive
                      ? t('groveSettings.activeDesc')
                      : t('groveSettings.pausedDesc')}
                  </Typography>
                </View>
              </View>
              {isGroveLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    isActive ? 'bg-success' : 'bg-light-border dark:bg-dark-border'
                  }`}
                >
                  <Ionicons
                    name={isActive ? 'checkmark' : 'pause'}
                    size={16}
                    color={colors.white}
                  />
                </View>
              )}
            </Pressable>
          )}
        </View>

        {error && (
          <Typography variant="body-12" className="text-error mt-2 px-1">
            {error}
          </Typography>
        )}
      </View>
    );
  }

  // Signed out state
  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        {t('account.account')}
      </Typography>
      <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl px-4 py-4">
        <Typography variant="body-14" color="secondary" className="mb-4">
          {t('account.signInPrompt')}
        </Typography>

        {isLoading ? (
          <View className="items-center py-3">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={{ width: '100%', height: 48 }}
              onPress={signInWithApple}
            />
            <GoogleSignInButton onPress={signInWithGoogle} />
          </View>
        )}

        {__DEV__ && (
          <View className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
            <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
              Dev Login
            </Typography>
            <TextInput
              placeholder="Email"
              placeholderTextColor={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
              value={devEmail}
              onChangeText={setDevEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-light-bg dark:bg-dark-bg rounded-xl px-3 py-2.5 mb-2 text-light-text-primary dark:text-dark-text-primary"
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
              value={devPassword}
              onChangeText={setDevPassword}
              secureTextEntry
              className="bg-light-bg dark:bg-dark-bg rounded-xl px-3 py-2.5 mb-3 text-light-text-primary dark:text-dark-text-primary"
            />
            <Pressable
              onPress={() => signInWithEmail(devEmail, devPassword)}
              disabled={isLoading || !devEmail || !devPassword}
              className="bg-primary rounded-xl py-2.5 items-center active:opacity-70"
              style={{ opacity: !devEmail || !devPassword ? 0.5 : 1 }}
            >
              <Typography variant="subtitle-14-medium" className="text-white">
                Dev Sign In
              </Typography>
            </Pressable>
          </View>
        )}

        {/* Referral code input */}
        <View className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
          <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
            {t('account.referralCodeQ')}
          </Typography>
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <TextInput
              placeholder={t('account.enterCode')}
              placeholderTextColor={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
              value={referralCode}
              onChangeText={(text) => {
                setReferralCode(text);
                setReferralSaved(false);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              className="flex-1 bg-light-bg dark:bg-dark-bg rounded-xl px-3 py-2.5 text-light-text-primary dark:text-dark-text-primary"
            />
            <Button
              variant="primary"
              size="small"
              disabled={!referralCode.trim() || referralSaved}
              className="rounded-xl px-4 py-2.5"
              onPress={async () => {
                if (!referralCode.trim()) return;
                await AsyncStorage.setItem(PENDING_REFERRAL_KEY, referralCode.trim());
                setReferralSaved(true);
              }}
            >
              <Typography variant="subtitle-14-medium" className="text-white">
                {referralSaved ? t('account.saved') : t('account.apply')}
              </Typography>
            </Button>
          </View>
          <Typography variant="body-12" color="secondary" className="mt-1.5">
            {referralSaved
              ? t('account.codeSaved')
              : t('account.enterCodeHint')}
          </Typography>
        </View>

        {error && (
          <Typography variant="body-12" className="text-error mt-2">
            {error}
          </Typography>
        )}

        <View className="flex-row justify-center items-center mt-3">
          <Pressable onPress={() => Linking.openURL('https://example.com/terms')}>
            <Typography variant="body-12" color="secondary" className="underline">
              {t('account.terms')}
            </Typography>
          </Pressable>
          <Typography variant="body-12" color="secondary" className="mx-2">
            ·
          </Typography>
          <Pressable onPress={() => Linking.openURL('https://example.com/privacy')}>
            <Typography variant="body-12" color="secondary" className="underline">
              {t('account.privacyPolicy')}
            </Typography>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
