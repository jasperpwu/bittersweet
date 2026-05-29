import React, { FC, useState } from 'react';
import { View, Alert, Pressable, useColorScheme } from 'react-native';
import { Typography } from '../../ui/Typography';
import { BadgeCard } from './BadgeCard';
import { BadgeSummarySheet } from './BadgeSummarySheet';
import { Badge } from '../../../store/types';
import { Ionicons } from '@expo/vector-icons';

interface BadgeCollectionProps {
  badges: Badge[];
  onDeleteBadge: (badgeId: string) => void;
}

export const BadgeCollection: FC<BadgeCollectionProps> = ({ badges, onDeleteBadge }) => {
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!badges || badges.length === 0) return null;

  const selectedBadge = selectedBadgeId ? badges.find(b => b.id === selectedBadgeId) : null;

  const handleDeleteBadge = (badgeId: string) => {
    Alert.alert(
      'Delete Badge?',
      'This badge will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteBadge(badgeId);
            setSelectedBadgeId(null);
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View className="px-5 mb-6">
      {/* Section Header */}
      <Pressable 
        className="flex-row items-center mb-3"
        onPress={() => setIsCollapsed(!isCollapsed)}
        style={{ paddingVertical: 4 }}
      >
        <Typography variant="subtitle-16" color="primary" className="mr-2">
          Badges
        </Typography>
        <Typography variant="body-12" color="secondary" className="mr-2">
          {badges.length}
        </Typography>
        <Ionicons 
          name={isCollapsed ? "chevron-down" : "chevron-up"} 
          size={16} 
          color={isDark ? '#CACACA' : '#8B7355'} 
        />
      </Pressable>

      {/* 2-column grid */}
      {!isCollapsed && (
        <View className="flex-row flex-wrap -mx-1.5">
          {badges.map(badge => (
            <View key={badge.id} className="w-1/2 px-1.5 mb-3">
              <BadgeCard
                badge={badge}
                onPress={() => setSelectedBadgeId(badge.id)}
              />
            </View>
          ))}
        </View>
      )}

      {/* Summary Sheet */}
      <BadgeSummarySheet
        badge={selectedBadge || undefined}
        isVisible={!!selectedBadge}
        onClose={() => setSelectedBadgeId(null)}
        onDelete={() => selectedBadge && handleDeleteBadge(selectedBadge.id)}
      />
    </View>
  );
};
