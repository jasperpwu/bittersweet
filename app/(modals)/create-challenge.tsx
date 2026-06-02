import React, { useState, useCallback, useMemo } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { Slider } from '../../src/components/ui/Slider';
import { DatePicker } from '../../src/components/ui/DatePicker/DatePicker';
import { Toggle } from '../../src/components/ui/Toggle';
import { useAppStore } from '../../src/store';
import { showToast } from '../../src/components/ui/Toast';

type Period = 'daily' | 'weekly';

const SLIDER_CONFIG: Record<Period, { min: number; max: number; step: number }> = {
  daily: { min: 0.5, max: 12, step: 0.5 },
  weekly: { min: 1, max: 84, step: 1 },
};

function formatDuration(hours: number): string {
  if (hours < 1) return `${hours * 60}min`;
  if (hours === Math.floor(hours)) return `${hours}h`;
  return `${Math.floor(hours)}h ${(hours % 1) * 60}min`;
}

function getValidRepeatUntilDate(startDate: Date, selectedDate: Date, period: Period): Date {
  if (period === 'daily') return selectedDate;

  // Weekly: snap to day before start weekday
  const startDow = startDate.getDay();
  const targetDow = (startDow + 6) % 7;

  const diff = (targetDow - selectedDate.getDay() + 7) % 7;
  const snapped = new Date(selectedDate);
  snapped.setDate(snapped.getDate() + (diff === 0 ? 0 : diff));
  return snapped;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function CreateChallengeModal() {
  const friends = useAppStore((s) => s.grove.friends);
  const allTags = useAppStore((s) => s.focus.tags);
  const createChallenge = useAppStore((s) => s.grove.createChallenge);

  const [step, setStep] = useState<'friend' | 'tag' | 'config'>('friend');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [targetHours, setTargetHours] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date());
  const [repeatUntilEnabled, setRepeatUntilEnabled] = useState(false);
  const [repeatUntilDate, setRepeatUntilDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedFriend = friends.find((f) => f.profile.user_id === selectedFriendId);

  const activeTags = allTags.allIds
    .map((id) => allTags.byId[id])
    .filter((tag) => tag && !tag.deletedAt);

  const selectedTag = selectedTagId ? allTags.byId[selectedTagId] : null;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // For weekly period, compute the required end day name
  const requiredEndDayName = useMemo(() => {
    const targetDow = (startDate.getDay() + 6) % 7;
    return DAY_NAMES[targetDow];
  }, [startDate]);

  // Compute the snapped repeat-until date for weekly validation
  const effectiveRepeatUntilDate = useMemo(() => {
    if (!repeatUntilEnabled) return null;
    return getValidRepeatUntilDate(startDate, repeatUntilDate, period);
  }, [repeatUntilEnabled, startDate, repeatUntilDate, period]);

  const handleSelectFriend = useCallback((userId: string) => {
    setSelectedFriendId(userId);
    setStep('tag');
  }, []);

  const handleSelectTag = useCallback((tagId: string) => {
    setSelectedTagId(tagId);
    setStep('config');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'tag') setStep('friend');
    else if (step === 'config') setStep('tag');
    else router.back();
  }, [step]);

  const handlePeriodChange = useCallback((newPeriod: Period) => {
    setPeriod(newPeriod);
    // Reset target hours to a sensible default for the new period
    setTargetHours(newPeriod === 'daily' ? 1 : 7);
  }, []);

  const handleRepeatUntilDateChange = useCallback((date: Date) => {
    setRepeatUntilDate(date);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedFriendId || !selectedTag) return;
    setIsSubmitting(true);
    try {
      const startDateStr = startDate.toISOString().split('T')[0];
      let repeatUntilStr: string | null = null;
      if (repeatUntilEnabled && effectiveRepeatUntilDate) {
        repeatUntilStr = effectiveRepeatUntilDate.toISOString().split('T')[0];
      }

      await createChallenge({
        challengeeId: selectedFriendId,
        tagId: selectedTag.id,
        tagName: selectedTag.name,
        tagIcon: selectedTag.icon || '',
        period,
        targetMinutes: Math.round(targetHours * 60),
        startDate: startDateStr,
        repeatUntilDate: repeatUntilStr,
      });
      showToast('Challenge sent!', 'success');
      router.back();
    } catch (error: any) {
      showToast('Failed to send challenge', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFriendId, selectedTag, period, targetHours, startDate, repeatUntilEnabled, effectiveRepeatUntilDate, createChallenge]);

  const stepTitle = step === 'friend' ? 'Pick a Friend' : step === 'tag' ? 'Pick a Tag' : 'Configure Challenge';

  const sliderConfig = SLIDER_CONFIG[period];

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
                Pick the tag you both need to focus on.
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

        {/* Step 3: Config */}
        {step === 'config' && (
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

            {/* Period Selector */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              Time Period
            </Typography>
            <View className="flex-row gap-x-2 mb-6">
              {(['daily', 'weekly'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => handlePeriodChange(p)}
                  className={`flex-1 py-2.5 rounded-xl ${
                    period === p ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
                  }`}
                >
                  <Typography
                    variant="body-14"
                    className={`text-center ${period === p ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Typography>
                </Pressable>
              ))}
            </View>

            {/* Target Duration Slider */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              Target Duration
            </Typography>
            <View className="bg-light-border/30 dark:bg-[#242540] rounded-xl px-4 py-3 items-center mb-6">
              <Typography variant="headline-20" color="primary" className="mb-1">
                {formatDuration(targetHours)}/{period === 'daily' ? 'day' : 'week'}
              </Typography>
              <Slider
                value={targetHours}
                minimumValue={sliderConfig.min}
                maximumValue={sliderConfig.max}
                step={sliderConfig.step}
                onValueChange={setTargetHours}
                unit="h"
              />
            </View>

            {/* Start Date */}
            <View className="mb-6">
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                label="Start Date"
                minimumDate={today}
              />
            </View>

            {/* Repeat Until */}
            <View className="flex-row items-center justify-between mb-3">
              <Typography variant="subtitle-14-medium" color="primary">
                Repeat until a date
              </Typography>
              <Toggle
                value={repeatUntilEnabled}
                onValueChange={setRepeatUntilEnabled}
                size="small"
              />
            </View>
            {repeatUntilEnabled && (
              <View className="mb-6">
                <DatePicker
                  value={effectiveRepeatUntilDate || repeatUntilDate}
                  onChange={handleRepeatUntilDateChange}
                  minimumDate={startDate}
                />
                {period === 'weekly' && (
                  <Typography variant="body-12" color="secondary" className="mt-1">
                    Must end on a {requiredEndDayName}
                  </Typography>
                )}
              </View>
            )}
            {!repeatUntilEnabled && <View className="mb-6" />}

            {/* Info Box */}
            <View className="bg-[#E9A065]/10 rounded-xl px-4 py-3 mb-6">
              <Typography variant="body-12" color="secondary">
                Both you and {selectedFriend?.profile.display_name} must focus with the &quot;{selectedTag?.name}&quot; tag for {formatDuration(targetHours)} per {period === 'daily' ? 'day' : 'week'}.{repeatUntilEnabled && effectiveRepeatUntilDate ? ` Challenge ends ${effectiveRepeatUntilDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.` : ' No end date — keep going!'}
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
