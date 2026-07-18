import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, ActivityIndicator, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { colors } from '../../src/config/theme';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import i18n from '../../src/i18n';
import { FocusingBadge } from '../../src/components/grove/FocusingBadge';
import { ReactionButton } from '../../src/components/grove/ReactionButton';
import { useAppStore } from '../../src/store';
import type { FeedItem, FeedSession } from '../../src/services/grove/GroveFeedService';
import type { GroveProfile } from '../../src/services/grove/GroveService';

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString(i18n.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleTimeString(i18n.language, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

type FilterType = 'has-photo' | 'has-notes';

export default function FriendFeedModal() {
  const { t } = useTranslation();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const currentUserId = useAppStore((s) => s.auth.user?.id ?? '');
  const isCurrentUser = userId === currentUserId;

  // Friend feed state (used when viewing a friend)
  const friendFeed = useAppStore((s) => s.grove.friendFeed);
  const friendFeedLoading = useAppStore((s) => s.grove.friendFeedLoading);
  const fetchFriendFeed = useAppStore((s) => s.grove.fetchFriendFeed);
  const addReaction = useAppStore((s) => s.grove.addReaction);
  const removeReaction = useAppStore((s) => s.grove.removeReaction);

  // Local session data (used when viewing own sessions)
  const sessions = useAppStore((s) => s.focus.sessions);
  const tags = useAppStore((s) => s.focus.tags);
  const challenges = useAppStore((s) => s.grove.challenges);
  const profile = useAppStore((s) => s.grove.profile);

  const colorScheme = useColorScheme();

  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  useEffect(() => {
    if (userId && !isCurrentUser) {
      fetchFriendFeed(userId);
    }
  }, [userId, isCurrentUser]);

  // Build a tag lookup that includes challenge tags for resolving "Untagged" sessions
  const challengeTagMap = useMemo(() => {
    const map = new Map<string, { name: string; icon: string }>();
    for (const c of challenges) {
      if ((c.status === 'active' || c.status === 'pending' || c.status === 'completed') && c.tagId) {
        map.set(c.tagId, { name: c.tagName, icon: c.tagIcon });
      }
    }
    return map;
  }, [challenges]);

  // Convert local sessions to FeedItem[] format for unified rendering
  const localFeedItems: FeedItem[] = useMemo(() => {
    if (!isCurrentUser) return [];

    return sessions.allIds
      .map((id) => sessions.byId[id])
      .filter(Boolean)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .map((session) => {
        const tag = session.tagId ? tags.byId[session.tagId] : null;
        const challengeTag = !tag && session.tagId ? challengeTagMap.get(session.tagId) : null;
        const tagInfo = tag
          ? { name: tag.name, icon: tag.icon }
          : challengeTag
            ? { name: challengeTag.name, icon: challengeTag.icon }
            : null;

        const feedSession: FeedSession = {
          id: session.id,
          user_id: currentUserId,
          tag_id: session.tagId,
          duration: session.duration,
          start_time: new Date(session.startTime).toISOString(),
          end_time: new Date(session.endTime).toISOString(),
          notes: session.notes ?? null,
          photo_url: session.photoUrl ?? null,
          created_at: new Date(session.createdAt).toISOString(),
          session_tags: tagInfo,
        };

        return {
          session: feedSession,
          profile: (profile ?? {}) as GroveProfile,
          reactionCount: 0,
          hasReacted: false,
        };
      });
  }, [isCurrentUser, sessions, tags, challengeTagMap, currentUserId, profile]);

  const feedItems = isCurrentUser ? localFeedItems : friendFeed;
  const isLoading = isCurrentUser ? false : friendFeedLoading;

  const handleReactionToggle = useCallback(
    (sessionId: string) => {
      const item = friendFeed.find((f) => f.session.id === sessionId);
      if (item?.hasReacted) {
        removeReaction(sessionId);
      } else {
        addReaction(sessionId);
      }
    },
    [friendFeed, addReaction, removeReaction]
  );

  // Get unique tags from the feed for the tag filter
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, { id: string; name: string; icon: string }>();
    for (const item of feedItems) {
      const s = item.session;
      if (s.tag_id && s.session_tags) {
        tagMap.set(s.tag_id, {
          id: s.tag_id,
          name: s.session_tags.name,
          icon: s.session_tags.icon,
        });
      }
    }
    return Array.from(tagMap.values());
  }, [feedItems]);

  // Apply filters
  const filteredFeed = useMemo(() => {
    if (activeFilters.size === 0 && !selectedTagId) return feedItems;

    return feedItems.filter((item) => {
      if (activeFilters.has('has-photo') && !item.session.photo_url) return false;
      if (activeFilters.has('has-notes') && !item.session.notes) return false;
      if (selectedTagId && item.session.tag_id !== selectedTagId) return false;
      return true;
    });
  }, [feedItems, activeFilters, selectedTagId]);

  const toggleFilter = useCallback((filter: FilterType) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  }, []);

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagId((prev) => (prev === tagId ? null : tagId));
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters(new Set());
    setSelectedTagId(null);
  }, []);

  const hasActiveFilters = activeFilters.size > 0 || selectedTagId !== null;

  // Get the friend's profile from the first feed item (only for friend view)
  const friendProfile = !isCurrentUser && feedItems.length > 0 ? feedItems[0].profile : null;

  const headerTitle = isCurrentUser
    ? t('gm.feedMySessions')
    : (friendProfile?.display_name ?? t('gm.feedSessions'));

  const emptyMessage = isCurrentUser ? t('gm.feedEmptyOwn') : t('gm.feedEmptyFriend');

  const chipBg = colorScheme === 'dark' ? colors.dark.card : 'rgba(0,0,0,0.06)';
  const chipActiveBg = colors.primary;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </Pressable>
          <Typography variant="headline-18" color="primary" className="ml-2" numberOfLines={1}>
            {headerTitle}
          </Typography>
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          className="w-10 h-10 items-center justify-center -mr-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons
            name={showFilters ? 'filter' : 'filter-outline'}
            size={22}
            color={hasActiveFilters ? colors.primary : (colorScheme === 'dark' ? colors.white : colors.light.screenTextPrimary)}
          />
        </Pressable>
      </View>

      {/* Filter bar */}
      {showFilters && (
        <View className="px-5 pb-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {/* Has Photo chip */}
            <Pressable
              onPress={() => toggleFilter('has-photo')}
              style={{
                backgroundColor: activeFilters.has('has-photo') ? chipActiveBg : chipBg,
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons
                name="image-outline"
                size={14}
                color={activeFilters.has('has-photo') ? colors.white : (colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary)}
              />
              <Typography
                variant="body-12"
                style={{ color: activeFilters.has('has-photo') ? colors.white : (colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary) }}
              >
                {t('gm.feedPhoto')}
              </Typography>
            </Pressable>

            {/* Has Notes chip */}
            <Pressable
              onPress={() => toggleFilter('has-notes')}
              style={{
                backgroundColor: activeFilters.has('has-notes') ? chipActiveBg : chipBg,
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={activeFilters.has('has-notes') ? colors.white : (colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary)}
              />
              <Typography
                variant="body-12"
                style={{ color: activeFilters.has('has-notes') ? colors.white : (colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary) }}
              >
                {t('gm.feedNotes')}
              </Typography>
            </Pressable>

            {/* Tag chips */}
            {availableTags.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => toggleTagFilter(tag.id)}
                style={{
                  backgroundColor: selectedTagId === tag.id ? chipActiveBg : chipBg,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Typography variant="body-12" style={{ color: selectedTagId === tag.id ? colors.white : undefined }}>
                  {tag.icon}
                </Typography>
                <Typography
                  variant="body-12"
                  style={{ color: selectedTagId === tag.id ? colors.white : (colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary) }}
                >
                  {tag.name}
                </Typography>
              </Pressable>
            ))}

            {/* Clear all */}
            {hasActiveFilters && (
              <Pressable
                onPress={clearFilters}
                style={{
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                <Typography variant="body-12" style={{ color: colors.danger }}>
                  {t('gm.feedClear')}
                </Typography>
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}

      {/* Friend profile header (only for friend view) */}
      {friendProfile && (
        <View className="px-5 mb-4">
          <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl p-4">
            <View className="flex-row items-center">
              <View style={{ position: 'relative', marginRight: 12 }}>
                {friendProfile.avatar_url ? (
                  <Image
                    source={{ uri: friendProfile.avatar_url }}
                    style={{ width: 48, height: 48, borderRadius: 24 }}
                  />
                ) : (
                  <DefaultAvatar
                    displayName={friendProfile.display_name}
                    color={friendProfile.avatar_color}
                    size={48}
                  />
                )}
                {friendProfile.is_focusing && <FocusingBadge size={12} />}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Typography variant="headline-18" color="primary">
                    {friendProfile.display_name}
                  </Typography>
                  {friendProfile.is_focusing && (
                    <View className="ml-2 bg-success/20 rounded-full px-2 py-0.5">
                      <Typography variant="body-12" style={{ color: colors.success }}>
                        {t('gm.feedFocusingNow')}
                      </Typography>
                    </View>
                  )}
                </View>
                <Typography variant="body-12" color="secondary">
                  @{friendProfile.handle}
                </Typography>
              </View>
            </View>
          </View>
        </View>
      )}

      {isLoading ? (
        <View className="py-12 items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {filteredFeed.length === 0 ? (
            <View className="py-12 items-center">
              <Typography variant="body-14" color="secondary" className="text-center">
                {hasActiveFilters ? t('gm.feedNoMatch') : emptyMessage}
              </Typography>
            </View>
          ) : (
            <View className="pb-8">
              {filteredFeed.map((item: FeedItem) => (
                <View
                  key={item.session.id}
                  className="bg-light-border/30 dark:bg-dark-card rounded-2xl p-4 mb-3"
                >
                  {/* Tag + duration */}
                  <View className="flex-row items-center mb-2">
                    <Typography variant="body-14" color="primary" className="mr-1.5">
                      {item.session.session_tags?.icon ?? '🎯'}
                    </Typography>
                    <Typography
                      variant="subtitle-14-medium"
                      color="primary"
                      className="flex-1"
                      numberOfLines={1}
                    >
                      {item.session.session_tags?.name ?? t('gm.feedFocus')}
                    </Typography>
                    <Typography variant="subtitle-14-medium" color="primary">
                      {formatDuration(item.session.duration)}
                    </Typography>
                  </View>

                  {/* Date + time range */}
                  <View className="mb-1">
                    <Typography variant="body-12" color="secondary">
                      {formatDate(item.session.start_time)} ·{' '}
                      {formatTime(item.session.start_time)} –{' '}
                      {formatTime(item.session.end_time)}
                    </Typography>
                  </View>

                  {/* Photo */}
                  {item.session.photo_url ? (
                    <View className="mt-2">
                      <Image
                        source={{ uri: item.session.photo_url }}
                        style={{ width: '100%', height: 200, borderRadius: 10 }}
                        contentFit="cover"
                      />
                    </View>
                  ) : null}

                  {/* Notes */}
                  {item.session.notes ? (
                    <View className="mt-2">
                      <Typography variant="body-12" color="secondary" numberOfLines={3}>
                        {item.session.notes}
                      </Typography>
                    </View>
                  ) : null}

                  {/* Reaction button (only for friend view) */}
                  {!isCurrentUser && (
                    <View className="flex-row justify-end mt-2">
                      <ReactionButton
                        hasReacted={item.hasReacted}
                        reactionCount={item.reactionCount}
                        onToggle={() => handleReactionToggle(item.session.id)}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
