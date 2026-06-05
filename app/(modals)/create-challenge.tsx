import React, { useState, useCallback, useMemo } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { Slider } from '../../src/components/ui/Slider';
import { DatePicker } from '../../src/components/ui/DatePicker/DatePicker';
import { useAppStore } from '../../src/store';
import { showToast } from '../../src/components/ui/Toast';

type Period = 'daily' | 'weekly';
type CreationMode = 'streak' | 'until';

const SLIDER_CONFIG: Record<Period, { min: number; max: number; step: number }> = {
  daily: { min: 0.5, max: 12, step: 0.5 },
  weekly: { min: 1, max: 84, step: 1 },
};

function formatDuration(hours: number): string {
  if (hours < 1) return `${hours * 60}min`;
  if (hours === Math.floor(hours)) return `${hours}h`;
  return `${Math.floor(hours)}h ${(hours % 1) * 60}min`;
}

/** Snap a date forward to the next Monday (or keep if already Monday). */
function snapToMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun, 1=Mon, ...
  if (dow === 1) return d;
  const daysUntilMon = dow === 0 ? 1 : (8 - dow);
  d.setDate(d.getDate() + daysUntilMon);
  return d;
}

/** Snap a date forward to the next Sunday (or keep if already Sunday). */
function snapToSunday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 0) return d;
  d.setDate(d.getDate() + (7 - dow));
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function CreateChallengeModal() {
  const friends = useAppStore((s) => s.grove.friends);
  const allTags = useAppStore((s) => s.focus.tags);
  const createChallenge = useAppStore((s) => s.grove.createChallenge);

  const [step, setStep] = useState<'friend' | 'tag' | 'config'>('friend');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('daily');
  const [targetHours, setTargetHours] = useState(1);
  const [startDate, setStartDate] = useState(() => new Date());
  const [creationMode, setCreationMode] = useState<CreationMode>('streak');
  const [streakCount, setStreakCount] = useState(7);
  const [untilDate, setUntilDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedFriends = friends.filter((f) => selectedFriendIds.includes(f.profile.user_id));

  const activeTags = allTags.allIds
    .map((id) => allTags.byId[id])
    .filter((tag) => tag && !tag.deletedAt);

  const selectedTag = selectedTagId ? allTags.byId[selectedTagId] : null;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // For weekly: effective start date snapped to Monday
  const effectiveStartDate = useMemo(() => {
    if (period === 'weekly') return snapToMonday(startDate);
    return startDate;
  }, [startDate, period]);

  // Compute end date from mode
  const endDate = useMemo(() => {
    if (creationMode === 'streak') {
      const d = new Date(effectiveStartDate);
      if (period === 'daily') {
        d.setDate(d.getDate() + streakCount - 1);
      } else {
        // weekly: streakCount weeks from start (Monday), end on Sunday
        d.setDate(d.getDate() + (streakCount * 7) - 1);
      }
      return d;
    } else {
      // until-date mode
      if (period === 'weekly') return snapToSunday(untilDate);
      return untilDate;
    }
  }, [creationMode, effectiveStartDate, streakCount, untilDate, period]);

  const handleToggleFriend = useCallback((userId: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const handleFriendsNext = useCallback(() => {
    if (selectedFriendIds.length > 0) {
      setStep('tag');
    }
  }, [selectedFriendIds]);

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
    setTargetHours(newPeriod === 'daily' ? 1 : 7);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedFriendIds.length === 0 || !selectedTag) return;
    setIsSubmitting(true);
    try {
      await createChallenge({
        inviteeIds: selectedFriendIds,
        tagId: selectedTag.id,
        tagName: selectedTag.name,
        tagIcon: selectedTag.icon || '',
        period,
        targetMinutes: Math.round(targetHours * 60),
        startDate: toDateStr(effectiveStartDate),
        endDate: toDateStr(endDate),
      });
      showToast('Challenge sent!', 'success');
      router.back();
    } catch (error: any) {
      showToast('Failed to send challenge', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFriendIds, selectedTag, period, targetHours, effectiveStartDate, endDate, createChallenge]);

  const stepTitle = step === 'friend' ? 'Pick Friends' : step === 'tag' ? 'Pick a Tag' : 'Configure Challenge';

  const sliderConfig = SLIDER_CONFIG[period];

  const periodLabel = period === 'daily' ? 'days' : 'weeks';

  /** Format selected friend names for summary display */
  const friendNamesSummary = useMemo(() => {
    if (selectedFriends.length === 0) return '';
    const names = selectedFriends.map(f => f.profile.display_name);
    if (names.length <= 3) return names.join(', ');
    return `${names.slice(0, 2).join(', ')}, and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''}`;
  }, [selectedFriends]);

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
        <Typography variant="headline-18" color="primary" className="ml-2 flex-1">
          {stepTitle}
        </Typography>
        {step === 'friend' && selectedFriendIds.length > 0 && (
          <Typography variant="body-12" color="secondary">
            {selectedFriendIds.length} selected
          </Typography>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Step 1: Friend picker (multi-select) */}
        {step === 'friend' && (
          <View>
            {friends.length === 0 ? (
              <View className="py-12 items-center">
                <Typography variant="body-14" color="secondary" className="text-center">
                  Add friends first to send challenges.
                </Typography>
              </View>
            ) : (
              <>
                {friends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.profile.user_id);
                  return (
                    <Pressable
                      key={friend.profile.user_id}
                      onPress={() => handleToggleFriend(friend.profile.user_id)}
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
                      <View
                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                          isSelected
                            ? 'bg-[#E9A065] border-[#E9A065]'
                            : 'border-light-border dark:border-dark-border'
                        }`}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
                {/* Next button */}
                <Pressable
                  onPress={handleFriendsNext}
                  disabled={selectedFriendIds.length === 0}
                  className="bg-[#E9A065] rounded-2xl py-4 items-center mt-4 active:opacity-80"
                  style={{ opacity: selectedFriendIds.length === 0 ? 0.4 : 1 }}
                >
                  <Typography variant="subtitle-16" style={{ color: '#FFFFFF' }}>
                    Next
                  </Typography>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Step 2: Tag picker */}
        {step === 'tag' && (
          <View>
            <View className="mb-4">
              <Typography variant="body-12" color="secondary">
                Pick the tag everyone needs to focus on.
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
                <Typography variant="subtitle-14-medium" color="primary" className="flex-1" numberOfLines={2}>
                  {friendNamesSummary}
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
                label={period === 'weekly' ? 'Starting Week' : 'Start Date'}
                minimumDate={today}
              />
              {period === 'weekly' && startDate.getDay() !== 1 && (
                <Typography variant="body-12" color="secondary" className="mt-1">
                  Will start on Monday {effectiveStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Typography>
              )}
            </View>

            {/* Creation Mode Selector */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              Challenge Length
            </Typography>
            <View className="flex-row gap-x-2 mb-4">
              {(['streak', 'until'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setCreationMode(mode)}
                  className={`flex-1 py-2.5 rounded-xl ${
                    creationMode === mode ? 'bg-[#E9A065]' : 'bg-light-border dark:bg-dark-border'
                  }`}
                >
                  <Typography
                    variant="body-14"
                    className={`text-center ${creationMode === mode ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
                  >
                    {mode === 'streak' ? 'Streak' : 'Until Date'}
                  </Typography>
                </Pressable>
              ))}
            </View>

            {/* Mode-specific picker */}
            {creationMode === 'streak' ? (
              <View className="bg-light-border/30 dark:bg-[#242540] rounded-xl px-4 py-3 items-center mb-6">
                <Typography variant="headline-20" color="primary" className="mb-1">
                  {streakCount} {periodLabel}
                </Typography>
                <Slider
                  value={streakCount}
                  minimumValue={period === 'daily' ? 2 : 1}
                  maximumValue={period === 'daily' ? 90 : 12}
                  step={1}
                  onValueChange={setStreakCount}
                  unit={periodLabel}
                />
              </View>
            ) : (
              <View className="mb-6">
                <DatePicker
                  value={untilDate}
                  onChange={setUntilDate}
                  label={period === 'weekly' ? 'Ending Week' : 'End Date'}
                  minimumDate={effectiveStartDate}
                />
                {period === 'weekly' && untilDate.getDay() !== 0 && (
                  <Typography variant="body-12" color="secondary" className="mt-1">
                    Will end on Sunday {snapToSunday(untilDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Typography>
                )}
              </View>
            )}

            {/* Computed End Date Info */}
            <View className="bg-[#E9A065]/10 rounded-xl px-4 py-3 mb-6">
              <Typography variant="body-12" color="secondary">
                All participants must focus with the &quot;{selectedTag?.name}&quot; tag for {formatDuration(targetHours)} per {period === 'daily' ? 'day' : 'week'}.
                {' '}Ends {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
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
