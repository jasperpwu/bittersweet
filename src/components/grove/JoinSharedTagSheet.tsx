import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';
import { BottomSheet } from '../ui/BottomSheet';
import { showToast } from '../ui/Toast';
import { useAppStore } from '../../store';
import { tagMatchesChallenge } from '../../utils/challengeTag';
import type { SharedTagResolveResult } from '../../services/sharedTag/types';

const ACCENT = '#3B82F6';

type Mode = 'existing' | 'create';

interface JoinSharedTagSheetProps {
  resolved: SharedTagResolveResult | null;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Lets a joiner either map a shared tag onto one of their existing tags
 * (name must match the owner's tag, mirroring the challenge accept flow) or
 * clone a fresh tag. The owner→joiner link lives in shared_tag_memberships;
 * the resulting tag is a normal, fully-editable tag (weak link).
 */
export const JoinSharedTagSheet: React.FC<JoinSharedTagSheetProps> = ({
  resolved,
  isVisible,
  onClose,
}) => {
  const tags = useAppStore((s) => s.focus.tags);
  const joinSharedTag = useAppStore((s) => s.focus.joinSharedTag);

  const [mode, setMode] = useState<Mode>('create');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Existing tags whose name matches the shared tag (trimmed, case-insensitive).
  const matchingTags = useMemo(() => {
    if (!resolved) return [];
    return tags.allIds
      .map((id) => tags.byId[id])
      .filter(
        (t) =>
          t &&
          !t.deletedAt &&
          !t.sharedFromTagId && // not already a joined tag
          tagMatchesChallenge(t.name, resolved.tag_name)
      );
  }, [resolved, tags]);

  const hasMatch = matchingTags.length > 0;

  // Reset state each time the sheet opens. Default to mapping an existing tag
  // when one matches; otherwise default to creating a new one.
  useEffect(() => {
    if (!isVisible || !resolved) return;
    setMode(hasMatch ? 'existing' : 'create');
    setSelectedTagId(hasMatch ? matchingTags[0].id : null);
    setIsSubmitting(false);
  }, [resolved?.owner_tag_id, isVisible]);

  if (!resolved) return null;

  const handleJoin = async () => {
    let existingTagId: string | undefined;

    if (mode === 'existing') {
      const tag = selectedTagId ? tags.byId[selectedTagId] : null;
      // Final guard: a mapped tag must still match the shared tag's name.
      if (!tag || !tagMatchesChallenge(tag.name, resolved.tag_name)) {
        showToast(`Tag must be named "${resolved.tag_name}"`, 'error');
        return;
      }
      existingTagId = tag.id;
    }

    setIsSubmitting(true);
    try {
      await joinSharedTag(resolved, existingTagId);
      showToast('Tag added to your list', 'success');
      onClose();
    } catch (e: any) {
      showToast(e?.message || 'Failed to join shared tag', 'error');
      setIsSubmitting(false);
    }
  };

  const canJoin = mode === 'create' || (mode === 'existing' && !!selectedTagId);

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose} height={560}>
      {/* Header */}
      <View className="flex-row items-center mb-1">
        <Typography variant="body-14" className="mr-1.5">
          {resolved.tag_icon}
        </Typography>
        <Typography variant="headline-18" color="primary" className="flex-1" numberOfLines={1}>
          {resolved.tag_name}
        </Typography>
      </View>
      <Typography variant="body-12" color="secondary" className="mb-4">
        from {resolved.owner_display_name} · pick the tag that tracks your focus
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

      {/* Explain why "Use my tag" is unavailable */}
      {!hasMatch && (
        <View className="flex-row items-start bg-[#3B82F6]/10 rounded-xl px-3 py-2.5 mb-4">
          <Ionicons name="information-circle-outline" size={16} color={ACCENT} style={{ marginTop: 1 }} />
          <Typography variant="body-12" color="secondary" className="ml-2 flex-1">
            You have no tag named &quot;{resolved.tag_name}&quot;. Create one to join — you can edit, share, or
            delete it freely afterward.
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
                <View className="w-10 h-10 rounded-xl bg-light-border/30 dark:bg-[#2A2B45] items-center justify-center mr-3">
                  <Typography variant="body-14">{tag.icon || ''}</Typography>
                </View>
                <Typography variant="subtitle-14-medium" color="primary" className="flex-1">
                  {tag.name}
                </Typography>
                <View
                  className="w-6 h-6 rounded-full border-2 items-center justify-center"
                  style={{
                    backgroundColor: selected ? ACCENT : 'transparent',
                    borderColor: selected ? ACCENT : '#8A8A8A',
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Create tag preview */}
      {mode === 'create' && (
        <View className="flex-row items-center py-3">
          <View className="w-10 h-10 rounded-xl bg-light-border/30 dark:bg-[#2A2B45] items-center justify-center mr-3">
            <Typography variant="body-14">{resolved.tag_icon || ''}</Typography>
          </View>
          <View className="flex-1">
            <Typography variant="subtitle-14-medium" color="primary">
              {resolved.tag_name}
            </Typography>
            <Typography variant="body-12" color="secondary">
              New tag · deactivated goal added
            </Typography>
          </View>
        </View>
      )}

      {/* Join button */}
      <Pressable
        onPress={handleJoin}
        disabled={isSubmitting || !canJoin}
        className="rounded-2xl py-4 items-center mt-4 active:opacity-80"
        style={{ backgroundColor: ACCENT, opacity: isSubmitting || !canJoin ? 0.5 : 1 }}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Typography variant="subtitle-16" style={{ color: '#FFFFFF' }}>
            Join Tag
          </Typography>
        )}
      </Pressable>
    </BottomSheet>
  );
};
