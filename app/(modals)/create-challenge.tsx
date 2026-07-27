import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, SafeAreaView, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/config/theme';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { Slider } from '../../src/components/ui/Slider';
import { DatePicker } from '../../src/components/ui/DatePicker/DatePicker';
import { useAppStore } from '../../src/store';
import { showToast } from '../../src/components/ui/Toast';
import { useTranslation } from 'react-i18next';
import { AnalyticsTracker } from '../../src/services/analytics';

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
  const { t, i18n } = useTranslation();
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

  // Analytics: reaching this screen is the intent. Paired with
  // challenge_create_completed it measures drop-off across the 3-step wizard,
  // including the dead-end where the user has no friends to invite yet.
  useEffect(() => {
    AnalyticsTracker.track('challenge_create_attempted', { friend_count: friends.length });
    // Mount only — re-firing on friend-list refresh would inflate the funnel top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      showToast(t('createChallenge.sent'), 'success');
      router.back();
    } catch (error: any) {
      showToast(t('createChallenge.failedSend'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFriendIds, selectedTag, period, targetHours, effectiveStartDate, endDate, createChallenge]);

  const stepTitle = step === 'friend' ? t('createChallenge.titleFriends') : step === 'tag' ? t('createChallenge.titleTag') : t('createChallenge.titleConfig');

  const sliderConfig = SLIDER_CONFIG[period];

  const periodLabel = period === 'daily' ? t('challenge.daysUnit') : t('challenge.weeksUnit');

  /** Format selected friend names for summary display */
  const friendNamesSummary = useMemo(() => {
    if (selectedFriends.length === 0) return '';
    const names = selectedFriends.map(f => f.profile.display_name);
    if (names.length <= 3) return names.join(', ');
    return t('createChallenge.andOthers', { names: names.slice(0, 2).join(', '), count: names.length - 2 });
  }, [selectedFriends, t]);

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable
          onPress={handleBack}
          className="w-10 h-10 items-center justify-center -ml-2 active:opacity-60"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Typography variant="headline-18" color="primary" className="ml-2 flex-1">
          {stepTitle}
        </Typography>
        {step === 'friend' && selectedFriendIds.length > 0 && (
          <Typography variant="body-12" color="secondary">
            {t('createChallenge.selectedCount', { count: selectedFriendIds.length })}
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
                  {t('createChallenge.addFriendsFirst')}
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
                          isSelected ? '' : 'border-light-border dark:border-dark-border'
                        }`}
                        style={isSelected ? { backgroundColor: colors.challenge, borderColor: colors.challenge } : undefined}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={14} color={colors.white} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* Step 2: Tag picker */}
        {step === 'tag' && (
          <View>
            <View className="mb-4">
              <Typography variant="body-12" color="secondary">
                {t('createChallenge.pickTagDesc')}
              </Typography>
            </View>
            {activeTags.map((tag) => (
              <Pressable
                key={tag.id}
                onPress={() => handleSelectTag(tag.id)}
                className="flex-row items-center py-3 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-xl bg-light-border/30 dark:bg-dark-card items-center justify-center mr-3">
                  <Typography variant="body-14">{tag.icon || ''}</Typography>
                </View>
                <Typography variant="subtitle-14-medium" color="primary" className="flex-1">
                  {tag.name}
                </Typography>
                <Ionicons name="chevron-forward" size={18} color={colors.light.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Step 3: Config */}
        {step === 'config' && (
          <View>
            {/* Summary */}
            <View className="bg-light-border/30 dark:bg-dark-card rounded-2xl p-4 mb-6">
              <View className="flex-row items-center mb-2">
                <Typography variant="body-12" color="secondary" className="mr-1">
                  {t('createChallenge.challenging')}
                </Typography>
                <Typography variant="subtitle-14-medium" color="primary" className="flex-1" numberOfLines={2}>
                  {friendNamesSummary}
                </Typography>
              </View>
              <View className="flex-row items-center">
                <Typography variant="body-12" color="secondary" className="mr-1">
                  {t('createChallenge.tagColon')}
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
              {t('createChallenge.timePeriod')}
            </Typography>
            <View className="flex-row gap-x-2 mb-6">
              {(['daily', 'weekly'] as const).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => handlePeriodChange(p)}
                  className={`flex-1 py-2.5 rounded-xl ${
                    period === p ? '' : 'bg-light-border dark:bg-dark-border'
                  }`}
                  style={period === p ? { backgroundColor: colors.challenge } : undefined}
                >
                  <Typography
                    variant="body-14"
                    className={`text-center ${period === p ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
                  >
                    {p === 'daily' ? t('createChallenge.daily') : t('createChallenge.weekly')}
                  </Typography>
                </Pressable>
              ))}
            </View>

            {/* Target Duration Slider */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('createChallenge.targetDuration')}
            </Typography>
            <View className="bg-light-border/30 dark:bg-dark-card rounded-xl px-4 py-3 items-center mb-6">
              <Typography variant="headline-20" color="primary" className="mb-1">
                {formatDuration(targetHours)}/{period === 'daily' ? t('createChallenge.perDay') : t('createChallenge.perWeek')}
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
                label={period === 'weekly' ? t('createChallenge.startingWeek') : t('createChallenge.startDate')}
                minimumDate={today}
              />
              {period === 'weekly' && startDate.getDay() !== 1 && (
                <Typography variant="body-12" color="secondary" className="mt-1">
                  {t('createChallenge.startMonday', { date: effectiveStartDate.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) })}
                </Typography>
              )}
            </View>

            {/* Creation Mode Selector */}
            <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
              {t('createChallenge.challengeLength')}
            </Typography>
            <View className="flex-row gap-x-2 mb-4">
              {(['streak', 'until'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => setCreationMode(mode)}
                  className={`flex-1 py-2.5 rounded-xl ${
                    creationMode === mode ? '' : 'bg-light-border dark:bg-dark-border'
                  }`}
                  style={creationMode === mode ? { backgroundColor: colors.challenge } : undefined}
                >
                  <Typography
                    variant="body-14"
                    className={`text-center ${creationMode === mode ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
                  >
                    {mode === 'streak' ? t('createChallenge.streak') : t('createChallenge.untilDate')}
                  </Typography>
                </Pressable>
              ))}
            </View>

            {/* Mode-specific picker */}
            {creationMode === 'streak' ? (
              <View className="bg-light-border/30 dark:bg-dark-card rounded-xl px-4 py-3 items-center mb-6">
                <Typography variant="headline-20" color="primary" className="mb-1">
                  {streakCount} {periodLabel}
                </Typography>{/* periodLabel is localized days/weeks */}
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
                  label={period === 'weekly' ? t('createChallenge.endingWeek') : t('createChallenge.endDate')}
                  minimumDate={effectiveStartDate}
                />
                {period === 'weekly' && untilDate.getDay() !== 0 && (
                  <Typography variant="body-12" color="secondary" className="mt-1">
                    {t('createChallenge.endSunday', { date: snapToSunday(untilDate).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }) })}
                  </Typography>
                )}
              </View>
            )}

            {/* Computed End Date Info */}
            <View className="rounded-xl px-4 py-3 mb-6" style={{ backgroundColor: `${colors.challenge}1A` }}>
              <Typography variant="body-12" color="secondary">
                {t('createChallenge.summary', {
                  tag: selectedTag?.name,
                  duration: formatDuration(targetHours),
                  period: period === 'daily' ? t('createChallenge.perDay') : t('createChallenge.perWeek'),
                  date: endDate.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }),
                })}
              </Typography>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Pinned bottom CTA */}
      {(step === 'friend' && friends.length > 0) || step === 'config' ? (
        <View className="px-5 pt-2 pb-1">
          {step === 'friend' ? (
            <Button
              variant="ghost"
              size="large"
              fullWidth
              disabled={selectedFriendIds.length === 0}
              style={{ backgroundColor: colors.challenge }}
              onPress={handleFriendsNext}
            >
              <Typography variant="subtitle-16" style={{ color: colors.white }}>
                {t('common.next')}
              </Typography>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="large"
              fullWidth
              disabled={isSubmitting}
              style={{ backgroundColor: colors.challenge }}
              onPress={handleSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Typography variant="subtitle-16" style={{ color: colors.white }}>
                  {t('createChallenge.sendChallenge')}
                </Typography>
              )}
            </Button>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
