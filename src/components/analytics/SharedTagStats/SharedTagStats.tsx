import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Pressable, Text, Alert, useColorScheme, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../ui/Typography';
import { SessionTag } from '../../../types/models';
import type { JoinerStats, JoinerDailyStat } from '../../../services/sharedTag/types';

type Props = {
  sharingTags: SessionTag[];
  sharedTagStats: {
    joinerStats: JoinerStats[];
    loading: boolean;
    currentTagId: string | null;
  };
  onFetchStats: (ownerTagId: string, startDate: string, endDate: string) => Promise<any[]>;
  onRemoveJoiner: (membershipId: string) => Promise<void>;
};

function getWeekRange(offset: number = 0): { start: string; end: string; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset + offset * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const shortFmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  return {
    start: fmt(monday),
    end: fmt(sunday),
    label: offset === 0 ? 'This Week' : `${shortFmt(monday)} - ${shortFmt(sunday)}`,
  };
}

function DailyBar({ stat, maxMinutes }: { stat: JoinerDailyStat; maxMinutes: number }) {
  const pct = maxMinutes > 0 ? Math.min(1, stat.total_minutes / maxMinutes) : 0;
  const dayLabel = new Date(stat.day + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <View className="items-center flex-1">
      <View className="w-full h-24 justify-end items-center">
        <View
          className="w-5 rounded-t-md"
          style={{
            height: `${Math.max(pct * 100, 4)}%`,
            backgroundColor: pct > 0 ? '#3B82F6' : 'rgba(100,100,100,0.2)',
          }}
        />
      </View>
      <Text className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-1">
        {dayLabel}
      </Text>
      <Text className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
        {stat.total_minutes > 0 ? `${stat.total_minutes}m` : '-'}
      </Text>
    </View>
  );
}

function JoinerCard({
  joiner,
  onRemove,
}: {
  joiner: JoinerStats;
  onRemove: (membershipId: string) => void;
}) {
  const colorScheme = useColorScheme();
  const [expanded, setExpanded] = useState(false);

  const totalMinutes = joiner.daily_stats.reduce((sum, d) => sum + d.total_minutes, 0);
  const totalSessions = joiner.daily_stats.reduce((sum, d) => sum + d.session_count, 0);
  const maxMinutes = Math.max(...joiner.daily_stats.map(d => d.total_minutes), 1);

  const handleRemove = () => {
    Alert.alert(
      'Remove member?',
      `Remove ${joiner.display_name} from this shared tag? They keep their local copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(joiner.membership_id),
        },
      ]
    );
  };

  return (
    <View className="bg-light-border/30 dark:bg-gray-700 rounded-xl mb-2 overflow-hidden">
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center p-3"
      >
        {/* Avatar */}
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: joiner.avatar_color || '#6592E9' }}
        >
          <Text className="text-white text-xs font-bold">
            {joiner.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Name + stats */}
        <View className="flex-1">
          <Typography variant="subtitle-14-medium" color="primary">
            {joiner.display_name}
          </Typography>
          <Typography variant="body-12" color="secondary">
            {totalMinutes}m total &middot; {totalSessions} sessions
          </Typography>
        </View>

        {/* Expand arrow */}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colorScheme === 'dark' ? '#888' : '#AAA'}
        />
      </Pressable>

      {expanded && (
        <View className="px-3 pb-3">
          {/* Daily bars */}
          <View className="flex-row mt-1">
            {joiner.daily_stats.map((stat) => (
              <DailyBar key={stat.day} stat={stat} maxMinutes={maxMinutes} />
            ))}
          </View>

          {/* Remove button */}
          <Pressable
            onPress={handleRemove}
            className="mt-3 py-2 items-center rounded-lg active:opacity-60"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#EF4444' }}>
              Remove Member
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export function SharedTagStats({ sharingTags, sharedTagStats, onFetchStats, onRemoveJoiner }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Auto-select first sharing tag
  useEffect(() => {
    if (sharingTags.length > 0 && !selectedTagId) {
      setSelectedTagId(sharingTags[0].id);
    }
  }, [sharingTags, selectedTagId]);

  const week = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  // Fetch stats when tag or week changes
  useEffect(() => {
    if (selectedTagId) {
      onFetchStats(selectedTagId, week.start, week.end);
    }
  }, [selectedTagId, week.start, week.end]);

  const handleRemove = useCallback(async (membershipId: string) => {
    try {
      await onRemoveJoiner(membershipId);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove member');
    }
  }, [onRemoveJoiner]);

  if (sharingTags.length === 0) return null;

  const { joinerStats, loading } = sharedTagStats;

  // Count total members across all tags
  const memberCount = joinerStats.length;

  return (
    <View className="px-4 mb-6">
      {/* Section Header */}
      <Pressable
        className="flex-row items-center mb-3"
        onPress={() => setIsCollapsed(!isCollapsed)}
        style={{ paddingVertical: 4 }}
      >
        <Typography variant="subtitle-16" color="primary" className="mr-2">
          Shared Tag Members
        </Typography>
        <Ionicons
          name={isCollapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={isDark ? '#CACACA' : '#8B7355'}
        />
      </Pressable>

      {!isCollapsed && (<>
      {/* Tag filter pills */}
      {sharingTags.length > 1 && (
        <View className="flex-row flex-wrap gap-2 mb-3">
          {sharingTags.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => { setSelectedTagId(tag.id); setWeekOffset(0); }}
              className="flex-row items-center px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: selectedTagId === tag.id
                  ? (tag.color || '#3B82F6')
                  : colorScheme === 'dark' ? '#374151' : '#E5E7EB',
              }}
            >
              <Text className="text-sm mr-1">{tag.icon}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: selectedTagId === tag.id ? '#FFFFFF' : (colorScheme === 'dark' ? '#D1D5DB' : '#6B7280'),
                }}
              >
                {tag.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Week navigation */}
      <View className="flex-row items-center justify-between mb-3">
        <Pressable onPress={() => setWeekOffset(w => w - 1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colorScheme === 'dark' ? '#D1D5DB' : '#6B7280'} />
        </Pressable>
        <Typography variant="subtitle-14-medium" color="secondary">{week.label}</Typography>
        <Pressable
          onPress={() => setWeekOffset(w => Math.min(0, w + 1))}
          hitSlop={8}
          disabled={weekOffset >= 0}
        >
          <Ionicons
            name="chevron-forward"
            size={20}
            color={weekOffset >= 0 ? 'transparent' : (colorScheme === 'dark' ? '#D1D5DB' : '#6B7280')}
          />
        </Pressable>
      </View>

      {/* Content */}
      {loading ? (
        <View className="py-8 items-center">
          <ActivityIndicator size="small" />
        </View>
      ) : joinerStats.length === 0 ? (
        <View className="py-6 items-center">
          <Typography variant="body-14" color="secondary" className="text-center">
            No members yet. Share your tag code to invite others.
          </Typography>
        </View>
      ) : (
        joinerStats.map((joiner) => (
          <JoinerCard
            key={joiner.membership_id}
            joiner={joiner}
            onRemove={handleRemove}
          />
        ))
      )}
      </>)}
    </View>
  );
}
