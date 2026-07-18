import React from 'react';
import { View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from './DefaultAvatar';
import { FocusingBadge } from './FocusingBadge';
import type { RankingItem } from '../../services/grove/GroveRankingService';
import { useTranslation } from 'react-i18next';

interface LeaderboardRowProps {
  item: RankingItem;
  maxMinutes: number;
  onPress?: () => void;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ item, maxMinutes, onPress }) => {
  const { t } = useTranslation();
  const progressWidth = maxMinutes > 0 ? (item.totalMinutes / maxMinutes) * 100 : 0;

  const Wrapper = onPress ? Pressable : View;
  const wrapperProps = onPress ? { onPress, className: `flex-row items-center py-3 px-4 active:opacity-70 ${item.isCurrentUser ? 'bg-primary/10 rounded-xl' : ''}` } : { className: `flex-row items-center py-3 px-4 ${item.isCurrentUser ? 'bg-primary/10 rounded-xl' : ''}` };

  return (
    <Wrapper
      {...wrapperProps}
    >
      {/* Rank */}
      <View className="w-7 items-center mr-2">
        <Typography variant="subtitle-14-medium" color={item.rank <= 3 ? 'primary' : 'secondary'}>
          {item.rank}
        </Typography>
      </View>

      {/* Tree icon */}
      <Typography variant="body-14" className="mr-2">
        {item.treeIcon}
      </Typography>

      {/* Avatar */}
      <View style={{ position: 'relative', marginRight: 10 }}>
        {item.avatarUrl ? (
          <Image
            source={{ uri: item.avatarUrl }}
            style={{ width: 32, height: 32, borderRadius: 16 }}
          />
        ) : (
          <DefaultAvatar
            displayName={item.displayName}
            color={item.avatarColor}
            size={32}
          />
        )}
        {item.isFocusing && <FocusingBadge size={9} />}
      </View>

      {/* Name + progress bar */}
      <View className="flex-1 mr-3">
        <Typography
          variant="subtitle-14-medium"
          color="primary"
          numberOfLines={1}
        >
          {item.isCurrentUser ? t('common.you') : item.displayName}
        </Typography>
        <View className="h-1.5 bg-light-border/50 dark:bg-dark-card rounded-full mt-1">
          <View
            className="h-1.5 bg-primary rounded-full"
            style={{ width: `${Math.max(progressWidth, 2)}%` }}
          />
        </View>
      </View>

      {/* Duration */}
      <Typography variant="subtitle-14-medium" color="primary">
        {formatDuration(item.totalMinutes)}
      </Typography>
    </Wrapper>
  );
};
