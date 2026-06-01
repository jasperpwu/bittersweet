import React, { useState } from 'react';
import { View, Pressable, Alert, ActivityIndicator, Linking, Image, useColorScheme, TextInput } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from '../grove/DefaultAvatar';
import { useAppStore } from '../../store';

export const AccountActions: React.FC = () => {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAppStore((state) => state.auth);
  const signOut = useAppStore((state) => state.auth.signOut);
  const deleteAccount = useAppStore((state) => state.auth.deleteAccount);

  if (!isAuthenticated) return null;

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all synced data. Local data on this device will not be affected. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: deleteAccount,
        },
      ]
    );
  };

  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        Other
      </Typography>
      <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
        <Pressable
          onPress={handleSignOut}
          disabled={isLoading}
          className="py-3 border-b border-light-border dark:border-dark-border active:opacity-70"
        >
          <View className="flex-row items-center">
            <View className="w-8 items-center mr-3">
              <Ionicons name="log-out-outline" size={20} color={colorScheme === 'dark' ? '#CACACA' : '#8B7355'} />
            </View>
            <Typography variant="subtitle-14-medium" color="primary">
              Sign Out
            </Typography>
            {isLoading && (
              <ActivityIndicator size="small" color="#8B7FFF" className="ml-auto" />
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
              <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
            </View>
            <Typography variant="subtitle-14-medium" className="text-[#FF6B6B]">
              Delete Account
            </Typography>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

export const AccountSection: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#CACACA' : '#8B7355';

  const { user, isAuthenticated, isLoading, error } = useAppStore(
    (state) => state.auth
  );
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const signInWithEmail = useAppStore((state) => state.auth.signInWithEmail);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
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
      Alert.alert('Error', 'Failed to update Grove status. Please try again.');
    }
  };

  // Authenticated state
  if (isAuthenticated && user) {
    return (
      <View className="px-5 mt-6">
        <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
          Account
        </Typography>
        <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
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
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
              </View>
            </Pressable>
          ) : (
            // No Grove profile: show user name + setup CTA
            <>
              <View className="py-3 border-b border-light-border dark:border-dark-border">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
                    <Ionicons name="person" size={20} color="#8B7FFF" />
                  </View>
                  <View className="flex-1">
                    <Typography variant="subtitle-14-medium" color="primary">
                      {user.fullName || 'Apple User'}
                    </Typography>
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
                    Set Up Grove Profile
                  </Typography>
                  <Typography variant="body-12" color="secondary" className="mt-0.5">
                    Share your focus journey with friends
                  </Typography>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
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
                    {friendCount} {friendCount === 1 ? 'Friend' : 'Friends'}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    Invite friends via link
                  </Typography>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
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
                    Inner Circle
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    Your safety net friends
                  </Typography>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
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
                    {isActive ? 'Profile Active' : 'Profile Paused'}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    {isActive
                      ? 'Your profile is visible and Grove tab is shown'
                      : 'Your profile is hidden and sharing is paused'}
                  </Typography>
                </View>
              </View>
              {isGroveLoading ? (
                <ActivityIndicator size="small" color="#6592E9" />
              ) : (
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    isActive ? 'bg-[#51BC6F]' : 'bg-light-border dark:bg-dark-border'
                  }`}
                >
                  <Ionicons
                    name={isActive ? 'checkmark' : 'pause'}
                    size={16}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </Pressable>
          )}
        </View>

        {error && (
          <Typography variant="body-12" className="text-[#FF6B6B] mt-2 px-1">
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
        Account
      </Typography>
      <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4 py-4">
        <Typography variant="body-14" color="secondary" className="mb-4">
          Sign in to sync your data across devices and back up your progress.
        </Typography>

        {isLoading ? (
          <View className="items-center py-3">
            <ActivityIndicator size="small" color="#8B7FFF" />
          </View>
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={{ width: '100%', height: 48 }}
            onPress={signInWithApple}
          />
        )}

        {__DEV__ && (
          <View className="mt-4 pt-4 border-t border-light-border dark:border-dark-border">
            <Typography variant="subtitle-14-medium" color="secondary" className="mb-2">
              Dev Login
            </Typography>
            <TextInput
              placeholder="Email"
              placeholderTextColor={isDark ? '#575757' : '#A0A0A0'}
              value={devEmail}
              onChangeText={setDevEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-light-bg dark:bg-dark-bg rounded-xl px-3 py-2.5 mb-2 text-light-text-primary dark:text-dark-text-primary"
            />
            <TextInput
              placeholder="Password"
              placeholderTextColor={isDark ? '#575757' : '#A0A0A0'}
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

        {error && (
          <Typography variant="body-12" className="text-[#FF6B6B] mt-2">
            {error}
          </Typography>
        )}

        <View className="flex-row justify-center items-center mt-3">
          <Pressable onPress={() => Linking.openURL('https://example.com/terms')}>
            <Typography variant="body-12" color="secondary" className="underline">
              Terms of Service
            </Typography>
          </Pressable>
          <Typography variant="body-12" color="secondary" className="mx-2">
            ·
          </Typography>
          <Pressable onPress={() => Linking.openURL('https://example.com/privacy')}>
            <Typography variant="body-12" color="secondary" className="underline">
              Privacy Policy
            </Typography>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
