import React, { useState } from 'react';
import { View, SafeAreaView, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';

export default function InvitePreviewModal() {
  const pendingInvite = useAppStore((s) => s.grove.pendingInvite);
  const acceptPendingInvite = useAppStore((s) => s.grove.acceptPendingInvite);
  const clearPendingInvite = useAppStore((s) => s.grove.clearPendingInvite);
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptPendingInvite();
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to add friend. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancel = () => {
    clearPendingInvite();
    router.back();
  };

  if (!pendingInvite) {
    return (
      <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg items-center justify-center">
        <Typography variant="body-14" color="secondary">
          No pending invite
        </Typography>
      </SafeAreaView>
    );
  }

  const { profile, status } = pendingInvite;
  const isAlreadyFriends = status === 'already_friends';

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={handleCancel}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color="#8A8A8A" />
        </Pressable>
      </View>

      {/* Profile Card */}
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center">
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : (
            <DefaultAvatar
              displayName={profile.display_name}
              color={profile.avatar_color}
              size={96}
            />
          )}

          <Typography variant="headline-24" color="primary" className="mt-5">
            {profile.display_name}
          </Typography>
          <Typography variant="body-14" color="secondary" className="mt-1">
            @{profile.handle}
          </Typography>

          {isAlreadyFriends ? (
            <View className="mt-8 items-center">
              <Ionicons name="checkmark-circle" size={32} color="#65E9A3" />
              <Typography variant="body-14" color="secondary" className="mt-3 text-center">
                You're already friends with {profile.display_name}
              </Typography>
              <Pressable
                onPress={handleCancel}
                className="mt-6 px-8 py-3 rounded-full bg-light-border dark:bg-dark-border active:opacity-70"
              >
                <Typography variant="subtitle-14-medium" color="primary">
                  Dismiss
                </Typography>
              </Pressable>
            </View>
          ) : (
            <View className="mt-8 w-full gap-3">
              <Pressable
                onPress={handleAccept}
                disabled={isAccepting}
                className="w-full py-3.5 rounded-full bg-primary items-center justify-center active:opacity-80"
              >
                {isAccepting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Typography variant="subtitle-14-medium" color="white">
                    Add Friend
                  </Typography>
                )}
              </Pressable>
              <Pressable
                onPress={handleCancel}
                className="w-full py-3.5 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
              >
                <Typography variant="subtitle-14-medium" color="primary">
                  Cancel
                </Typography>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
