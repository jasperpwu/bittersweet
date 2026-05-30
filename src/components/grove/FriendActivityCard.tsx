import React from 'react';
import { View, Image } from 'react-native';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from './DefaultAvatar';
import { ReactionButton } from './ReactionButton';
import type { FeedItem } from '../../services/grove/GroveFeedService';

interface FriendActivityCardProps {
  item: FeedItem;
  onReactionToggle: (sharedSessionId: string) => void;
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
  const { profile, sharedSession, reactionCount, hasReacted } = item;

  return (
    <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4 w-[280px]">
      {/* Header: avatar + name + time */}
      <View className="flex-row items-center mb-3">
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
          />
        ) : (
          <View className="mr-2.5">
            <DefaultAvatar
              displayName={profile.display_name}
              color={profile.avatar_color}
              size={36}
            />
          </View>
        )}
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
            {timeAgo(sharedSession.shared_at)}
          </Typography>
        </View>
      </View>

      {/* Session info: tag icon + name + duration */}
      <View className="flex-row items-center mb-2">
        <Typography variant="body-14" color="primary" className="mr-1.5">
          {sharedSession.tag_icon}
        </Typography>
        <Typography variant="subtitle-14-medium" color="primary" className="flex-1" numberOfLines={1}>
          {sharedSession.tag_name}
        </Typography>
        <Typography variant="subtitle-14-medium" color="primary">
          {formatDuration(sharedSession.duration)}
        </Typography>
      </View>

      {/* Notes (if any) */}
      {sharedSession.notes && (
        <View className="mb-2">
          <Typography variant="body-12" color="secondary" numberOfLines={2}>
            {sharedSession.notes}
          </Typography>
        </View>
      )}

      {/* Reaction button */}
      <View className="flex-row justify-end mt-1">
        <ReactionButton
          hasReacted={hasReacted}
          reactionCount={reactionCount}
          onToggle={() => onReactionToggle(sharedSession.id)}
        />
      </View>
    </View>
  );
};
