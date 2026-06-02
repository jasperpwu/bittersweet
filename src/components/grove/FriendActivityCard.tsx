import React from 'react';
import { View, Image } from 'react-native';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from './DefaultAvatar';
import { FocusingBadge } from './FocusingBadge';
import { ReactionButton } from './ReactionButton';
import type { FeedItem } from '../../services/grove/GroveFeedService';

interface FriendActivityCardProps {
  item: FeedItem;
  onReactionToggle: (sessionId: string) => void;
  isNew?: boolean;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return 'yesterday';
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
}) => {
  const { profile, session, reactionCount, hasReacted } = item;

  return (
    <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4 w-[280px]">
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
      </View>

      {/* Session info: tag icon + name + duration */}
      <View className="flex-row items-center mb-2">
        <Typography variant="body-14" color="primary" className="mr-1.5">
          {session.session_tags?.icon ?? '🎯'}
        </Typography>
        <Typography variant="subtitle-14-medium" color="primary" className="flex-1" numberOfLines={1}>
          {session.session_tags?.name ?? 'Focus'}
        </Typography>
        <Typography variant="subtitle-14-medium" color="primary">
          {formatDuration(session.duration)}
        </Typography>
      </View>

      {/* Photo (if any) */}
      {session.photo_url && (
        <View className="mb-2">
          <Image
            source={{ uri: session.photo_url }}
            style={{ width: '100%', height: 150, borderRadius: 10 }}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Notes (if any) */}
      {session.notes && (
        <View className="mb-2">
          <Typography variant="body-12" color="secondary" numberOfLines={2}>
            {session.notes}
          </Typography>
        </View>
      )}

      {/* Reaction button */}
      <View className="flex-row justify-end mt-1">
        <ReactionButton
          hasReacted={hasReacted}
          reactionCount={reactionCount}
          onToggle={() => onReactionToggle(session.id)}
        />
      </View>
    </View>
  );
};
