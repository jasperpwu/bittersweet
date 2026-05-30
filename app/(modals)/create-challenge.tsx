import React, { useState, useCallback } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import { showToast } from '../../src/components/ui/Toast';

const STREAK_OPTIONS = [3, 5, 7, 14];

export default function CreateChallengeModal() {
  const friends = useAppStore((s) => s.grove.friends);
  const allTags = useAppStore((s) => s.focus.tags);
  const createChallenge = useAppStore((s) => s.grove.createChallenge);

  const [step, setStep] = useState<'friend' | 'tag' | 'duration'>('friend');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedFriend = friends.find((f) => f.profile.user_id === selectedFriendId);

  const activeTags = allTags.allIds
    .map((id) => allTags.byId[id])
    .filter((tag) => tag && !tag.deletedAt);

  const selectedTag = selectedTagId ? allTags.byId[selectedTagId] : null;

  const handleSelectFriend = useCallback((userId: string) => {
    setSelectedFriendId(userId);
    setStep('tag');
  }, []);

  const handleSelectTag = useCallback((tagId: string) => {
    setSelectedTagId(tagId);
    setStep('duration');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'tag') setStep('friend');
    else if (step === 'duration') setStep('tag');
    else router.back();
  }, [step]);

  const handleSubmit = useCallback(async () => {
    if (!selectedFriendId || !selectedTag) return;
    setIsSubmitting(true);
    try {
      await createChallenge({
        challengeeId: selectedFriendId,
        tagId: selectedTag.id,
        tagName: selectedTag.name,
        tagIcon: selectedTag.icon || '',
        streakDays,
      });
      showToast('Challenge sent!', 'success');
      router.back();
    } catch (error: any) {
      showToast('Failed to send challenge', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFriendId, selectedTag, streakDays, createChallenge]);

  const stepTitle = step === 'friend' ? 'Pick a Friend' : step === 'tag' ? 'Pick a Tag' : 'Pick Duration';

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={handleBack}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color="#6592E9" />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2">
          {stepTitle}
        </Typography>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Step 1: Friend picker */}
        {step === 'friend' && (
          <View>
            {friends.length === 0 ? (
              <View className="py-12 items-center">
                <Typography variant="body-14" color="secondary" className="text-center">
                  Add friends first to send challenges.
                </Typography>
              </View>
            ) : (
              friends.map((friend) => (
                <Pressable
                  key={friend.profile.user_id}
                  onPress={() => handleSelectFriend(friend.profile.user_id)}
                  className="flex-row items-center py-3 active:opacity-70"
                >
                  {friend.profile.avatar_url ? (
                    <Image
                      source={{ uri: friend.profile.avatar_url }}
                      style={{ width: 40, height: 40, borderRadius: 20, marginRight: 12 }}
                    />
                  ) : (
                    <View className="mr-3">
                      <DefaultAvatar
                        displayName={friend.profile.display_name}
                        color={friend.profile.avatar_color}
                        size={40}
                      />
                    </View>
                  )}
                  <View className="flex-1">
                    <Typography variant="subtitle-14-medium" color="primary">
                      {friend.profile.display_name}
                    </Typography>
                    <Typography variant="body-12" color="secondary">
                      @{friend.profile.handle}
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#8A8A8A" />
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Step 2: Tag picker */}
        {step === 'tag' && (
          <View>
            <View className="mb-4">
              <Typography variant="body-12" color="secondary">
                Pick the tag you both need to focus on each day.
              </Typography>
            </View>
            {activeTags.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => handleSelectTag(tag.id)}
                className="flex-row items-center py-3 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-xl bg-light-border/30 dark:bg-[#2A2B45] items-center justify-center mr-3">
                  <Typography variant="body-14">{tag.icon || ''}</Typography>
                </View>
                <Typography variant="subtitle-14-medium" color="primary" className="flex-1">
                  {tag.name}
                </Typography>
                <Ionicons name="chevron-forward" size={18} color="#8A8A8A" />
              </Pressable>
            ))}
          </View>
        )}

        {/* Step 3: Duration picker */}
        {step === 'duration' && (
          <View>
            {/* Summary */}
            <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4 mb-6">
              <View className="flex-row items-center mb-2">
                <Typography variant="body-12" color="secondary" className="mr-1">
                  Challenging
                </Typography>
                <Typography variant="subtitle-14-medium" color="primary">
                  {selectedFriend?.profile.display_name}
                </Typography>
              </View>
              <View className="flex-row items-center">
                <Typography variant="body-12" color="secondary" className="mr-1">
                  Tag:
                </Typography>
                <Typography variant="body-14" className="mr-1">
                  {selectedTag?.icon}
                </Typography>
                <Typography variant="subtitle-14-medium" color="primary">
                  {selectedTag?.name}
                </Typography>
              </View>
            </View>

            <Typography variant="subtitle-14-medium" color="primary" className="mb-3">
              How many consecutive days?
            </Typography>

            <View className="flex-row flex-wrap gap-3 mb-8">
              {STREAK_OPTIONS.map((days) => (
                <Pressable
                  key={days}
                  onPress={() => setStreakDays(days)}
                  className={`flex-1 min-w-[70px] py-3 rounded-xl items-center ${
                    streakDays === days
                      ? 'bg-primary'
                      : 'bg-light-border/30 dark:bg-[#242540]'
                  }`}
                >
                  <Typography
                    variant="subtitle-16"
                    style={{ color: streakDays === days ? '#FFFFFF' : undefined }}
                    color={streakDays === days ? undefined : 'primary'}
                  >
                    {days}
                  </Typography>
                  <Typography
                    variant="body-12"
                    style={{ color: streakDays === days ? '#FFFFFF' : undefined }}
                    color={streakDays === days ? undefined : 'secondary'}
                  >
                    days
                  </Typography>
                </Pressable>
              ))}
            </View>

            <View className="bg-[#E9A065]/10 rounded-xl px-4 py-3 mb-6">
              <Typography variant="body-12" color="secondary">
                Both you and {selectedFriend?.profile.display_name} must focus with the "{selectedTag?.name}" tag every day for {streakDays} consecutive days. You'll both earn 10 fruits on completion!
              </Typography>
            </View>

            {/* Submit */}
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              className="bg-[#E9A065] rounded-2xl py-4 items-center active:opacity-80"
              style={{ opacity: isSubmitting ? 0.6 : 1 }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Typography variant="subtitle-16" style={{ color: '#FFFFFF' }}>
                  Send Challenge
                </Typography>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
