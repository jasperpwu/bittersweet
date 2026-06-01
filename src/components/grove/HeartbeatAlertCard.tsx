import React from 'react';
import { View, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { DefaultAvatar } from './DefaultAvatar';
import type { HeartbeatAlert } from '../../services/grove/GroveHeartbeatService';

interface HeartbeatAlertCardProps {
  alert: HeartbeatAlert;
  onCheckIn: (alert: HeartbeatAlert) => void;
  onDismiss: (alertId: string) => void;
}

export const HeartbeatAlertCard: React.FC<HeartbeatAlertCardProps> = ({
  alert,
  onCheckIn,
  onDismiss,
}) => {
  const profile = alert.aboutProfile;

  return (
    <View className="mx-5 mb-3 bg-[#FF6B6B]/10 rounded-2xl p-4">
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
          <Typography variant="subtitle-14-medium" color="primary">
            {profile.display_name}
          </Typography>
          <Typography variant="body-12" color="secondary">
            {alert.notificationText}
          </Typography>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => onCheckIn(alert)}
          className="flex-1 flex-row items-center justify-center bg-[#FF6B6B] rounded-xl py-2.5 active:opacity-80"
        >
          <Ionicons name="chatbubble-outline" size={14} color="#FFFFFF" />
          <Typography variant="subtitle-14-medium" style={{ color: '#FFFFFF' }} className="ml-1.5">
            Acknowledge
          </Typography>
        </Pressable>
        <Pressable
          onPress={() => onDismiss(alert.id)}
          className="flex-1 flex-row items-center justify-center bg-light-border/50 dark:bg-[#2A2B4A] rounded-xl py-2.5 active:opacity-70"
        >
          <Typography variant="subtitle-14-medium" color="secondary">
            Dismiss
          </Typography>
        </Pressable>
      </View>
    </View>
  );
};
