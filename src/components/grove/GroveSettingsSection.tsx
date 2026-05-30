import React from 'react';
import { View, Pressable, Image, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from './DefaultAvatar';
import { useAppStore } from '../../store';

export const GroveSettingsSection: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#CACACA' : '#8B7355';

  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated);
  const profile = useAppStore((s) => s.grove.profile);
  const isActive = useAppStore((s) => s.grove.isActive);
  const isLoading = useAppStore((s) => s.grove.isLoading);
  const toggleGroveActive = useAppStore((s) => s.grove.toggleGroveActive);
  const friendCount = useAppStore((s) => s.grove.friends.length);

  const handleSetupPress = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'You need to sign in with Apple before setting up your Grove profile.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/(modals)/grove-setup');
  };

  const handleToggleActive = async () => {
    try {
      await toggleGroveActive(!isActive);
    } catch {
      Alert.alert('Error', 'Failed to update Grove status. Please try again.');
    }
  };

  // Pre-opt-in: show CTA
  if (!profile) {
    return (
      <View className="px-5 mt-6">
        <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
          Grove
        </Typography>
        <Pressable
          onPress={handleSetupPress}
          className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4 py-4 active:opacity-70"
        >
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
              <Ionicons name="people-outline" size={22} color="#6592E9" />
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
          </View>
        </Pressable>
      </View>
    );
  }

  // Post-opt-in: show management section
  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        Grove
      </Typography>
      <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
        {/* Profile info */}
        <View className="py-3 border-b border-light-border dark:border-dark-border">
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
          </View>
        </View>

        {/* Friends count */}
        {isActive && (
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

        {/* Toggle active */}
        <Pressable
          onPress={handleToggleActive}
          disabled={isLoading}
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
          {isLoading ? (
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
      </View>
    </View>
  );
};
