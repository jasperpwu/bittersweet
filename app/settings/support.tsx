import React from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Share, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { openChat } from '../../src/services/crisp';
import { openFeedbackBoard } from '../../src/services/userjot';
import { useTranslation } from 'react-i18next';

export default function SupportScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { triggerHaptic } = useDeviceIntegration();

  const handleShareWithFriends = async () => {
    triggerHaptic('light');
    try {
      await Share.share({
        message: t('support.shareMessage'),
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const handleHelpAndFeedback = () => {
    triggerHaptic('light');
    openChat();
  };

  const handleFeedbackBoard = () => {
    triggerHaptic('light');
    openFeedbackBoard();
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#5D4E37'} />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          {t('settings.tab.support')}
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Support */}
        <SettingsSection title={t('support.supportSection')}>
          <SettingsItem
            title={t('support.shareTitle')}
            subtitle={t('support.shareSub')}
            icon="share-social-outline"
            hasChevron
            onPress={handleShareWithFriends}
          />
          <SettingsItem
            title={t('support.helpTitle')}
            subtitle={t('support.helpSub')}
            icon="chatbubble-ellipses-outline"
            hasChevron
            onPress={handleHelpAndFeedback}
          />
          <SettingsItem
            title={t('support.featureTitle')}
            subtitle={t('support.featureSub')}
            icon="bulb-outline"
            hasChevron
            onPress={handleFeedbackBoard}
            isLast
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title={t('support.aboutSection')}>
          <SettingsItem
            title={t('support.version')}
            icon="information-circle-outline"
            valueLabel="1.0.0"
            isLast
          />
        </SettingsSection>

        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}
