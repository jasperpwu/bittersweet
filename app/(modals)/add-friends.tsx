import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  FlatList,
  Alert,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { colors } from '../../src/config/theme';

import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import { useReferralLink } from '../../src/hooks/useReferralLink';
import { GroveFriendService } from '../../src/services/grove/GroveFriendService';
import { showToast } from '../../src/components/ui/Toast';
import { getFontFamily } from '../../src/utils/typography';
import type { FriendItem, FriendRequest } from '../../src/services/grove/GroveFriendService';
import type { GroveProfile } from '../../src/services/grove/GroveService';
import { directionalIcon } from '../../src/utils/directionalIcon';

export default function AddFriendsModal() {
  const { t } = useTranslation();
  const friends = useAppStore((s) => s.grove.friends);
  const fetchFriends = useAppStore((s) => s.grove.fetchFriends);
  const removeFriend = useAppStore((s) => s.grove.removeFriend);
  const incomingRequests = useAppStore((s) => s.grove.incomingRequests);
  const fetchFriendRequests = useAppStore((s) => s.grove.fetchFriendRequests);
  const acceptFriendRequest = useAppStore((s) => s.grove.acceptFriendRequest);
  const rejectFriendRequest = useAppStore((s) => s.grove.rejectFriendRequest);
  const sendFriendRequest = useAppStore((s) => s.grove.sendFriendRequest);
  const { shareLink } = useReferralLink();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<GroveProfile | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
  }, []);

  // Debounced search by exact handle
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchQuery.trim()) {
      setSearchResult(null);
      setSearchLoading(false);
      setHasSearched(false);
      return;
    }

    setSearchLoading(true);
    setHasSearched(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await GroveFriendService.searchProfiles(searchQuery.trim());
        setSearchResult(result);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResult(null);
      } finally {
        setSearchLoading(false);
        setHasSearched(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Build lookup sets for existing relationships
  const friendUserIds = useMemo(
    () => new Set(friends.map((f) => f.profile.user_id)),
    [friends]
  );
  const incomingRequestUserIds = useMemo(
    () => new Set(incomingRequests.map((r) => r.profile.user_id)),
    [incomingRequests]
  );

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResult(null);
    setHasSearched(false);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
      setSentRequests((prev) => new Set(prev).add(userId));
      showToast(t('gm.afSentToast'), 'success');
    } catch {
      Alert.alert(t('common.error'), t('gm.errSendRequest'));
    }
  };

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

  const handleRemove = (friend: FriendItem) => {
    Alert.alert(
      t('gm.afRemoveTitle'),
      t('gm.afRemoveMsg', { name: friend.profile.display_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFriend(friend.friendshipId);
            } catch {
              Alert.alert(t('common.error'), t('gm.errRemoveFriend'));
            }
          },
        },
      ]
    );
  };

  const getRelationshipStatus = (userId: string): 'friends' | 'pending' | 'incoming' | 'add' => {
    if (friendUserIds.has(userId)) return 'friends';
    if (sentRequests.has(userId)) return 'pending';
    if (incomingRequestUserIds.has(userId)) return 'incoming';
    return 'add';
  };

  // --- Render helpers ---

  const renderAvatar = (profile: GroveProfile, size = 44) => {
    if (profile.avatar_url) {
      return (
        <Image
          source={{ uri: profile.avatar_url }}
          style={{ width: size, height: size, borderRadius: size / 2, marginRight: 12 }}
        />
      );
    }
    return (
      <View className="mr-3">
        <DefaultAvatar
          displayName={profile.display_name}
          color={profile.avatar_color}
          size={size}
        />
      </View>
    );
  };

  const renderStatusButton = (userId: string) => {
    const status = getRelationshipStatus(userId);

    if (status === 'add') {
      return (
        <Pressable
          onPress={() => handleSendRequest(userId)}
          className="px-4 h-8 rounded-full bg-primary items-center justify-center active:opacity-80"
        >
          <Typography variant="body-12" style={{ color: colors.white }}>
            {t('gm.afAdd')}
          </Typography>
        </Pressable>
      );
    }

    if (status === 'incoming') {
      const request = incomingRequests.find((r) => r.profile.user_id === userId);
      if (request) {
        return (
          <Pressable
            onPress={() => handleAccept(request.friendshipId)}
            className="px-4 h-8 rounded-full bg-primary items-center justify-center active:opacity-80"
          >
            <Typography variant="body-12" style={{ color: colors.white }}>
              {t('gm.afAccept')}
            </Typography>
          </Pressable>
        );
      }
    }

    const label = status === 'pending' ? t('gm.afSent') : t('gm.afFriends');
    return (
      <View className="px-4 h-8 rounded-full bg-light-border dark:bg-dark-border items-center justify-center">
        <Typography variant="body-12" color="secondary">
          {label}
        </Typography>
      </View>
    );
  };

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View className="flex-row items-center py-3 px-5">
      {renderAvatar(item.profile)}
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
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: FriendItem }) => (
    <Pressable
      onPress={() =>
        router.push(`/(modals)/friend-feed?userId=${item.profile.user_id}`)
      }
      className="flex-row items-center py-3 px-5 active:opacity-70"
    >
      {renderAvatar(item.profile)}
      <View className="flex-1">
        <Typography variant="subtitle-14-medium" color="primary">
          {item.profile.display_name}
        </Typography>
        <Typography variant="body-12" color="secondary">
          @{item.profile.handle}
        </Typography>
      </View>
      <Pressable
        onPress={() => handleRemove(item)}
        className="w-8 h-8 rounded-full bg-light-border dark:bg-dark-border items-center justify-center active:opacity-70"
        hitSlop={8}
      >
        <Ionicons name="close" size={16} color={colors.light.textSecondary} />
      </Pressable>
    </Pressable>
  );

  const Separator = () => (
    <View className="h-px bg-light-border dark:bg-dark-border mx-5" />
  );

  // --- Inline search result ---
  const renderSearchResultInline = () => {
    if (!searchQuery.trim()) return null;

    if (searchLoading) {
      return (
        <View className="py-3 px-5 items-center">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (hasSearched && !searchResult) {
      return (
        <View className="py-3 px-5">
          <Typography variant="body-12" color="secondary">
            {t('gm.afNoUser', { handle: searchQuery.trim() })}
          </Typography>
        </View>
      );
    }

    if (searchResult) {
      return (
        <Pressable
          onPress={() =>
            router.push(`/(modals)/friend-feed?userId=${searchResult.user_id}`)
          }
          className="flex-row items-center py-3 px-5 active:opacity-70"
        >
          {renderAvatar(searchResult)}
          <View className="flex-1">
            <Typography variant="subtitle-14-medium" color="primary">
              {searchResult.display_name}
            </Typography>
            <Typography variant="body-12" color="secondary">
              @{searchResult.handle}
            </Typography>
          </View>
          {renderStatusButton(searchResult.user_id)}
        </Pressable>
      );
    }

    return null;
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name={directionalIcon('arrow-back')} size={24} color={colors.primary} />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2 flex-1">
          {t('gm.afTitle')}
        </Typography>
        <Pressable
          onPress={() => shareLink()}
          className="w-10 h-10 items-center justify-center -mr-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="paper-plane-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search Bar */}
      <View className="px-5 pb-1">
        <View className="flex-row items-center border border-light-border dark:border-dark-border rounded-xl px-3 h-10">
          <Ionicons
            name="search"
            size={18}
            color={colors.light.textSecondary}
            style={{ marginRight: 8 }}
          />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('gm.afSearch')}
            placeholderTextColor={colors.light.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 text-light-text-primary dark:text-dark-text-primary"
            style={{
              fontFamily: getFontFamily('regular'),
              fontSize: 14,
              paddingVertical: 0,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.light.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Inline search result */}
      {renderSearchResultInline()}
      {(searchQuery.trim() && (searchResult || hasSearched)) && <Separator />}

      {/* Friend Requests Section — always visible above the list */}
      {incomingRequests.length > 0 && (
        <View>
          <View className="mt-4 mb-2 px-5 flex-row items-center">
            <Typography variant="subtitle-14-medium" color="primary">
              {t('gm.frTitle')}
            </Typography>
            <View className="ml-2 w-5 h-5 rounded-full bg-primary items-center justify-center">
              <Typography variant="body-12" style={{ color: colors.white, fontSize: 11 }}>
                {incomingRequests.length}
              </Typography>
            </View>
          </View>
          {incomingRequests.map((request, index) => (
            <View key={request.friendshipId}>
              {renderFriendRequest({ item: request })}
              {index < incomingRequests.length - 1 && <Separator />}
            </View>
          ))}
          <View className="h-px bg-light-border dark:bg-dark-border mt-2" />
        </View>
      )}

      {/* Main content: friends list */}
      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.friendshipId}
        ListHeaderComponent={
          <View>
            {/* My Friends Section Header */}
            <View className="mt-4 mb-2 px-5 flex-row items-center justify-between">
              <Typography variant="subtitle-14-medium" color="primary">
                {t('gm.afMyFriends')}
              </Typography>
              <Typography variant="body-12" color="secondary">
                {friends.length}
              </Typography>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center pt-12">
            <Ionicons name="people-outline" size={48} color={colors.light.textSecondary} />
            <Typography variant="body-14" color="secondary" className="mt-4 text-center px-8">
              {t('gm.afNoFriends')}
            </Typography>
          </View>
        }
        ItemSeparatorComponent={Separator}
        keyboardShouldPersistTaps="handled"
      />

    </SafeAreaView>
  );
}
