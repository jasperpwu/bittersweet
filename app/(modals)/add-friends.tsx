import React from 'react';
import { View, SafeAreaView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { InviteLinkCard } from '../../src/components/grove/InviteLinkCard';

export default function AddFriendsModal() {
  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#6592E9" />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          Add Friends
        </Typography>
      </View>

      <View className="flex-1 px-5 pt-4">
        <InviteLinkCard />

        <View className="mt-6 items-center">
          <Typography variant="body-12" color="secondary" className="text-center px-4">
            Friends added via invite link are automatically accepted — no pending request needed.
          </Typography>
        </View>
      </View>
    </SafeAreaView>
  );
}
