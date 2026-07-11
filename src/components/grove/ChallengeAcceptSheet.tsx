import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { colors } from '../../config/theme';
import { BottomSheet } from '../ui/BottomSheet';
import { showToast } from '../ui/Toast';
import { useAppStore } from '../../store';
import { tagMatchesChallenge } from '../../utils/challengeTag';
import { formatTarget } from './ChallengeCard';
import type { ChallengeItem } from '../../services/grove/GroveChallengeService';

const ACCENT = '#E9A065';
const DEFAULT_TAG_COLOR = '#6592E9';

type Mode = 'existing' | 'create';

interface ChallengeAcceptSheetProps {
  challenge: ChallengeItem | null;
  isVisible: boolean;
  onClose: () => void;
}

export const ChallengeAcceptSheet: React.FC<ChallengeAcceptSheetProps> = ({
  challenge,
  isVisible,
  onClose,
}) => {
  const tags = useAppStore((s) => s.focus.tags);
  const createTag = useAppStore((s) => s.focus.createTag);
  const acceptChallenge = useAppStore((s) => s.grove.acceptChallenge);

  const [mode, setMode] = useState<Mode>('create');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing tags whose name matches the challenge tag (trimmed, case-insensitive).
  const matchingTags = useMemo(() => {
    if (!challenge) return [];
    return tags.allIds
      .map((id) => tags.byId[id])
      .filter((t) => t && !t.deletedAt && tagMatchesChallenge(t.name, challenge.tagName));
  }, [challenge, tags]);

  const hasMatch = matchingTags.length > 0;

  // Reset state each time the sheet opens. Default to mapping an existing tag
  // when one matches; otherwise default to creating a new one.
  useEffect(() => {
    if (!isVisible || !challenge) return;
    setMode(hasMatch ? 'existing' : 'create');
    setSelectedTagId(hasMatch ? matchingTags[0].id : null);
    setIsSubmitting(false);
  }, [challenge?.id, isVisible]);

  if (!challenge) return null;

  const handleAccept = async () => {
    let tagId: string | null = null;

    if (mode === 'existing') {
      const tag = selectedTagId ? tags.byId[selectedTagId] : null;
      // Final guard: a mapped tag must still match the challenge's name.
      if (!tag || !tagMatchesChallenge(tag.name, challenge.tagName)) {
        showToast(`Tag must be named "${challenge.tagName}"`, 'error');
        return;
      }
      tagId = tag.id;
    } else {
      const newTag = createTag({
        name: challenge.tagName,
        icon: challenge.tagIcon,
        color: DEFAULT_TAG_COLOR,
      });
      tagId = newTag.id;
    }

    setIsSubmitting(true);
    try {
      await acceptChallenge(challenge.id, tagId);
      showToast('Challenge accepted!', 'success');
      onClose();
    } catch {
      showToast('Failed to accept challenge', 'error');
      setIsSubmitting(false);
    }
  };

  const canAccept = mode === 'create' || (mode === 'existing' && !!selectedTagId);

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} height={560}>
      {/* Header */}
      <View className="flex-row items-center mb-1">
        <Typography variant="body-14" className="mr-1.5">
          {challenge.tagIcon}
        </Typography>
        <Typography variant="headline-18" color="primary" className="flex-1" numberOfLines={1}>
          {challenge.tagName}
        </Typography>
      </View>
      <Typography variant="body-12" color="secondary" className="mb-4">
        {formatTarget(challenge.targetMinutes, challenge.period)} · pick the tag that tracks your progress
      </Typography>

      {/* Mode toggle */}
      <View className="flex-row gap-x-2 mb-4">
        <Pressable
          onPress={() => hasMatch && setMode('existing')}
          disabled={!hasMatch}
          className={`flex-1 py-2.5 rounded-xl ${mode === 'existing' ? '' : 'bg-light-border dark:bg-dark-border'}`}
          style={{ backgroundColor: mode === 'existing' ? ACCENT : undefined, opacity: hasMatch ? 1 : 0.4 }}
        >
          <Typography
            variant="body-14"
            className={`text-center ${mode === 'existing' ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
          >
            Use my tag
          </Typography>
        </Pressable>
        <Pressable
          onPress={() => setMode('create')}
          className={`flex-1 py-2.5 rounded-xl ${mode === 'create' ? '' : 'bg-light-border dark:bg-dark-border'}`}
          style={{ backgroundColor: mode === 'create' ? ACCENT : undefined }}
        >
          <Typography
            variant="body-14"
            className={`text-center ${mode === 'create' ? 'text-white' : 'text-light-text-primary dark:text-white'}`}
          >
            Create tag
          </Typography>
        </Pressable>
      </View>

      {/* Option (b): explain why "Use my tag" is unavailable */}
      {!hasMatch && (
        <View className="flex-row items-start bg-[#E9A065]/10 rounded-xl px-3 py-2.5 mb-4">
          <Ionicons name="information-circle-outline" size={16} color={ACCENT} style={{ marginTop: 1 }} />
          <Typography variant="body-12" color="secondary" className="ml-2 flex-1">
            You have no tag named &quot;{challenge.tagName}&quot;. Create one to join — it comes with a goal you
            can activate to track this challenge.
          </Typography>
        </View>
      )}

      {/* Existing tag picker */}
      {mode === 'existing' && (
        <View>
          {matchingTags.map((tag) => {
            const selected = tag.id === selectedTagId;
            return (
              <Pressable
                key={tag.id}
                onPress={() => setSelectedTagId(tag.id)}
                className="flex-row items-center py-3 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-xl bg-light-border/30 dark:bg-dark-card items-center justify-center mr-3">
                  <Typography variant="body-14">{tag.icon || ''}</Typography>
                </View>
                <Typography variant="subtitle-14-medium" color="primary" className="flex-1">
                  {tag.name}
                </Typography>
                <View
                  className="w-6 h-6 rounded-full border-2 items-center justify-center"
                  style={{
                    backgroundColor: selected ? ACCENT : 'transparent',
                    borderColor: selected ? ACCENT : colors.light.textSecondary,
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={14} color={colors.white} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Create tag preview */}
      {mode === 'create' && (
        <View className="flex-row items-center py-3">
          <View className="w-10 h-10 rounded-xl bg-light-border/30 dark:bg-dark-card items-center justify-center mr-3">
            <Typography variant="body-14">{challenge.tagIcon || ''}</Typography>
          </View>
          <View className="flex-1">
            <Typography variant="subtitle-14-medium" color="primary">
              {challenge.tagName}
            </Typography>
            <Typography variant="body-12" color="secondary">
              New tag · deactivated goal added
            </Typography>
          </View>
        </View>
      )}

      {/* Accept button */}
      <Button
        variant="ghost"
        size="large"
        fullWidth
        disabled={isSubmitting || !canAccept}
        className="rounded-2xl py-4 mt-4"
        style={{ backgroundColor: ACCENT }}
        onPress={handleAccept}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Typography variant="subtitle-16" style={{ color: colors.white }}>
            Accept Challenge
          </Typography>
        )}
      </Button>
    </BottomSheet>
  );
};
