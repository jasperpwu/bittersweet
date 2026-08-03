import React, { FC, RefObject, useState } from 'react';
import { View, Alert, Pressable, useColorScheme } from 'react-native';
import { colors } from '../../../config/theme';
import { Typography } from '../../ui/Typography';
import { BadgeCard } from './BadgeCard';
import { BadgeSummarySheet } from './BadgeSummarySheet';
import { Badge } from '../../../store/types';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface BadgeCollectionProps {
  badges: Badge[];
  onDeleteBadge: (badgeId: string) => void;
  /** Spotlight target for the Goals tab walkthrough. */
  sectionRef?: RefObject<View | null>;
}

export const BadgeCollection: FC<BadgeCollectionProps> = ({
  badges,
  onDeleteBadge,
  sectionRef,
}) => {
  const { t } = useTranslation();
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const hasBadges = badges && badges.length > 0;
  const selectedBadge = selectedBadgeId ? badges.find((b) => b.id === selectedBadgeId) : null;

  const handleDeleteBadge = (badgeId: string) => {
    Alert.alert(
      t('badge.deleteTitle'),
      t('badge.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
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
    <View ref={sectionRef} collapsable={false} className="mb-6 px-5">
      {/* Section Header */}
      <Pressable
        className="mb-3 flex-row items-center"
        onPress={() => setIsCollapsed(!isCollapsed)}
        style={{ paddingVertical: 4 }}>
        <Typography variant="subtitle-16" color="primary" className="mr-2">
          {t('badge.sectionTitle')}
        </Typography>
        {hasBadges && (
          <Typography variant="body-12" color="secondary" className="mr-2">
            {badges.length}
          </Typography>
        )}
        <Ionicons
          name={isCollapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
        />
      </Pressable>

      {/* Content */}
      {!isCollapsed &&
        (hasBadges ? (
          <View className="-mx-1.5 flex-row flex-wrap">
            {badges.map((badge) => (
              <View key={badge.id} className="mb-3 w-1/2 px-1.5">
                <BadgeCard badge={badge} onPress={() => setSelectedBadgeId(badge.id)} />
              </View>
            ))}
          </View>
        ) : (
          <View className="items-center py-6">
            <Typography variant="body-14" color="secondary" className="text-center">
              {t('badge.empty')}
            </Typography>
          </View>
        ))}

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
