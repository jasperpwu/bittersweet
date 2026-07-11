import React, { useEffect } from 'react';
import { View, SafeAreaView, Pressable, FlatList, Image, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import { colors } from '../../src/config/theme';
import type { FriendRequest } from '../../src/services/grove/GroveFriendService';

export default function FriendRequestsModal() {
  const { t } = useTranslation();
  const incomingRequests = useAppStore((s) => s.grove.incomingRequests);
  const fetchFriendRequests = useAppStore((s) => s.grove.fetchFriendRequests);
  const acceptFriendRequest = useAppStore((s) => s.grove.acceptFriendRequest);
  const rejectFriendRequest = useAppStore((s) => s.grove.rejectFriendRequest);

  useEffect(() => {
    fetchFriendRequests();
  }, []);

  const handleAccept = async (friendshipId: string) => {
    try {
      await acceptFriendRequest(friendshipId);
    } catch {
      Alert.alert(t('common.error'), t('gm.errAcceptRequest'));
    }
  };

  const handleReject = async (friendshipId: string) => {
    try {
      await rejectFriendRequest(friendshipId);
    } catch {
      Alert.alert(t('common.error'), t('gm.errRejectRequest'));
    }
  };

  const renderRequest = ({ item }: { item: FriendRequest }) => (
    <View className="flex-row items-center py-3 px-5">
      {item.profile.avatar_url ? (
        <Image
          source={{ uri: item.profile.avatar_url }}
          style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }}
        />
      ) : (
        <View className="mr-3">
          <DefaultAvatar
            displayName={item.profile.display_name}
            color={item.profile.avatar_color}
            size={44}
          />
        </View>
      )}
      <View className="flex-1">
        <Typography variant="subtitle-14-medium" color="primary">
          {item.profile.display_name}
        </Typography>
        <Typography variant="body-12" color="secondary">
          @{item.profile.handle}
        </Typography>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => handleReject(item.friendshipId)}
          className="w-9 h-9 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
        >
          <Ionicons name="close" size={18} color={colors.light.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => handleAccept(item.friendshipId)}
          className="w-9 h-9 rounded-full bg-primary items-center justify-center active:opacity-80"
        >
          <Ionicons name="checkmark" size={18} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          {t('gm.frTitle')}
        </Typography>
      </View>

      {incomingRequests.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Ionicons name="people-outline" size={48} color={colors.light.textSecondary} />
          <Typography variant="body-14" color="secondary" className="mt-4 text-center px-8">
            {t('gm.frEmpty')}
          </Typography>
        </View>
      ) : (
        <FlatList
          data={incomingRequests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.friendshipId}
          ItemSeparatorComponent={() => (
            <View className="h-px bg-light-border dark:bg-dark-border mx-5" />
          )}
        />
      )}
    </SafeAreaView>
  );
}
