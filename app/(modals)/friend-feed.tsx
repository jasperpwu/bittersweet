import React, { useEffect, useCallback } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { ReactionButton } from '../../src/components/grove/ReactionButton';
import { useAppStore } from '../../src/store';
import type { FeedItem } from '../../src/services/grove/GroveFeedService';

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FriendFeedModal() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const friendFeed = useAppStore((s) => s.grove.friendFeed);
  const friendFeedLoading = useAppStore((s) => s.grove.friendFeedLoading);
  const fetchFriendFeed = useAppStore((s) => s.grove.fetchFriendFeed);
  const addReaction = useAppStore((s) => s.grove.addReaction);
  const removeReaction = useAppStore((s) => s.grove.removeReaction);

  useEffect(() => {
    if (userId) {
      fetchFriendFeed(userId);
    }
  }, [userId]);

  const handleReactionToggle = useCallback(
    (sharedSessionId: string) => {
      const item = friendFeed.find((f) => f.sharedSession.id === sharedSessionId);
      if (item?.hasReacted) {
        removeReaction(sharedSessionId);
      } else {
        addReaction(sharedSessionId);
      }
    },
    [friendFeed, addReaction, removeReaction]
  );

  // Get the friend's profile from the first feed item
  const friendProfile = friendFeed.length > 0 ? friendFeed[0].profile : null;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#6592E9" />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          {friendProfile?.display_name ?? 'Sessions'}
        </Typography>
      </View>

      {/* Friend profile header */}
      {friendProfile && (
        <View className="px-5 mb-4">
          <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4">
            <View className="flex-row items-center">
              {friendProfile.avatar_url ? (
                <Image
                  source={{ uri: friendProfile.avatar_url }}
                  style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12 }}
                />
              ) : (
                <View className="mr-3">
                  <DefaultAvatar
                    displayName={friendProfile.display_name}
                    color={friendProfile.avatar_color}
                    size={48}
                  />
                </View>
              )}
              <View className="flex-1">
                <Typography variant="headline-18" color="primary">
                  {friendProfile.display_name}
                </Typography>
                <Typography variant="body-12" color="secondary">
                  @{friendProfile.handle}
                </Typography>
              </View>
            </View>
          </View>
        </View>
      )}

      {friendFeedLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator size="large" color="#6592E9" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {friendFeed.length === 0 ? (
            <View className="py-12 items-center">
              <Typography variant="body-14" color="secondary" className="text-center">
                No shared sessions yet.
              </Typography>
            </View>
          ) : (
            <View className="pb-8">
              {friendFeed.map((item: FeedItem) => (
                <View
                  key={item.sharedSession.id}
                  className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4 mb-3"
                >
                  {/* Tag + duration */}
                  <View className="flex-row items-center mb-2">
                    <Typography variant="body-14" color="primary" className="mr-1.5">
                      {item.sharedSession.tag_icon}
                    </Typography>
                    <Typography
                      variant="subtitle-14-medium"
                      color="primary"
                      className="flex-1"
                      numberOfLines={1}
                    >
                      {item.sharedSession.tag_name}
                    </Typography>
                    <Typography variant="subtitle-14-medium" color="primary">
                      {formatDuration(item.sharedSession.duration)}
                    </Typography>
                  </View>

                  {/* Date + time range */}
                  <View className="mb-1">
                    <Typography variant="body-12" color="secondary">
                      {formatDate(item.sharedSession.start_time)} ·{' '}
                      {formatTime(item.sharedSession.start_time)} –{' '}
                      {formatTime(item.sharedSession.end_time)}
                    </Typography>
                  </View>

                  {/* Notes */}
                  {item.sharedSession.notes ? (
                    <View className="mt-2">
                      <Typography variant="body-12" color="secondary" numberOfLines={3}>
                        {item.sharedSession.notes}
                      </Typography>
                    </View>
                  ) : null}

                  {/* Reaction button */}
                  <View className="flex-row justify-end mt-2">
                    <ReactionButton
                      hasReacted={item.hasReacted}
                      reactionCount={item.reactionCount}
                      onToggle={() => handleReactionToggle(item.sharedSession.id)}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
