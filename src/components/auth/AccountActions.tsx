import React from 'react';
import { View, Pressable, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { useAppStore } from '../../store';
import { colors } from '../../config/theme';
import { useTranslation } from 'react-i18next';

export const AccountActions: React.FC = () => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useAppStore((state) => state.auth);
  const signOut = useAppStore((state) => state.auth.signOut);
  const deleteAccount = useAppStore((state) => state.auth.deleteAccount);

  if (!isAuthenticated) return null;

  const handleSignOut = () => {
    Alert.alert(t('account.signOut'), t('account.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.signOut'),
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('account.deleteAccount'),
      t('account.deleteAccountConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('account.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error: any) {
              Alert.alert(
                t('account.deletionFailed'),
                error?.message || t('account.deletionFailedBody')
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        {t('account.other')}
      </Typography>
      <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl px-4">
        <Pressable
          onPress={handleSignOut}
          disabled={isLoading}
          className="py-3 border-b border-light-border dark:border-dark-border active:opacity-70"
        >
          <View className="flex-row items-center">
            <View className="w-8 items-center mr-3">
              <Ionicons name="log-out-outline" size={20} color={colorScheme === 'dark' ? colors.dark.textSecondary : colors.light.screenTextSecondary} />
            </View>
            <Typography variant="subtitle-14-medium" color="primary">
              {t('account.signOut')}
            </Typography>
            {isLoading && (
              <ActivityIndicator size="small" color={colors.primary} className="ml-auto" />
            )}
          </View>
        </Pressable>

        <Pressable
          onPress={handleDeleteAccount}
          disabled={isLoading}
          className="py-3 active:opacity-70"
        >
          <View className="flex-row items-center">
            <View className="w-8 items-center mr-3">
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </View>
            <Typography variant="subtitle-14-medium" className="text-error">
              {t('account.deleteAccount')}
            </Typography>
          </View>
        </Pressable>
      </View>
    </View>
  );
};
