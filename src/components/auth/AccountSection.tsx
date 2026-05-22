import React from 'react';
import { View, Pressable, Alert, ActivityIndicator } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useAppStore } from '../../store';

export const AccountSection: React.FC = () => {
  const { user, isAuthenticated, isLoading, error } = useAppStore(
    (state) => state.auth
  );
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const signOut = useAppStore((state) => state.auth.signOut);
  const deleteAccount = useAppStore((state) => state.auth.deleteAccount);

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

  if (isAuthenticated && user) {
    return (
      <View className="px-5 mt-6">
        <Typography variant="subtitle-14-medium" className="text-primary mb-3">
          Account
        </Typography>
        <View className="bg-[#242540] rounded-2xl px-4">
          {/* User info */}
          <View className="py-3 border-b border-dark-border">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
                <Ionicons name="person" size={20} color="#8B7FFF" />
              </View>
              <View className="flex-1">
                {user.fullName && (
                  <Typography variant="subtitle-14-medium" color="white">
                    {user.fullName}
                  </Typography>
                )}
                <Typography
                  variant="body-12"
                  color="secondary"
                  className={user.fullName ? 'mt-0.5' : ''}
                >
                  {user.email || 'Apple ID'}
                </Typography>
              </View>
            </View>
          </View>

          {/* Sign out */}
          <Pressable
            onPress={handleSignOut}
            disabled={isLoading}
            className="py-3 border-b border-dark-border active:opacity-70"
          >
            <View className="flex-row items-center">
              <View className="w-8 items-center mr-3">
                <Ionicons name="log-out-outline" size={20} color="#CACACA" />
              </View>
              <Typography variant="subtitle-14-medium" color="white">
                Sign Out
              </Typography>
              {isLoading && (
                <ActivityIndicator size="small" color="#8B7FFF" className="ml-auto" />
              )}
            </View>
          </Pressable>

          {/* Delete account */}
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
      <Typography variant="subtitle-14-medium" className="text-primary mb-3">
        Account
      </Typography>
      <View className="bg-[#242540] rounded-2xl px-4 py-4">
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

        {error && (
          <Typography variant="body-12" className="text-[#FF6B6B] mt-2">
            {error}
          </Typography>
        )}
      </View>
    </View>
  );
};
