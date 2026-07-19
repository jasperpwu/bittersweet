import React from 'react';
import { View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../config/theme';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from './DefaultAvatar';
import { FocusingBadge } from './FocusingBadge';
import { ReactionButton } from './ReactionButton';
import type { FeedItem } from '../../services/grove/GroveFeedService';
import i18n from '../../i18n';

interface FriendActivityCardProps {
  item: FeedItem;
  onReactionToggle: (sessionId: string) => void;
  isNew?: boolean;
  // Provided for discovery (stranger) cards to offer a quick friend invite.
  onInvite?: (userId: string) => void;
  invited?: boolean;
  // Tapping the card opens the user's full session history feed.
  onPress?: (userId: string) => void;
}

// All cards share this height so a photo doesn't make one card taller than the
// rest (which would push the page indicator / next section down in the carousel).
export const ACTIVITY_CARD_HEIGHT = 300;

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return i18n.t('groveUI.justNow');
  if (diffMins < 60) return i18n.t('groveUI.minutesAgo', { count: diffMins });
  if (diffHours < 24) return i18n.t('groveUI.hoursAgo', { count: diffHours });
  return i18n.t('groveUI.yesterday');
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export const FriendActivityCard: React.FC<FriendActivityCardProps> = ({
  item,
  onReactionToggle,
  isNew = false,
  onInvite,
  invited = false,
  onPress,
}) => {
  const { profile, session, reactionCount, hasReacted } = item;

  const tagIcon = session.session_tags?.icon ?? '🎯';
  const tagName = session.session_tags?.name ?? 'Focus';
  const isStranger = item.isFriend === false;

  return (
    <Pressable
      onPress={onPress ? () => onPress(profile.user_id) : undefined}
      disabled={!onPress}
      className="bg-light-border/30 dark:bg-dark-card rounded-2xl p-4 w-[280px] active:opacity-80"
      style={{ height: ACTIVITY_CARD_HEIGHT }}
    >
      {/* Header: avatar + name + time */}
      <View className="flex-row items-center mb-3">
        <View style={{ position: 'relative', marginRight: 10 }}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
          ) : (
            <DefaultAvatar
              displayName={profile.display_name}
              color={profile.avatar_color}
              size={36}
            />
          )}
          {profile.is_focusing && <FocusingBadge size={10} />}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Typography variant="subtitle-14-medium" color="primary" numberOfLines={1}>
              {profile.display_name}
            </Typography>
            {isNew && (
              <View className="w-2 h-2 rounded-full bg-primary ml-1.5" />
            )}
          </View>
          <Typography variant="body-12" color="secondary">
            {timeAgo(session.start_time)}
          </Typography>
        </View>

        {/* Invite affordance for discovery (stranger) cards */}
        {isStranger && onInvite && (
          invited ? (
            <View className="flex-row items-center bg-light-border dark:bg-dark-border rounded-full px-3 h-7">
              <Ionicons name="checkmark" size={14} color={colors.light.textSecondary} />
              <Typography variant="body-12" color="secondary" className="ml-1">
                {i18n.t('gm.afSent')}
              </Typography>
            </View>
          ) : (
            <Pressable
              onPress={() => onInvite(profile.user_id)}
              className="flex-row items-center bg-primary rounded-full px-3 h-7 active:opacity-80"
              hitSlop={6}
            >
              <Ionicons name="person-add" size={13} color={colors.white} />
              <Typography variant="body-12" className="ml-1" style={{ color: colors.white }}>
                {i18n.t('gm.afAdd')}
              </Typography>
            </Pressable>
          )
        )}
      </View>

      {/* Content zone — flex-1 so every card is the same height whether or not
          it has a photo. */}
      <View className="flex-1">
        {session.photo_url ? (
          <>
            {/* Session info: tag icon + name + duration */}
            <View className="flex-row items-center mb-2">
              <Typography variant="body-14" color="primary" className="mr-1.5">
                {tagIcon}
              </Typography>
              <Typography variant="subtitle-14-medium" color="primary" className="flex-1" numberOfLines={1}>
                {tagName}
              </Typography>
              <Typography variant="subtitle-14-medium" color="primary">
                {formatDuration(session.duration)}
              </Typography>
            </View>
            <Image
              source={{ uri: session.photo_url }}
              style={{ width: '100%', flex: 1, borderRadius: 10 }}
              contentFit="cover"
            />
            {session.notes && (
              <Typography variant="body-12" color="secondary" className="mt-2" numberOfLines={1}>
                {session.notes}
              </Typography>
            )}
          </>
        ) : (
          /* No photo — center the tag emoji + name (and duration) in the middle */
          <View className="flex-1 items-center justify-center">
            <Typography variant="body-14" color="primary" style={{ fontSize: 44, lineHeight: 52 }}>
              {tagIcon}
            </Typography>
            <Typography variant="subtitle-14-medium" color="primary" className="mt-2" numberOfLines={1}>
              {tagName}
            </Typography>
            <Typography variant="body-12" color="secondary" className="mt-0.5">
              {formatDuration(session.duration)}
            </Typography>
            {session.notes && (
              <Typography variant="body-12" color="secondary" className="mt-1.5 text-center" numberOfLines={2}>
                {session.notes}
              </Typography>
            )}
          </View>
        )}
      </View>

      {/* Reaction button */}
      <View className="flex-row justify-end mt-2">
        <ReactionButton
          hasReacted={hasReacted}
          reactionCount={reactionCount}
          onToggle={() => onReactionToggle(session.id)}
        />
      </View>
    </Pressable>
  );
};
