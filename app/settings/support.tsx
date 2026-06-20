import React from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Share, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { openChat } from '../../src/services/crisp';
import { openFeedbackBoard } from '../../src/services/userjot';

export default function SupportScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { triggerHaptic } = useDeviceIntegration();

  const handleShareWithFriends = async () => {
    triggerHaptic('light');
    try {
      await Share.share({
        message: 'Check out Bittersweet — a focus timer that helps you stay productive! https://apps.apple.com/app/bittersweet',
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
          Support & About
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Support */}
        <SettingsSection title="Support">
          <SettingsItem
            title="Share with Friends"
            subtitle="Spread the focus"
            icon="share-social-outline"
            hasChevron
            onPress={handleShareWithFriends}
          />
          <SettingsItem
            title="Help & Feedback"
            subtitle="Chat with us"
            icon="chatbubble-ellipses-outline"
            hasChevron
            onPress={handleHelpAndFeedback}
          />
          <SettingsItem
            title="Feature Requests"
            subtitle="Suggest & vote on ideas"
            icon="bulb-outline"
            hasChevron
            onPress={handleFeedbackBoard}
            isLast
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsItem
            title="Version"
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
