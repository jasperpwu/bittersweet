import React, { useEffect, useCallback } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../src/components/ui/Typography';
import { colors } from '../../src/config/theme';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { showToast } from '../../src/components/ui/Toast';
import { useAppStore } from '../../src/store';
import type { BlockedUser } from '../../src/services/grove/GroveModerationService';
import { directionalIcon } from '../../src/utils/directionalIcon';

export default function BlockedAccountsModal() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const blockedUsers = useAppStore((s) => s.grove.blockedUsers);
  const blockedLoading = useAppStore((s) => s.grove.blockedLoading);
  const fetchBlockedUsers = useAppStore((s) => s.grove.fetchBlockedUsers);
  const unblockUser = useAppStore((s) => s.grove.unblockUser);

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  const handleUnblock = useCallback(
    (item: BlockedUser) => {
      const name = item.profile?.display_name ?? t('moderation.thisAccount');
      Alert.alert(
        t('moderation.unblockConfirmTitle', { name }),
        t('moderation.unblockConfirmBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('moderation.unblock'),
            onPress: async () => {
              try {
                await unblockUser(item.userId);
                showToast(t('moderation.unblockedToast'), 'success');
              } catch {
                showToast(t('moderation.unblockFailed'), 'error');
              }
            },
          },
        ]
      );
    },
    [unblockUser, t]
  );

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] flex-row items-center px-5">
        <Pressable
          onPress={() => router.back()}
          className="-ml-2 h-10 w-10 items-center justify-center active:opacity-60"
          hitSlop={8}>
          <Ionicons name={directionalIcon('arrow-back')} size={24} color={colors.primary} />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          {t('moderation.blockedAccounts')}
        </Typography>
      </View>

      {blockedLoading ? (
        <View className="items-center py-12">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          <Typography variant="body-14" color="secondary" className="mb-4">
            {t('moderation.blockedAccountsIntro')}
          </Typography>

          {blockedUsers.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons
                name="ban-outline"
                size={28}
                color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
              />
              <Typography variant="body-14" color="secondary" className="mt-3 text-center">
                {t('moderation.blockedEmpty')}
              </Typography>
            </View>
          ) : (
            <View className="pb-8">
              {blockedUsers.map((item) => (
                <View
                  key={item.userId}
                  className="mb-3 flex-row items-center rounded-2xl bg-light-border/30 p-4 dark:bg-dark-card">
                  {item.profile?.avatar_url ? (
                    <Image
                      source={{ uri: item.profile.avatar_url }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                  ) : (
                    <DefaultAvatar
                      displayName={item.profile?.display_name ?? '?'}
                      color={item.profile?.avatar_color}
                      size={40}
                    />
                  )}
                  <View className="ml-3 flex-1">
                    <Typography variant="subtitle-14-medium" color="primary" numberOfLines={1}>
                      {item.profile?.display_name ?? t('moderation.thisAccount')}
                    </Typography>
                    {item.profile?.handle ? (
                      <Typography variant="body-12" color="secondary">
                        @{item.profile.handle}
                      </Typography>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => handleUnblock(item)}
                    className="h-8 items-center justify-center rounded-full bg-light-border px-4 active:opacity-70 dark:bg-dark-border"
                    hitSlop={6}>
                    <Typography variant="body-12" color="primary">
                      {t('moderation.unblock')}
                    </Typography>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
