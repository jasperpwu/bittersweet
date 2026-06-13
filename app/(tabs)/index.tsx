import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, SafeAreaView, Pressable, Animated, Easing, Modal, Text, TextInput, ScrollView, AppState, KeyboardAvoidingView, Platform, Alert, LayoutChangeEvent, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Typography } from '../../src/components/ui';
import { EmojiPickerModal, EMOJI_CATEGORIES } from '../../src/components/ui/EmojiPicker/EmojiPicker';
import { TimeScroller, DurationPicker, TagColorPicker } from '../../src/components/focus';

import { useFocus, useFocusActions, useRewards, useAppStore, useBlocklist, useBlocklistActions, useBlocklistEditCost } from '../../src/store';
import { useAppSettings } from '../../src/store/unified-store';
import { CoachMark } from '../../src/components/ui/CoachMark/CoachMark';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { FruitCounter } from '../../src/components/rewards';
import { showToast } from '../../src/components/ui/Toast';
import { LiveActivityService } from '../../src/services/LiveActivityService';
import { WidgetService } from '../../src/services/WidgetService';
import { FamilyControlsModule } from '../../src/modules/BitterSweetFamilyControls';
import { blockSelection, stopMonitoring } from 'react-native-device-activity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { STORAGE_KEYS } from '../../src/config/constants';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { UpgradeSheet } from '../../src/components/subscription/UpgradeSheet';
import { UpgradePrompt } from '../../src/components/subscription/UpgradePrompt';
import { SwipeableTabWrapper } from '../../src/components/ui/SwipeableTabWrapper';
import { JoinSharedTagSheet } from '../../src/components/grove/JoinSharedTagSheet';
import type { SharedTagResolveResult } from '../../src/services/sharedTag/types';

const ACTIVE_SESSION_KEY = 'active-focus-session';

const ROW_HEIGHT = 84; // row height (72px) + margin-bottom (12px from mb-3)
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };

type DraggableTagRowProps = {
  tag: { id: string; name: string; icon?: string; color?: string; isSharing?: boolean; sharedFromTagId?: string; sharedOwnerName?: string };
  index: number;
  selectedTag: string | null;
  lastDuration: number;
  isDragging: boolean;
  dragOriginalIndex: number;
  dragTargetIndex: number;
  isChallenge?: boolean;
  onSelect: (id: string) => void;
  onEdit: (tag: any, event: any) => void;
  onDelete: (tag: any, event: any) => void;
  onUnlink?: (tag: any) => void;
  onShare?: (tag: any) => void;
  onSwipeOpen?: (ref: any) => void;
  onDragStart: (index: number) => void;
  onDragMove: (translationY: number) => void;
  onDragEnd: () => void;
};

function DraggableTagRow({
  tag, index, selectedTag, lastDuration, isDragging, dragOriginalIndex, dragTargetIndex,
  isChallenge, onSelect, onEdit, onDelete, onUnlink, onShare, onSwipeOpen, onDragStart, onDragMove, onDragEnd,
}: DraggableTagRowProps) {
  const colorScheme = useColorScheme();
  const isBeingDragged = isDragging && dragOriginalIndex === index;
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const displacement = useSharedValue(0);
  const gestureActive = useSharedValue(false);

  const swipeableRef = useRef<any>(null);
  const didSwipe = useRef(false);

  // Reset shared values when drag ends and array has reordered
  React.useEffect(() => {
    if (!isDragging) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      displacement.value = 0; // instant reset — array reorder handles final positions
    }
  }, [isDragging]);

  // Animate displacement for non-dragged items to make room
  React.useEffect(() => {
    if (!isDragging || isBeingDragged) {
      return;
    }

    const orig = dragOriginalIndex;
    const target = dragTargetIndex;
    let shift = 0;

    if (orig < target && index > orig && index <= target) {
      shift = -ROW_HEIGHT; // shift up to fill the gap
    } else if (orig > target && index >= target && index < orig) {
      shift = ROW_HEIGHT; // shift down to fill the gap
    }

    displacement.value = withSpring(shift, SPRING_CONFIG);
  }, [isDragging, isBeingDragged, dragOriginalIndex, dragTargetIndex, index]);

  const isSharedTag = !!tag.sharedFromTagId;
  // Joined shared tags are a weak link, not a guarded state: the owner→joiner
  // link lives server-side in shared_tag_memberships, so a joined tag stays a
  // normal, fully-editable/deletable/shareable/reorderable tag. Only synthetic
  // challenge rows (no real local tag yet) remain read-only.
  const isReadOnly = isChallenge;

  const panGesture = Gesture.Pan()
    .enabled(!isReadOnly)
    .activateAfterLongPress(250)
    .onStart(() => {
      gestureActive.value = true;
      scale.value = withSpring(1.03, SPRING_CONFIG);
      zIndex.value = 100;
      runOnJS(onDragStart)(index);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      runOnJS(onDragMove)(e.translationY);
    })
    .onEnd(() => {
      gestureActive.value = false;
      // Don't reset translateY here — let the useEffect handle it
      // after the array reorders, so the item doesn't snap back first
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      if (gestureActive.value) {
        // Gesture was cancelled (not ended normally) — reset everything
        translateY.value = withSpring(0, SPRING_CONFIG);
        gestureActive.value = false;
      }
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: isBeingDragged ? translateY.value : displacement.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const isSelected = selectedTag === tag.id;

  const handleRowPress = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onSelect(tag.id);
  };

  const renderRightActions = () => (
    <View className="flex-row items-center ml-2">
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onEdit(tag, null);
        }}
        className="rounded-lg w-16 h-full items-center justify-center mr-2"
        style={{ backgroundColor: 'rgba(200, 200, 200, 0.3)' }}
      >
        <Ionicons name="pencil-outline" size={16} color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'} />
        <Typography variant="tiny-10" color="secondary" className="mt-0.5">Edit</Typography>
      </Pressable>
      {onShare && (
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onShare(tag);
        }}
        className="rounded-lg w-16 h-full items-center justify-center mr-2"
        style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
      >
        <Ionicons name="share-outline" size={16} color="#3B82F6" />
        <Typography variant="tiny-10" style={{ color: '#3B82F6' }} className="mt-0.5">Share</Typography>
      </Pressable>
      )}
      {isSharedTag ? (
        // Joined tag: Unlink (non-destructive) keeps the tag + sessions and ends
        // the membership. Once unlinked it's a plain tag and Delete returns.
        <Pressable
          onPress={() => {
            swipeableRef.current?.close();
            onUnlink?.(tag);
          }}
          className="bg-red-500 rounded-lg w-16 h-full items-center justify-center"
        >
          <Ionicons name="unlink-outline" size={16} color="#FFFFFF" />
          <Typography variant="tiny-10" color="white" className="mt-0.5">Unlink</Typography>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            swipeableRef.current?.close();
            onDelete(tag, null);
          }}
          className="bg-red-500 rounded-lg w-16 h-full items-center justify-center"
        >
          <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
          <Typography variant="tiny-10" color="white" className="mt-0.5">Delete</Typography>
        </Pressable>
      )}
    </View>
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View
        className="mb-3"
        style={[
          animatedStyle,
          isBeingDragged && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 12,
          },
        ]}
      >
        <Swipeable
          ref={swipeableRef}
          renderRightActions={isReadOnly ? undefined : renderRightActions}
          overshootRight={false}
          onSwipeableWillOpen={() => {
            didSwipe.current = true;
            onSwipeOpen?.(swipeableRef.current);
          }}
          onSwipeableClose={() => {
            setTimeout(() => { didSwipe.current = false; }, 100);
          }}
        >
          <Pressable onPress={handleRowPress}>
            <View
              className={`rounded-2xl p-4 flex-row items-center ${isSelected ? 'bg-primary bg-opacity-20 border border-primary' : 'dark:bg-gray-700'}`}
              style={[
                {
                  borderLeftWidth: 4,
                  borderLeftColor: tag.color || '#6592E9',
                  // Opaque background so swipe-to-reveal buttons don't bleed through
                  ...(!isSelected ? { backgroundColor: colorScheme === 'dark' ? '#374151' : '#E8D9C4' } : {}),
                },
                isSelected && {
                  shadowColor: tag.color || '#6592E9',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  elevation: 8,
                  transform: [{ scale: 1.02 }],
                },
              ]}
            >
              <View className="w-10 h-10 items-center justify-center mr-3 rounded-lg bg-gray-600 border border-gray-500">
                <Text className="text-xl">{tag.icon || '\uD83C\uDFF7\uFE0F'}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Typography
                    variant="subtitle-16"
                    color="primary"
                    className={isSelected ? 'font-semibold' : ''}
                  >
                    {tag.name}
                  </Typography>
                  {isChallenge && (
                    <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(233, 160, 101, 0.2)' }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#E9A065' }}>Challenge</Text>
                    </View>
                  )}
                  {tag.isSharing && (
                    <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#3B82F6' }}>Sharing</Text>
                    </View>
                  )}
                  {isSharedTag && (
                    <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(20, 184, 166, 0.2)' }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: '#14B8A6' }}>Shared</Text>
                    </View>
                  )}
                </View>
                <Typography variant="body-12" color={isSelected ? 'primary' : 'secondary'} className="mt-1">
                  {isSharedTag && tag.sharedOwnerName
                    ? `from ${tag.sharedOwnerName} \u00B7 ${lastDuration === 0 ? '\u221E' : `${lastDuration} min`}`
                    : lastDuration === 0 ? '\u221E' : `${lastDuration} min`}
                </Typography>
              </View>
            </View>
          </Pressable>
        </Swipeable>
      </Reanimated.View>
    </GestureDetector>
  );
}

type PersistedSession = {
  startTime: number; // Unix ms
  endTime: number;   // Unix ms
  targetDuration: number; // minutes
  tagId: string;
  tagLabel?: string; // pre-built "icon name" label for Live Activity idle state
  isInfinite: boolean;
  liveActivityId?: string; // iOS Live Activity ID to stop after app restart
  notificationId?: string; // scheduled completion notification
};

// --- Share Tag Overlay (rendered inside tag selection modal) ---
function ShareTagOverlay({
  tag, onClose, onShareTag, onStopSharing,
}: {
  tag: any;
  onClose: () => void;
  onShareTag: (tagId: string) => Promise<string>;
  onStopSharing: (tagId: string) => Promise<void>;
}) {
  const colorScheme = useColorScheme();
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setShareCode(null);
    setCopied(false);
    // Auto-generate if already sharing
    if (tag?.isSharing) {
      handleGenerate();
    }
  }, [tag?.id]);

  const handleGenerate = async () => {
    if (!tag) return;
    setLoading(true);
    try {
      const code = await onShareTag(tag.id);
      setShareCode(code);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate share code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareCode) return;
    await Clipboard.setStringAsync(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStop = async () => {
    if (!tag) return;
    Alert.alert(
      'Stop Sharing?',
      'New users won\'t be able to join. Existing members keep their copies.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Sharing',
          style: 'destructive',
          onPress: async () => {
            try {
              await onStopSharing(tag.id);
              onClose();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to stop sharing');
            }
          },
        },
      ]
    );
  };

  return (
    <View className="absolute inset-0 bg-black/50 justify-center items-center p-4">
      <View className="bg-light-bg dark:bg-dark-bg rounded-2xl w-full max-w-xs overflow-hidden">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-light-border dark:border-gray-700">
          <Typography variant="headline-18" color="primary">
            {tag?.isSharing ? 'Sharing Tag' : 'Share Tag'}
          </Typography>
          <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-light-border/50 dark:bg-gray-700 items-center justify-center" hitSlop={8}>
            <Ionicons name="close" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'} />
          </Pressable>
        </View>

        <View className="p-4">
          {/* Tag preview */}
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 items-center justify-center mr-3 rounded-lg bg-gray-600 border border-gray-500">
              <Text className="text-xl">{tag?.icon || '\uD83C\uDFF7\uFE0F'}</Text>
            </View>
            <Typography variant="subtitle-16" color="primary">{tag?.name}</Typography>
          </View>

          {/* Show code if already sharing or just generated */}
          {(tag?.isSharing || shareCode) ? (
            <View>
              <Typography variant="body-14" color="secondary" className="mb-3">
                Share this code with others to let them join:
              </Typography>
              <View className="flex-row items-center justify-center bg-light-border/30 dark:bg-gray-700 rounded-xl py-4 mb-4">
                <Text style={{ fontSize: 28, fontWeight: '700', letterSpacing: 4, color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37' }}>
                  {shareCode || '...'}
                </Text>
              </View>

              <Pressable onPress={handleCopy} className="bg-blue-600 rounded-2xl py-3 items-center active:opacity-80 mb-3">
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  {copied ? 'Copied!' : 'Copy Code'}
                </Typography>
              </Pressable>

              <Pressable onPress={handleStop} className="rounded-2xl py-3 items-center active:opacity-80 border border-red-500">
                <Typography variant="subtitle-16" style={{ color: '#EF4444' }} className="font-semibold">
                  Stop Sharing
                </Typography>
              </Pressable>
            </View>
          ) : (
            <View>
              <Typography variant="body-14" color="secondary" className="mb-4">
                Generate a share code so others can join this tag and track their focus alongside you.
              </Typography>
              <Pressable onPress={handleGenerate} disabled={loading} className="bg-blue-600 rounded-2xl py-4 items-center active:opacity-80">
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  {loading ? 'Generating...' : 'Share This Tag'}
                </Typography>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// --- Join Tag Modal ---
// Step 1 of joining: collect + resolve the share code. On success it hands the
// resolved tag info up to the parent, which opens JoinSharedTagSheet (step 2:
// map onto an existing tag or clone a new one).
function JoinTagModal({
  visible, onClose, onResolve, onResolved,
}: {
  visible: boolean;
  onClose: () => void;
  onResolve: (code: string) => Promise<SharedTagResolveResult>;
  onResolved: (result: SharedTagResolveResult) => void;
}) {
  const colorScheme = useColorScheme();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
    }
  }, [visible]);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onResolve(code.trim());
      onResolved(result);
    } catch (e: any) {
      setError(e.message || 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
          <View className="bg-light-bg dark:bg-dark-bg rounded-3xl w-full max-w-sm overflow-hidden">
            <View className="flex-row items-center justify-between p-6 border-b border-light-border dark:border-gray-700">
              <Typography variant="headline-20" color="primary">
                Join Shared Tag
              </Typography>
              <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-light-border/50 dark:bg-gray-700 items-center justify-center" hitSlop={8}>
                <Ionicons name="close" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'} />
              </Pressable>
            </View>

            <View className="p-6">
              <Typography variant="body-14" color="secondary" className="mb-4">
                Enter the share code to join a tag from another user.
              </Typography>

              <TextInput
                value={code}
                onChangeText={(t) => { setCode(t.toUpperCase()); setError(null); }}
                placeholder="Enter code"
                placeholderTextColor={colorScheme === 'dark' ? '#888' : '#AAA'}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                className="bg-light-border/30 dark:bg-gray-700 rounded-xl px-4 py-4 text-center text-light-text-primary dark:text-dark-text-primary mb-4"
                style={{ fontSize: 24, fontWeight: '700', letterSpacing: 4 }}
              />

              {error && (
                <Typography variant="body-12" style={{ color: '#EF4444' }} className="mb-3 text-center">
                  {error}
                </Typography>
              )}

              <Pressable
                onPress={handleJoin}
                disabled={loading || code.trim().length < 4}
                className={`rounded-2xl py-4 items-center active:opacity-80 ${code.trim().length >= 4 ? 'bg-blue-600' : 'bg-gray-400'}`}
              >
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  {loading ? 'Joining...' : 'Join'}
                </Typography>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FocusScreen() {
  const colorScheme = useColorScheme();
  // Get tags from store
  const { tags, sessions, lastSelectedTagId, lastDurationByTagId, goals } = useFocus();
  const { createTag, updateTag, deleteTag, reorderTags, startSession, completeSession, createCompletedSession, setLastSelectedTagId, setLastDurationForTag, shareTag, stopSharingTag, resolveSharedTagCode, leaveSharedTag } = useFocusActions();
  const rewards = useRewards();
  const { settings: blocklistSettings, activeSessions } = useBlocklist();
  const { checkAuthorizationStatus, requestAuthorization } = useBlocklistActions();
  const { currentSession } = useFocus();
  const blocklistEditCost = useBlocklistEditCost();
  const { triggerHaptic } = useDeviceIntegration();
  const { preferences, updatePreferences } = useAppSettings();
  const timerPickerStyle = preferences.focus.timerPickerStyle ?? 'scroller';
  const { canCreateTag } = useSubscriptionGate();
  const challenges = useAppStore((s) => s.grove.challenges);
  const availableTags = tags.allIds.map(id => tags.byId[id]).filter(Boolean).filter(t => !t.deletedAt);

  // Build challenge-only tags from active challenges (both incoming and outgoing)
  const challengeTags = React.useMemo(() => {
    const userTagIds = new Set(availableTags.map(t => t.id));
    const seen = new Set<string>();
    return challenges
      .filter(c => c.status === 'active' || c.status === 'pending')
      .filter(c => {
        if (userTagIds.has(c.tagId)) return false; // user already has this tag
        if (seen.has(c.tagId)) return false; // dedup by tagId
        seen.add(c.tagId);
        return true;
      })
      .map(c => ({
        id: c.tagId,
        name: c.tagName,
        icon: c.tagIcon,
        color: '#E9A065',
        isChallenge: true as const,
      }));
  }, [challenges, availableTags]);
  
  const [selectedTime, setSelectedTime] = useState(15); // minutes; 0 => ∞
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Restore last selected tag or fall back to first available tag
  useEffect(() => {
    if (availableTags.length > 0 && !selectedTag) {
      const lastTagExists = lastSelectedTagId && tags.byId[lastSelectedTagId];
      const restoredTagId = lastTagExists ? lastSelectedTagId : availableTags[0].id;
      setSelectedTag(restoredTagId);
      // Restore last used duration for this tag (default 15 min)
      setSelectedTime(lastDurationByTagId[restoredTagId] ?? 15);
    }
  }, [availableTags, selectedTag]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6592E9');
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTag, setEditingTag] = useState<{ id: string; name: string; icon: string; color: string } | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagEmoji, setEditTagEmoji] = useState('');
  const [editTagColor, setEditTagColor] = useState('#6592E9');
  const [showEditEmojiGrid, setShowEditEmojiGrid] = useState(false);
  // Resolved shared tag awaiting the map-or-clone choice (step 2 of joining)
  const [resolvedSharedTag, setResolvedSharedTag] = useState<SharedTagResolveResult | null>(null);

  // Delete functionality
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<any>(null);

  // Shared tag modals
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingTag, setSharingTag] = useState<any>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Drag-to-reorder state
  const [dragOrderIds, setDragOrderIds] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOriginalIdx, setDragOriginalIdx] = useState(-1);
  const [dragTargetIdx, setDragTargetIdx] = useState(-1);
  const dragOriginalIdxRef = useRef(-1);
  const dragTargetIdxRef = useRef(-1);

  // Tag swipe coach mark
  const firstTagRef = useRef<View>(null);
  const [showTagSwipeCoachMark, setShowTagSwipeCoachMark] = useState(false);

  // Swipe-to-reveal: track open swipeable to close others
  const openSwipeableRef = useRef<any>(null);
  const handleSwipeOpen = useCallback((ref: any) => {
    if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = ref;
  }, []);

  // Sync dragOrderIds with store when modal opens
  useEffect(() => {
    if (showTagModal) {
      setDragOrderIds(tags.allIds);
      // Show tag swipe coach mark after a short delay
      if (availableTags.length >= 2 && !preferences.hasSeenTagSwipeHint) {
        setTimeout(() => setShowTagSwipeCoachMark(true), 500);
      }
    } else {
      setShowTagSwipeCoachMark(false);
    }
  }, [showTagModal, tags.allIds]);

  const dragOrderRef = useRef<string[]>([]);
  dragOrderRef.current = dragOrderIds;

  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDragOriginalIdx(index);
    setDragTargetIdx(index);
    dragOriginalIdxRef.current = index;
    dragTargetIdxRef.current = index;
  }, []);

  const handleDragMove = useCallback((translationY: number) => {
    const origIdx = dragOriginalIdxRef.current;
    const total = dragOrderRef.current.length;
    const offset = Math.round(translationY / ROW_HEIGHT);
    const newTarget = Math.max(0, Math.min(total - 1, origIdx + offset));

    if (newTarget !== dragTargetIdxRef.current) {
      dragTargetIdxRef.current = newTarget;
      setDragTargetIdx(newTarget);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    const orig = dragOriginalIdxRef.current;
    const target = dragTargetIdxRef.current;

    if (orig !== target && orig >= 0 && target >= 0) {
      const newOrder = [...dragOrderRef.current];
      const [moved] = newOrder.splice(orig, 1);
      newOrder.splice(target, 0, moved);
      setDragOrderIds(newOrder);
      reorderTags(newOrder);
    }

    setIsDragging(false);
    setDragOriginalIdx(-1);
    setDragTargetIdx(-1);
    dragOriginalIdxRef.current = -1;
    dragTargetIdxRef.current = -1;
  }, [reorderTags]);

  const orderedTags = [
    ...dragOrderIds.map(id => tags.byId[id]).filter(t => t && !t.deletedAt),
    ...challengeTags,
  ];

  // Blocklist tip modal
  const [showBlocklistTip, setShowBlocklistTip] = useState(false);
  const [showEditCostModal, setShowEditCostModal] = useState(false);
  const blocklistTipAcknowledgedRef = useRef<boolean | null>(null);

  // Session + timer state
  const [isSessionActive, setIsSessionActive] = useState(false); // true during transition or running
  const [isRunning, setIsRunning] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [unlockRemainingSeconds, setUnlockRemainingSeconds] = useState(0);
  const [isBonusTime, setIsBonusTime] = useState(false);
  const [bonusSeconds, setBonusSeconds] = useState(0);
  // Refs to capture session state at stop time (before state resets) for saveSessionAndNavigate
  const stoppedInBonusRef = useRef(false);
  const stoppedBonusSecondsRef = useRef(0);
  const stoppedSessionStartTimeRef = useRef<number | null>(null);
  const stoppedSessionTargetDurationRef = useRef<number | null>(null);
  const liveActivityIdRef = useRef<string | undefined>(undefined);
  const sessionEndTimeRef = useRef<number | null>(null); // Unix ms when session should end
  const sessionStartTimeRef = useRef<number | null>(null); // Unix ms when session started
  const sessionTargetDurationRef = useRef<number | null>(null); // target duration in minutes, immune to state races
  const scheduledNotificationRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionCancelledRef = useRef(false);
  // Refs to keep current values accessible in the AppState handler (which has [] deps)
  const selectedTimeRef = useRef(selectedTime);
  const selectedTagRef = useRef(selectedTag);
  selectedTimeRef.current = selectedTime;
  selectedTagRef.current = selectedTag;

  // Animation refs
  const scrollerOpacity = useRef(new Animated.Value(1)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(0.94)).current;
  const timerTranslateY = useRef(new Animated.Value(6)).current;
  const tagsOpacity = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;

  // Blocklist helpers
  const getBlockedCount = () => {
    const totalApps = blocklistSettings.blockedApps.applicationTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    const totalCategories = blocklistSettings.blockedApps.categoryTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    const totalDomains = blocklistSettings.blockedApps.webDomainTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    return Number(totalApps) + Number(totalCategories) + Number(totalDomains);
  };
  const blockedCount = getBlockedCount();
  const activeUnlockSession = activeSessions.allIds
    .map(id => activeSessions.byId[id])
    .filter(session => session?.isActive)
    .sort((a, b) => {
      const aEnd = a.endTime instanceof Date ? a.endTime.getTime() : new Date(a.endTime).getTime();
      const bEnd = b.endTime instanceof Date ? b.endTime.getTime() : new Date(b.endTime).getTime();
      return bEnd - aEnd;
    })[0] || null;
  const activeUnlockEndTimeMs = activeUnlockSession
    ? activeUnlockSession.endTime instanceof Date
      ? activeUnlockSession.endTime.getTime()
      : new Date(activeUnlockSession.endTime).getTime()
    : null;
  const isUnlockActive = !!activeUnlockSession && !isSessionActive;

  const proceedToBlockList = async () => {
    const authorized = await checkAuthorizationStatus();
    if (!authorized) {
      const granted = await requestAuthorization();
      if (granted) {
        await checkAuthorizationStatus();
        router.push('/(modals)/app-selection');
      } else {
        Alert.alert(
          'Authorization Required',
          'Family Controls permission is required to use app blocking features. Please enable it in Settings.',
          [{ text: 'OK' }]
        );
      }
    } else {
      router.push('/(modals)/app-selection');
    }
  };

  const handleBlockList = async () => {
    triggerHaptic('light');

    if (currentSession.session !== null) {
      Alert.alert(
        'Blocklist Locked',
        'You cannot edit the blocklist during a focus session. Complete your session first.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if tip has been acknowledged
    if (blocklistTipAcknowledgedRef.current === null) {
      const acknowledged = await AsyncStorage.getItem(STORAGE_KEYS.blocklistTipAcknowledged);
      blocklistTipAcknowledgedRef.current = acknowledged === 'true';
    }

    // Skip tip if user already has a blocklist (e.g. restored from cloud after sign-in)
    const store = useAppStore.getState();
    if (!blocklistTipAcknowledgedRef.current && store.blocklist.currentSelectionId === null) {
      setShowBlocklistTip(true);
      return;
    }

    // If blocklist already set up, show edit cost modal before proceeding
    if (store.blocklist.currentSelectionId !== null) {
      setShowEditCostModal(true);
      return;
    }

    await proceedToBlockList();
  };

  const handleBlocklistTipUnderstood = async () => {
    setShowBlocklistTip(false);
    blocklistTipAcknowledgedRef.current = true;
    await AsyncStorage.setItem(STORAGE_KEYS.blocklistTipAcknowledged, 'true');

    // If blocklist already set up, show edit cost modal before proceeding
    const store = useAppStore.getState();
    if (store.blocklist.currentSelectionId !== null) {
      setShowEditCostModal(true);
      return;
    }

    await proceedToBlockList();
  };

  const handleTagSelect = (tagId: string) => {
    setSelectedTag(tagId);
    setLastSelectedTagId(tagId);
    // Sync to small widget so it shows the newly selected tag
    WidgetService.syncSelectedTagId(tagId);
    // Restore last used duration for this tag (default 15 min)
    const duration = lastDurationByTagId[tagId] ?? 15;
    setSelectedTime(duration);
    // Update any idle Live Activity with the newly selected tag/duration
    if (!isRunning) {
      const tag = tags.byId[tagId] || challengeTags.find(ct => ct.id === tagId);
      const tagLabel = tag ? `${tag.icon || '🎯'} ${tag.name}` : 'Focus';
      LiveActivityService.showIdleFocusActivity(tagLabel, tagId, duration);
    }
    setShowTagModal(false);
  };

  const handleNewTagEmojiPress = () => {
    setShowNewTagModal(false);
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewTagEmoji(emoji);
    setShowEmojiPicker(false);
    setShowNewTagModal(true);
  };

  const handleCreateNewTag = () => {
    if (!canCreateTag) {
      setShowNewTagModal(false);
      setShowUpgradePrompt(true);
      return;
    }
    if (newTagName.trim() && newTagEmoji) {
      // Create tag using store action — returns the created tag with its ID
      const newTag = createTag({
        name: newTagName.trim(),
        icon: newTagEmoji,
        color: newTagColor,
      });

      setSelectedTag(newTag.id);
      setLastSelectedTagId(newTag.id);
      WidgetService.syncSelectedTagId(newTag.id);
      setShowNewTagModal(false);
      setNewTagName('');
      setNewTagEmoji('');
      setNewTagColor('#6592E9');
    }
  };
  
  const handleEditTag = (tag: any, event: any) => {
    event?.stopPropagation();
    setEditingTag({ id: tag.id, name: tag.name, icon: tag.icon, color: tag.color });
    setEditTagName(tag.name);
    setEditTagEmoji(tag.icon || '');
    setEditTagColor(tag.color || '#6592E9');
    setShowEditTagModal(true);
    // Keep tag modal open - edit appears as overlay within it
  };

  const handleEditTagEmojiPress = () => {
    setShowEditEmojiGrid(prev => !prev);
  };

  const handleSaveEditTag = () => {
    if (editingTag && editTagName.trim()) {
      const updates: any = {};
      if (editTagName.trim() !== editingTag.name) updates.name = editTagName.trim();
      if (editTagEmoji !== editingTag.icon) updates.icon = editTagEmoji;
      if (editTagColor !== editingTag.color) updates.color = editTagColor;
      if (Object.keys(updates).length > 0) {
        updateTag(editingTag.id, updates);
      }
      setShowEditTagModal(false);
      setEditingTag(null);
      setShowEditEmojiGrid(false);
      // Tag modal remains open
    }
  };

  const tagHasActiveGoal = (tagId: string) =>
    goals.allIds.some(gid => {
      const goal = goals.byId[gid];
      return goal && goal.tagId === tagId && goal.isActive;
    });

  // A tag is locked from deletion while it is tied to a non-terminal challenge
  // (pending or active — i.e. ongoing or upcoming). `challenge.tagId` resolves to
  // the current user's own participant tag, so this guards both the challenger and
  // the challengee. Terminal challenges (completed/failed/cancelled/declined) don't block.
  const tagHasOngoingChallenge = (tagId: string) =>
    challenges.some(c => c.tagId === tagId && (c.status === 'active' || c.status === 'pending'));

  // Returns a human-readable reason the tag can't be deleted, or null if it can.
  const tagDeletionBlockReason = (tag: { id: string; name: string } | null): string | null => {
    if (!tag) return null;
    const hasGoal = tagHasActiveGoal(tag.id);
    const hasChallenge = tagHasOngoingChallenge(tag.id);
    if (hasGoal && hasChallenge) {
      return `"${tag.name}" has an active goal and is part of an ongoing or upcoming challenge. Conclude or deactivate the goal and wait for the challenge to finish before deleting.`;
    }
    if (hasGoal) {
      return `"${tag.name}" has an active goal. Please conclude or deactivate the goal first before deleting.`;
    }
    if (hasChallenge) {
      return `"${tag.name}" is part of an ongoing or upcoming challenge. The challenge must finish before you can delete this tag.`;
    }
    return null;
  };

  const handleDeleteTag = (tag: any, event: any) => {
    event?.stopPropagation(); // Prevent tag selection when clicking delete
    setTagToDelete(tag);
    setShowDeleteModal(true);
    // Keep tag modal open - don't call setShowTagModal(false)
  };

  const handleConfirmDelete = () => {
    if (tagToDelete) {
      deleteTag(tagToDelete.id);
      // If deleted tag was selected, reset selection
      if (selectedTag === tagToDelete.id) {
        const remainingTags = availableTags.filter(t => t.id !== tagToDelete.id);
        const fallbackId = remainingTags.length > 0 ? remainingTags[0].id : null;
        setSelectedTag(fallbackId);
        setLastSelectedTagId(fallbackId);
        WidgetService.syncSelectedTagId(fallbackId);
      }
      setShowDeleteModal(false);
      setTagToDelete(null);
      // Tag modal remains open after deletion
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setTagToDelete(null);
    // Tag modal remains open
  };

  const handleShareTag = (tag: any) => {
    setSharingTag(tag);
    setShowShareModal(true);
  };

  // Joiner unlinks from a shared tag: ends the membership but keeps the tag and
  // its sessions. After unlinking it becomes a plain tag (Delete returns).
  const handleUnlinkTag = (tag: any) => {
    Alert.alert(
      'Unlink shared tag?',
      `You'll stop sharing progress with ${tag.sharedOwnerName ?? 'the owner'}. Your "${tag.name}" tag and its sessions stay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveSharedTag(tag.id);
              showToast('Unlinked from shared tag', 'success');
            } catch (e: any) {
              showToast(e?.message || 'Failed to unlink', 'error');
            }
          },
        },
      ]
    );
  };

  const stopUnlockSession = (sessionId: string, refundUnusedTime: boolean) => {
    const store = useAppStore.getState();
    const session = store.blocklist.activeSessions.byId[sessionId];
    if (!session?.isActive) return;

    const nowMs = Date.now();
    const endTimeMs = session.endTime instanceof Date ? session.endTime.getTime() : new Date(session.endTime).getTime();
    const remainingMs = Math.max(0, endTimeMs - nowMs);
    const remainingMinutes = Math.floor(remainingMs / (60 * 1000));
    const refundAmount = Math.min(
      session.cost,
      remainingMinutes * store.blocklist.settings.unlockCostPerMinute
    );

    if (refundUnusedTime && refundAmount > 0) {
      store.rewards.earnFruits(refundAmount, 'unlock_refund', {
        sessionId,
        refundedMinutes: remainingMinutes,
      });
      console.log(`🍎 Refunded ${refundAmount} fruits for ${remainingMinutes} unused unlock minute(s)`);
    }

    if (store.blocklist.currentSelectionId) {
      blockSelection({ activitySelectionId: store.blocklist.currentSelectionId });
      try { stopMonitoring([`reblock-${store.blocklist.currentSelectionId}`]); } catch { /* ignore */ }
    }

    store.blocklist.endUnlock(sessionId, refundUnusedTime ? 'manual' : 'expired');

    // Clear unlock state on home screen widget
    WidgetService.syncUnlockSessionState(null);
  };

  const handleStopUnlock = () => {
    if (!activeUnlockSession) return;
    triggerHaptic('light');
    stopUnlockSession(activeUnlockSession.id, true);
    showToast('Unlock stopped', 'neutral');
  };

  const startTimer = () => {
    // Signal focusing status to friends
    useAppStore.getState().grove.setFocusing(true);

    // End any active unlock sessions — re-block apps and refund remaining time
    const store = useAppStore.getState();
    const { activeSessions } = store.blocklist;
    activeSessions.allIds.forEach(id => {
      const session = activeSessions.byId[id];
      if (!session?.isActive) return;
      stopUnlockSession(id, true);
      console.log('🔒 Ended unlock session for focus start:', id);
    });

    // Dev-only: -1 means 5-second test timer
    const isDevTimer = selectedTime === -1;
    const timerSeconds = isDevTimer ? 5 : selectedTime * 60;
    const infinite = selectedTime === 0;
    setIsInfinite(infinite);
    setIsRunning(true);

    const now = Date.now();
    sessionStartTimeRef.current = now;
    sessionTargetDurationRef.current = isDevTimer ? 1 : selectedTime;

    if (infinite) {
      setElapsedSeconds(0);
    } else {
      setRemainingSeconds(timerSeconds);
    }

    // Start Live Activity for the focus timer (service will reuse existing
    // activity if one is still around, ensuring at most one is shown)
    let liveActivityId: string | undefined;

    // Store tag info for later idle state (when session ends, LA transitions to idle)
    const selectedTagObj = selectedTag ? (tags.byId[selectedTag] || challengeTags.find(ct => ct.id === selectedTag)) : undefined;
    const selectedTagLabel = selectedTagObj ? `${selectedTagObj.icon || '🎯'} ${selectedTagObj.name}` : 'Focus';
    LiveActivityService.setLastTag(selectedTag || undefined, selectedTagLabel, isDevTimer ? 1 : selectedTime);

    if (infinite) {
      // Infinite mode: no end time — use a count-up live activity
      sessionEndTimeRef.current = null;
      const activityId = LiveActivityService.startFocusTimerInfinite(
        new Date(),
        selectedTagLabel
      );
      if (activityId) {
        liveActivityId = activityId;
        liveActivityIdRef.current = activityId;
        console.log('🎬 Live Activity started for infinite focus session:', activityId);
      } else {
        console.log('⚠️ Live Activity was not created (may not be available on this device)');
      }
    } else {
      const endTime = new Date(Date.now() + timerSeconds * 1000);
      sessionEndTimeRef.current = endTime.getTime();
      const activityId = LiveActivityService.startFocusTimer(
        endTime,
        isDevTimer ? 1 : selectedTime,
        selectedTagLabel
      );
      if (activityId) {
        liveActivityId = activityId;
        liveActivityIdRef.current = activityId;
        console.log('🎬 Live Activity started for focus session:', activityId);
      } else {
        console.log('⚠️ Live Activity was not created (may not be available on this device)');
      }
    }

    // Schedule a notification with sound for when the timer ends
    if (selectedTime > 0 || isDevTimer) {
      // Cancel any existing scheduled notification
      if (scheduledNotificationRef.current) {
        Notifications.cancelScheduledNotificationAsync(scheduledNotificationRef.current);
      }
      Notifications.scheduleNotificationAsync({
        content: {
          title: 'Focus Session Complete',
          body: isDevTimer
            ? `Your 5s dev test session is done!`
            : `Your ${selectedTime}m ${selectedTag ? tags.byId[selectedTag]?.name || 'focus' : 'focus'} session is done!`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: timerSeconds,
        },
      }).then(id => {
        scheduledNotificationRef.current = id;
        // Sync to shared UserDefaults so native StopSessionIntent can cancel it
        WidgetService.syncScheduledNotificationId(id);
        // Update persisted session with notification ID so it can be cancelled after app restart
        AsyncStorage.getItem(ACTIVE_SESSION_KEY).then(raw => {
          if (raw) {
            const persisted = JSON.parse(raw);
            persisted.notificationId = id;
            AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(persisted));
          }
        });
      });
    }

    // Update shield to block unlocking during focus session
    const currentBalance = useAppStore.getState().rewards.balance;
    FamilyControlsModule.updateShieldBalance(currentBalance, true).catch((error) => {
      console.error('Failed to update shield for focus session start:', error);
    });

    // Persist active session so it survives app kills
    const persistNow = Date.now();
    AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
      startTime: persistNow,
      endTime: infinite ? 0 : persistNow + timerSeconds * 1000,
      targetDuration: isDevTimer ? 1 : selectedTime,
      tagId: selectedTag || 'Focus',
      tagLabel: selectedTagLabel,
      isInfinite: infinite,
      liveActivityId,
    } satisfies PersistedSession));

    // Sync widget with active session state
    const tagInfo = selectedTag ? tags.byId[selectedTag] : null;
    WidgetService.syncSessionState({
      isActive: true,
      tagName: tagInfo?.name || 'Focus',
      tagIcon: tagInfo?.icon || '🎯',
      tagColor: tagInfo?.color || '#8B4513',
      startTime: persistNow,
      endTime: infinite ? 0 : persistNow + timerSeconds * 1000,
      isInfinite: infinite,
    });

    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => {
      if (infinite) {
        setElapsedSeconds(prev => prev + 1);
      } else {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            // Timer reached 0 — enter bonus time mode instead of stopping
            if (timerRef.current) clearInterval(timerRef.current as any);
            timerRef.current = null;
            setIsBonusTime(true);
            setBonusSeconds(0);

            // Start a new interval that counts UP for bonus time
            timerRef.current = setInterval(() => {
              setBonusSeconds(b => b + 1);
            }, 1000);

            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
  };

  const stopCompletely = () => {
    // Clear focusing status
    useAppStore.getState().grove.setFocusing(false);

    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;
    sessionStartTimeRef.current = null;
    sessionTargetDurationRef.current = null;
    setIsRunning(false);
    setIsSessionActive(false);
    setIsBonusTime(false);
    setBonusSeconds(0);
    AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

    // Restore normal shield (allow unlocking again)
    const currentBalance = useAppStore.getState().rewards.balance;
    FamilyControlsModule.updateShieldBalance(currentBalance, false).catch((error) => {
      console.error('Failed to restore shield after focus session stop:', error);
    });

    // Clear widget session state
    WidgetService.syncSessionState(null);
  };

  // Shared teardown logic for stopping a focus session.
  // Clears timer, resets running state, removes persisted session,
  // restores shield, clears widget state, cancels notification,
  // and returns the Live Activity ID so the caller can stop it.
  const teardownSession = () => {
    // Clear focusing status
    useAppStore.getState().grove.setFocusing(false);

    // Clear timer
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;

    // Reset running state
    setIsRunning(false);
    setIsBonusTime(false);
    setBonusSeconds(0);

    // Clear persisted session
    AsyncStorage.removeItem(ACTIVE_SESSION_KEY);

    // Restore normal shield (allow unlocking again)
    const currentBalance = useAppStore.getState().rewards.balance;
    FamilyControlsModule.updateShieldBalance(currentBalance, false).catch((error) => {
      console.error('Failed to restore shield after focus session stop:', error);
    });

    // Clear widget session state
    WidgetService.syncSessionState(null);

    // Clear session refs and capture Live Activity ID for caller
    sessionEndTimeRef.current = null;
    sessionStartTimeRef.current = null;
    sessionTargetDurationRef.current = null;
    const activityId = liveActivityIdRef.current;
    liveActivityIdRef.current = undefined;

    // Cancel the scheduled completion notification
    if (scheduledNotificationRef.current) {
      Notifications.cancelScheduledNotificationAsync(scheduledNotificationRef.current);
      scheduledNotificationRef.current = null;
    }
    // Clear from shared UserDefaults (native may have already cancelled it)
    WidgetService.syncScheduledNotificationId(null);

    return activityId;
  };

  const stopWithAnimation = () => {
    const wasBonusTime = isBonusTime;
    // Capture session info for saveSessionAndNavigate (called later from animation callback)
    stoppedInBonusRef.current = isBonusTime;
    stoppedBonusSecondsRef.current = bonusSeconds;
    stoppedSessionStartTimeRef.current = sessionStartTimeRef.current;
    stoppedSessionTargetDurationRef.current = sessionTargetDurationRef.current;

    const activityId = teardownSession();
    if (activityId) {
      LiveActivityService.stopFocusTimer(activityId, wasBonusTime ? 'completed' : 'cancelled');
    }

    Animated.parallel([
      Animated.timing(timerOpacity, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(timerScale, { toValue: 0.96, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(timerTranslateY, { toValue: 6, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(scrollerOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagsOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(headerOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setIsSessionActive(false);
        // Go straight to session summary
        saveSessionAndNavigate();
      });
    });
  };

  // Sync timer when app returns to foreground (JS timers are suspended in background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        const now = Date.now();

        // Timed session: recalculate remaining time from the stored end time
        if (sessionEndTimeRef.current) {
          if (now >= sessionEndTimeRef.current) {
            // Session expired while in background — enter bonus time mode
            if (timerRef.current) clearInterval(timerRef.current as any);
            timerRef.current = null;
            setRemainingSeconds(0);

            const bonus = Math.floor((now - sessionEndTimeRef.current) / 1000);
            setIsBonusTime(true);
            setBonusSeconds(bonus);

            // Start bonus count-up interval
            timerRef.current = setInterval(() => {
              setBonusSeconds(b => b + 1);
            }, 1000);
          } else {
            // Session still running — sync remaining seconds with real clock
            // Use Math.floor to match SwiftUI's Text(date, style: .timer) truncation
            const remaining = Math.max(0, Math.floor((sessionEndTimeRef.current - now) / 1000));
            setRemainingSeconds(remaining);
          }
        }

        // Infinite session: recalculate elapsed time from the stored start time
        if (sessionStartTimeRef.current) {
          const elapsed = Math.floor((now - sessionStartTimeRef.current) / 1000);
          setElapsedSeconds(elapsed);
        }

        // Adopt widget start/stop + recover session in one sequential flow
        adoptAndRecoverSession();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (unlockTimerRef.current) {
      clearInterval(unlockTimerRef.current as any);
      unlockTimerRef.current = null;
    }

    if (!activeUnlockSession?.isActive || !activeUnlockEndTimeMs) {
      setUnlockRemainingSeconds(0);
      return;
    }

    const syncUnlockRemaining = () => {
      const remaining = Math.max(0, Math.ceil((activeUnlockEndTimeMs - Date.now()) / 1000));
      setUnlockRemainingSeconds(remaining);

      if (remaining === 0 && unlockTimerRef.current) {
        clearInterval(unlockTimerRef.current as any);
        unlockTimerRef.current = null;
        useAppStore.getState().blocklist.checkActiveUnlocks();
      }
    };

    syncUnlockRemaining();
    unlockTimerRef.current = setInterval(syncUnlockRemaining, 1000);

    return () => {
      if (unlockTimerRef.current) {
        clearInterval(unlockTimerRef.current as any);
        unlockTimerRef.current = null;
      }
    };
  }, [activeUnlockSession?.id, activeUnlockSession?.isActive, activeUnlockEndTimeMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
      if (unlockTimerRef.current) clearInterval(unlockTimerRef.current as any);
      // Clean up Live Activity when component unmounts
      const activityId = liveActivityIdRef.current;
      if (activityId) {
        liveActivityIdRef.current = undefined;
        sessionEndTimeRef.current = null;
        sessionStartTimeRef.current = null;
        LiveActivityService.stopFocusTimer(activityId, 'cancelled');
      }
      // Cancel scheduled notification on unmount
      if (scheduledNotificationRef.current) {
        Notifications.cancelScheduledNotificationAsync(scheduledNotificationRef.current);
        scheduledNotificationRef.current = null;
      }
    };
  }, []);

  // Adopt any widget-started/stopped session, then recover from AsyncStorage.
  // Called on mount (cold start) and on foreground (warm start).
  // Runs adoption (write) before recovery (read) to eliminate the race condition.
  const adoptAndRecoverSession = async () => {
    try {
      // --- Widget adoption phase ---

      // 0. Check if widget stopped an unlock session (StopUnlockIntent)
      const unlockStopAction = WidgetService.checkWidgetUnlockStopAction();
      if (unlockStopAction) {
        console.log('📱 [Widget] Adopting widget unlock stop action');
        const store = useAppStore.getState();
        const { activeSessions } = store.blocklist;

        // Find and stop any active unlock sessions
        activeSessions.allIds.forEach(id => {
          const session = activeSessions.byId[id];
          if (session?.isActive) {
            stopUnlockSession(id, true);
            console.log('🔒 [Widget] Ended unlock session from live activity:', id);
          }
        });
      }

      // 1. Check if widget stopped a session while app was backgrounded/killed
      const stopAction = WidgetService.checkWidgetStopAction();
      if (stopAction) {
        console.log('📱 [Widget] Adopting widget stop action');

        // Check if a NEWER session was started after this stop action.
        // Flow: start A → stop A → start B → user opens app.
        // The stop belongs to session A; session B is the current one.
        const widgetSession = WidgetService.readWidgetStartedSession();
        const hasNewerStart = widgetSession && widgetSession.startTime > stopAction.timestamp;

        // Use the stopped session's info to record it as completed.
        // Only consume widgetStartedSession if it belongs to the stopped session.
        const activeRaw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        const stoppedSession = hasNewerStart ? null : widgetSession;
        if (stoppedSession) WidgetService.clearWidgetStartedSession();
        const sessionInfo = activeRaw
          ? JSON.parse(activeRaw)
          : stoppedSession
            ? { startTime: stoppedSession.startTime, targetDuration: stoppedSession.duration, tagId: stoppedSession.tagId }
            : null;

        if (sessionInfo) {
          const store = useAppStore.getState();
          const actualEndTime = stopAction.timestamp;
          const durationMs = actualEndTime - sessionInfo.startTime;
          const durationMinutes = Math.round(durationMs / 60000);

          if (durationMinutes > 0) {
            // For infinite sessions (targetDuration === 0), set targetDuration
            // to the actual duration so fruit calculation works correctly.
            // Mirrors the logic in saveSessionAndNavigate().
            const isInfiniteSession = sessionInfo.targetDuration === 0 || sessionInfo.isInfinite;
            const effectiveTargetDuration = isInfiniteSession
              ? Math.max(1, durationMinutes)
              : sessionInfo.targetDuration;

            store.focus.createCompletedSession({
              startTime: new Date(sessionInfo.startTime),
              endTime: new Date(actualEndTime),
              duration: durationMinutes,
              targetDuration: effectiveTargetDuration,
              tagId: sessionInfo.tagId,
            });
            console.log('📱 [Widget] Recorded completed session:', durationMinutes, 'min', isInfiniteSession ? '(infinite)' : '');
          }

          await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
        }

        // If a newer session is pending, don't reset — fall through to adopt it.
        // Otherwise, clean up and return.
        if (!hasNewerStart) {
          // Check if the UI was showing an active session before teardown clears refs
          const wasUIActive = !!(sessionStartTimeRef.current || sessionEndTimeRef.current);

          // Use shared teardown: clears timer, resets running state, removes
          // persisted session, restores shield, clears widget state, cancels notification
          teardownSession();

          // Reset additional UI-only state that teardownSession doesn't cover
          if (wasUIActive) {
            console.log('📱 [Widget] Session stopped externally, resetting UI');
            setIsSessionActive(false);
            setRemainingSeconds(0);
            setElapsedSeconds(0);
            setIsInfinite(false);

            scrollerOpacity.setValue(1);
            tagsOpacity.setValue(1);
            headerOpacity.setValue(1);
            timerOpacity.setValue(0);
            timerScale.setValue(0.94);
            timerTranslateY.setValue(6);
          }
          return; // stop action handled — no session to recover
        }
        // hasNewerStart: fall through to adopt the newer session below
      }

      // 2. Check if widget started a session
      // Use read-only check first; only clear after successful AsyncStorage write.
      // This prevents data loss if the adoption is interrupted (e.g. by a race
      // condition when the intent fires during a long-press context menu).
      const startedSession = WidgetService.readWidgetStartedSession();
      if (startedSession) {
        console.log('📱 [Widget] Adopting widget-started session:', startedSession.tagId);

        const existingSession = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
        if (!existingSession) {
          // Adopt the Live Activity so JS can manage it (even if expired — it's
          // still running in bonus-time / count-up mode on the Dynamic Island)
          if (startedSession.liveActivityId) {
            LiveActivityService.adoptWidgetActivity(
              startedSession.liveActivityId,
              startedSession.isInfinite ? undefined : startedSession.endTime
            );
          }

          // Write to AsyncStorage so the recovery phase below picks it up.
          // If the timer already expired, recovery will enter bonus-time mode.
          const tagIcon = startedSession.tagIcon || '🎯';
          const persistedSession: PersistedSession = {
            startTime: startedSession.startTime,
            endTime: startedSession.isInfinite ? 0 : startedSession.endTime,
            targetDuration: startedSession.duration,
            tagId: startedSession.tagId,
            tagLabel: `${tagIcon} ${startedSession.tagName}`,
            isInfinite: startedSession.isInfinite,
            liveActivityId: startedSession.liveActivityId,
          };
          await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(persistedSession));
          // Only clear after successful write so the data survives crashes/races
          WidgetService.clearWidgetStartedSession();
          console.log('📱 [Widget] Wrote active-focus-session for recovery, liveActivityId:', startedSession.liveActivityId);
        } else {
          console.log('📱 [Widget] Existing active session found, skipping adoption');
          WidgetService.clearWidgetStartedSession();
        }
      }

      // --- Recovery phase ---
    } catch (error) {
      console.error('📱 [Widget] Failed to adopt widget session:', error);
    }

    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return;
    try {
      const persisted: PersistedSession = JSON.parse(raw);
      const now = Date.now();

      // Restore notification ID so it can be cancelled if the user stops the session
      if (persisted.notificationId) {
        scheduledNotificationRef.current = persisted.notificationId;
      }
      if (persisted.liveActivityId) {
        liveActivityIdRef.current = persisted.liveActivityId;
      }

      // Restore shield to focus-session mode (block unlocking)
      const currentBalance = useAppStore.getState().rewards.balance;
      FamilyControlsModule.updateShieldBalance(currentBalance, true).catch((error) => {
        console.error('Failed to update shield for recovered focus session:', error);
      });

      // Sync widget with recovered session state
      // Use persisted tagLabel (saved at session start) to avoid store hydration
      // race — tags.byId may be empty if Zustand hasn't rehydrated yet.
      const recoveredTag = useAppStore.getState().focus.tags.byId[persisted.tagId];
      const recoveredTagLabel = persisted.tagLabel
        || (recoveredTag ? `${recoveredTag.icon || '🎯'} ${recoveredTag.name}` : 'Focus');
      WidgetService.syncSessionState({
        isActive: true,
        tagName: recoveredTag?.name || 'Focus',
        tagIcon: recoveredTag?.icon || '🎯',
        tagColor: recoveredTag?.color || '#8B4513',
        startTime: persisted.startTime,
        endTime: persisted.isInfinite ? 0 : persisted.endTime,
        isInfinite: persisted.isInfinite,
      });

      // Restore in-memory tag info so stopFocusTimer can build the correct
      // idle state (these static fields are lost on app termination)
      LiveActivityService.setLastTag(
        persisted.tagId,
        recoveredTagLabel,
        persisted.targetDuration,
      );

      // Session is being recovered/adopted — signal focusing status
      useAppStore.getState().grove.setFocusing(true);

      if (persisted.isInfinite) {
        // Infinite session was running when app was killed — restore it
        const elapsed = Math.floor((now - persisted.startTime) / 1000);

        setSelectedTime(0);
        setSelectedTag(persisted.tagId);
        setElapsedSeconds(elapsed);
        setIsInfinite(true);
        setIsRunning(true);
        setIsSessionActive(true);
        sessionStartTimeRef.current = persisted.startTime;
        sessionTargetDurationRef.current = persisted.targetDuration;

        // Switch visuals to timer mode immediately
        scrollerOpacity.setValue(0);
        tagsOpacity.setValue(0);
        headerOpacity.setValue(0);
        timerOpacity.setValue(1);
        timerScale.setValue(1);
        timerTranslateY.setValue(0);

        if (!persisted.liveActivityId) {
          // Older persisted sessions did not store the activity ID.
          const recoveredTagObj = useAppStore.getState().focus.tags.byId[persisted.tagId];
          const recoveredTagLabel = recoveredTagObj
            ? `${recoveredTagObj.icon || '🎯'} ${recoveredTagObj.name}`
            : 'Focus';
          const activityId = LiveActivityService.startFocusTimerInfinite(
            new Date(persisted.startTime),
            recoveredTagLabel
          );
          if (activityId) {
            liveActivityIdRef.current = activityId;
          }
        }

        // Start elapsed count-up interval
        if (timerRef.current) clearInterval(timerRef.current as any);
        timerRef.current = setInterval(() => {
          setElapsedSeconds(prev => prev + 1);
        }, 1000);
        return;
      }

      if (now >= persisted.endTime) {
        // Session expired while app was killed — resume in bonus time mode
        setSelectedTime(persisted.targetDuration);
        setSelectedTag(persisted.tagId);
        setRemainingSeconds(0);
        setIsInfinite(false);
        setIsRunning(true);
        setIsSessionActive(true);
        sessionStartTimeRef.current = persisted.startTime;
        sessionEndTimeRef.current = persisted.endTime;
        sessionTargetDurationRef.current = persisted.targetDuration;

        const bonus = Math.floor((now - persisted.endTime) / 1000);
        setIsBonusTime(true);
        setBonusSeconds(bonus);

        // Switch visuals to timer mode immediately
        scrollerOpacity.setValue(0);
        tagsOpacity.setValue(0);
        headerOpacity.setValue(0);
        timerOpacity.setValue(1);
        timerScale.setValue(1);
        timerTranslateY.setValue(0);

        // Start bonus count-up interval
        if (timerRef.current) clearInterval(timerRef.current as any);
        timerRef.current = setInterval(() => {
          setBonusSeconds(b => b + 1);
        }, 1000);
      } else {
        // Session still running — resume the timer
        const remainingMs = persisted.endTime - now;
        // Use Math.floor to match SwiftUI's Text(date, style: .timer) truncation
        const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));

        setSelectedTime(persisted.targetDuration);
        setSelectedTag(persisted.tagId);
        setRemainingSeconds(remainingSec);
        setIsInfinite(false);
        setIsRunning(true);
        setIsSessionActive(true);
        sessionStartTimeRef.current = persisted.startTime;
        sessionEndTimeRef.current = persisted.endTime;
        sessionTargetDurationRef.current = persisted.targetDuration;

        // Switch visuals to timer mode immediately (no animation needed on recovery)
        scrollerOpacity.setValue(0);
        tagsOpacity.setValue(0);
        headerOpacity.setValue(0);
        timerOpacity.setValue(1);
        timerScale.setValue(1);
        timerTranslateY.setValue(0);

        // Start the countdown interval
        if (timerRef.current) clearInterval(timerRef.current as any);
        timerRef.current = setInterval(() => {
          setRemainingSeconds(prev => {
            if (prev <= 1) {
              // Enter bonus time mode
              if (timerRef.current) clearInterval(timerRef.current as any);
              timerRef.current = null;
              setIsBonusTime(true);
              setBonusSeconds(0);

              timerRef.current = setInterval(() => {
                setBonusSeconds(b => b + 1);
              }, 1000);

              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (e) {
      // Corrupted data — just clear it
      AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    }

  };

  // Adopt widget session + recover from AsyncStorage on mount (cold start)
  useEffect(() => {
    adoptAndRecoverSession();
  }, []);

  const handleStartFocus = () => {
    if (isUnlockActive) {
      handleStopUnlock();
      return;
    }

    // If running or transitioning, treat as Stop/Cancel with animation
    if (isRunning || isSessionActive) {
      stopWithAnimation();
      return;
    }
    
    // If no tags exist, show new tag modal
    if (availableTags.length === 0) {
      setShowNewTagModal(true);
      return;
    }
    
    // If no tag selected (shouldn't happen with default), select first
    if (!selectedTag) {
      if (availableTags.length > 0) {
        setSelectedTag(availableTags[0].id);
      }
      return;
    }

    // Start flow: switch button to Stop immediately
    setIsSessionActive(true);
    transitionCancelledRef.current = false;

    // Set the display value before the timer fades in
    if (selectedTime === 0) {
      setElapsedSeconds(0);
    } else {
      setRemainingSeconds(selectedTime * 60);
    }

    // Prepare timer visuals for entrance
    timerOpacity.setValue(0);
    timerScale.setValue(0.94);
    timerTranslateY.setValue(6);

    // Fade out scroller, tags, and the blocklist icon.
    Animated.parallel([
      Animated.timing(scrollerOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tagsOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      if (transitionCancelledRef.current) return;
      // Start the countdown immediately as the timer fades in, not after the spring settles
      startTimer();
      Animated.parallel([
        Animated.timing(timerOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(timerScale, { toValue: 1, stiffness: 220, damping: 20, mass: 0.6, useNativeDriver: true }),
        Animated.spring(timerTranslateY, { toValue: 0, stiffness: 220, damping: 20, mass: 0.6, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleTimeChange = (time: number) => {
    setSelectedTime(time);
    if (selectedTag) {
      setLastDurationForTag(selectedTag, time);
      // Sync updated duration to widget immediately
      const updatedDurations = { ...lastDurationByTagId, [selectedTag]: time };
      // Compute most recent session time per tag
      const lastUsedByTag: Record<string, number> = {};
      for (const sid of sessions.allIds) {
        const s = sessions.byId[sid];
        if (!s) continue;
        const t = s.startTime instanceof Date ? s.startTime.getTime() : new Date(s.startTime).getTime();
        if (!lastUsedByTag[s.tagId] || t > lastUsedByTag[s.tagId]) {
          lastUsedByTag[s.tagId] = t;
        }
      }
      const tagList = tags.allIds.map(id => tags.byId[id]).filter(tag => tag && !tag.deletedAt).map(tag => ({
          id: tag.id,
          name: tag.name,
          icon: tag.icon || '🎯',
          color: tag.color || '#8B4513',
          lastDuration: updatedDurations[tag.id] ?? 15,
          lastUsedAt: lastUsedByTag[tag.id] ?? 0,
      }));
      WidgetService.syncTagList(tagList);
      // Update any idle Live Activity with the new duration
      if (!isRunning) {
        const tagObj = tags.byId[selectedTag];
        const tagLabel = tagObj ? `${tagObj.icon || '🎯'} ${tagObj.name}` : 'Focus';
        LiveActivityService.showIdleFocusActivity(tagLabel, selectedTag, time);
      }
    }
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const displayTime = isBonusTime
    ? `+${formatTime(bonusSeconds)}`
    : isInfinite ? formatTime(elapsedSeconds) : formatTime(remainingSeconds);
  const timerDisplayTime = isUnlockActive ? formatTime(unlockRemainingSeconds) : displayTime;
  const timerTextColor = isBonusTime && !isUnlockActive ? '#4CAF7C' : (colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37');

  const selectedTagObj = selectedTag
    ? (tags.byId[selectedTag] || challengeTags.find(ct => ct.id === selectedTag) || null)
    : null;
  const selectedTagName = selectedTagObj?.name || null;

  const saveSessionAndNavigate = (notes?: string, includeBonusTime: boolean = true) => {
    const wasBonus = stoppedInBonusRef.current;
    const savedBonusSeconds = stoppedBonusSecondsRef.current;
    const sessionStart = stoppedSessionStartTimeRef.current;
    // Use captured ref for target duration — immune to state overwrites and being cleared early
    const targetDuration = stoppedSessionTargetDurationRef.current ?? sessionTargetDurationRef.current ?? selectedTime;
    const isDevTimer = targetDuration === -1;
    const baseMinutes = isDevTimer ? 1 : targetDuration;
    const baseSeconds = isDevTimer ? 5 : targetDuration * 60;

    // Use wall-clock time from refs (immune to state race conditions after rehydration)
    const now = Date.now();
    const totalElapsedSeconds = sessionStart ? Math.floor((now - sessionStart) / 1000) : 0;

    let actualDuration: number;
    let totalSeconds: number;

    if (wasBonus) {
      // Session completed its target duration and entered bonus time
      const bonusMinutes = Math.floor(savedBonusSeconds / 60);
      actualDuration = baseMinutes + (includeBonusTime ? bonusMinutes : 0);
      totalSeconds = baseSeconds + (includeBonusTime ? savedBonusSeconds : 0);
    } else if (sessionStart) {
      // Session stopped before completion — use wall-clock elapsed time
      actualDuration = Math.floor(totalElapsedSeconds / 60);
      totalSeconds = totalElapsedSeconds;
    } else {
      // Fallback: derive from state (original logic, for safety)
      actualDuration = isInfinite ? Math.floor(elapsedSeconds / 60) : Math.floor((baseSeconds - remainingSeconds) / 60);
      totalSeconds = isInfinite ? elapsedSeconds : (baseSeconds - remainingSeconds);
    }

    // Only create session if duration is meaningful (1+ minutes or dev timer)
    // Stopping within the first minute cancels the session
    const hasMinimumDuration = actualDuration >= 1 || isDevTimer;

    if (hasMinimumDuration) {
      const startTime = sessionStart ? new Date(sessionStart) : new Date(now - totalSeconds * 1000);
      const endTime = new Date(now);

      const session = createCompletedSession({
        startTime,
        endTime,
        duration: Math.max(1, actualDuration),
        targetDuration: isInfinite ? Math.max(1, actualDuration) : baseMinutes,
        tagId: selectedTag!,
        notes: notes || undefined,
      });

      // Navigate to session complete modal
      router.push({ pathname: '/(modals)/session-complete', params: { sessionId: session.id } });
    } else {
      showToast('Session cancelled', 'neutral');
    }
  };


  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
    <SwipeableTabWrapper currentTab="index">
      {/* Header: Blocklist Icon (Left) + Fruit Counter (Right) */}
      <View
        className="absolute top-4 left-0 right-0 z-50 flex-row items-center justify-between px-8"
      >
        <Animated.View
          style={{ opacity: isUnlockActive ? 0 : headerOpacity }}
          pointerEvents={isSessionActive || isUnlockActive ? 'none' : 'auto'}
        >
          <Pressable
            onPress={handleBlockList}
            className="flex-row items-center active:opacity-70"
            hitSlop={8}
          >
            <Ionicons name="ban-outline" size={22} color={colorScheme === 'dark' ? '#CACACA' : '#8B7355'} />
            <Text style={{ color: colorScheme === 'dark' ? '#CACACA' : '#8B7355', fontSize: 13, fontWeight: '500', marginLeft: 6 }}>Block List</Text>
            {blockedCount > 0 && (
              <View className="ml-1.5 bg-primary rounded-full px-1.5 py-0.5 min-w-[20px] items-center">
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>{blockedCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
        <Animated.View
          style={{ opacity: isUnlockActive ? 0 : 1 }}
          pointerEvents={isUnlockActive ? 'none' : 'auto'}
        >
          <FruitCounter fruitCount={rewards.balance} size="small" onPress={() => router.push('/fruit-store')} />
        </Animated.View>
      </View>

      <View className="flex-1 items-center justify-center px-4">
        {/* Time Selector or Running Timer - stacked and crossfaded */}
        <View style={{ height: 300, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          <Animated.View style={{ position: 'absolute', opacity: isUnlockActive ? 0 : scrollerOpacity, width: '100%', zIndex: 0 }} pointerEvents={isRunning || isUnlockActive ? 'none' : 'auto'}>
            {timerPickerStyle === 'wheel' ? (
              <DurationPicker
                selectedTime={selectedTime}
                onTimeChange={handleTimeChange}
              />
            ) : (
              <TimeScroller
                selectedTime={selectedTime}
                onTimeChange={handleTimeChange}
              />
            )}
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: isUnlockActive ? 1 : timerOpacity, transform: [{ scale: isUnlockActive ? 1 : timerScale }, { translateY: isUnlockActive ? 0 : timerTranslateY }], zIndex: 100, alignItems: 'center' }}>
            {isRunning && !isBonusTime && !isUnlockActive && (
              <View style={{ alignItems: 'center', marginBottom: 4, paddingHorizontal: 16 }}>
                {selectedTagName && (
                  <Text style={{ color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37', fontSize: 24, lineHeight: 28, fontFamily: 'Poppins-SemiBold', textAlign: 'center', marginBottom: 4 }}>
                    {selectedTagObj?.icon ? `${selectedTagObj.icon} ` : ''}{selectedTagName}
                  </Text>
                )}
                <Text style={{ color: colorScheme === 'dark' ? '#CACACA' : '#8B7355', fontSize: 12, lineHeight: 18, fontFamily: 'Poppins-Regular', textAlign: 'center' }}>
                  5 min = 1 🍎. Finish session to get 1 extra bonus 🍎!
                </Text>
              </View>
            )}
            {isBonusTime && !isUnlockActive && (
              <View style={{ alignItems: 'center', marginBottom: 4, paddingHorizontal: 16 }}>
                <Text style={{ color: '#4CAF7C', fontSize: 20, lineHeight: 26, fontFamily: 'Poppins-SemiBold', textAlign: 'center' }}>
                  Session complete!
                </Text>
                <Text style={{ color: colorScheme === 'dark' ? '#CACACA' : '#8B7355', fontSize: 12, lineHeight: 18, fontFamily: 'Poppins-Regular', textAlign: 'center' }}>
                  bonus 🍎 earned
                </Text>
              </View>
            )}
            <Animated.Text
              style={{ fontSize: 96, lineHeight: 120, color: timerTextColor, fontFamily: 'Poppins-Bold', textAlign: 'center' }}
            >
              {timerDisplayTime}
            </Animated.Text>
          </Animated.View>
        </View>

        {/* Focus Button (kept mounted, fade only) */}
        <View style={{ width: '100%', marginBottom: 64, minHeight: 96, justifyContent: 'center' }}>
          <Animated.View style={{ opacity: isUnlockActive ? 0 : tagsOpacity }} pointerEvents={isRunning || isUnlockActive ? 'none' : 'auto'}>
            <Pressable
              onPress={() => setShowTagModal(true)}
              className="bg-light-border/30 dark:bg-gray-700 rounded-2xl py-4 px-6 flex-row items-center justify-between active:opacity-80"
            >
              <View className="flex-row items-center">
                <Typography variant="subtitle-16" color="primary">
                  {availableTags.length === 0 ? 'Create a new tag' : (selectedTagName || 'Select a tag')}
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'} />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* Start/Stop Button - Fixed at bottom */}
      <View className="px-4 pb-8">
        <Pressable
          onPress={handleStartFocus}
          className="bg-white dark:bg-white rounded-2xl py-4 items-center active:opacity-80"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Typography
            variant="subtitle-16"
            className="font-semibold"
            style={{ color: colorScheme === 'dark' ? '#1B1C30' : '#5D4E37' }}
          >
            {isUnlockActive
              ? 'Stop Unlocked'
              : isSessionActive ? 'Stop Focus' : (availableTags.length === 0 ? 'Create Tag First' : 'Start Focus')}
          </Typography>
        </Pressable>
        {isUnlockActive && (
          <Typography variant="body-12" color="secondary" className="text-center mt-3">
            unused time will be returned as fruits
          </Typography>
        )}
      </View>

      {/* Tag Selection Modal */}
      <Modal
        visible={showTagModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!showEditTagModal && !showDeleteModal && !showShareModal) setShowTagModal(false); }}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => { if (!showEditTagModal && !showDeleteModal && !showShareModal) setShowTagModal(false); }}
          />
          <View className="bg-light-bg dark:bg-dark-bg rounded-3xl w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-6 border-b border-light-border dark:border-gray-700">
              <Typography variant="headline-20" color="primary">
                Select Focus
              </Typography>
              <Pressable
                onPress={() => setShowTagModal(false)}
                className="w-8 h-8 rounded-full bg-light-border/50 dark:bg-gray-700 items-center justify-center"
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'} />
              </Pressable>
            </View>

            {/* Tags List */}
            <ScrollView className="p-4" style={{ maxHeight: 400 }} scrollEnabled={!isDragging}>
              {orderedTags.length === 0 && (
                <View className="py-6 px-2 items-center">
                  <Typography variant="body-14" color="secondary" className="text-center leading-5">
                    Create tags to categorize your focus sessions.{'\n'}
                    e.g. Work, Reading, Exercise, Project X, Mindfulness Rest
                  </Typography>
                </View>
              )}
              {orderedTags.map((tag, index) => (
                <View key={tag.id} ref={index === 0 ? firstTagRef : undefined} collapsable={false}>
                  <DraggableTagRow
                    tag={tag}
                    index={index}
                    selectedTag={selectedTag}
                    lastDuration={lastDurationByTagId[tag.id] ?? 15}
                    isDragging={isDragging}
                    dragOriginalIndex={dragOriginalIdx}
                    dragTargetIndex={dragTargetIdx}
                    isChallenge={'isChallenge' in tag && tag.isChallenge === true}
                    onSelect={handleTagSelect}
                    onEdit={handleEditTag}
                    onDelete={handleDeleteTag}
                    onUnlink={handleUnlinkTag}
                    onShare={handleShareTag}
                    onSwipeOpen={handleSwipeOpen}
                    onDragStart={handleDragStart}
                    onDragMove={handleDragMove}
                    onDragEnd={handleDragEnd}
                  />
                </View>
              ))}
            </ScrollView>

            {/* New Tag & Join Tag Buttons */}
            <View className="p-4 border-t border-light-border dark:border-gray-700">
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setShowTagModal(false);
                    setShowJoinModal(true);
                  }}
                  className="flex-1 rounded-2xl py-4 items-center active:opacity-80 border border-blue-600"
                >
                  <Typography variant="subtitle-16" className="font-semibold" style={{ color: '#3B82F6' }}>
                    Join Tag
                  </Typography>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!canCreateTag) {
                      setShowTagModal(false);
                      setShowUpgradePrompt(true);
                      return;
                    }
                    setShowTagModal(false);
                    setShowNewTagModal(true);
                  }}
                  className="flex-1 bg-blue-600 rounded-2xl py-4 items-center active:opacity-80"
                >
                  <Typography variant="subtitle-16" color="white" className="font-semibold">
                    New Tag
                  </Typography>
                </Pressable>
              </View>
            </View>
            
          </View>
        </View>

        {/* Tag Swipe Coach Mark */}
        <CoachMark
          targetRef={firstTagRef as React.RefObject<View>}
          title="Manage your tags"
          message="Hold to reorder, swipe to edit"
          visible={showTagSwipeCoachMark && !preferences.hasSeenTagSwipeHint}
          onDismiss={() => {
            setShowTagSwipeCoachMark(false);
            updatePreferences({ hasSeenTagSwipeHint: true });
          }}
        />

        {/* Edit Tag Overlay - covers entire screen including tag picker */}
        {showEditTagModal && (
          <View className="absolute inset-0 bg-black/50 justify-center items-center p-4">
            <View className="bg-light-bg dark:bg-dark-bg rounded-2xl w-full max-w-xs overflow-hidden">
              {/* Edit Header */}
              <View className="p-4 border-b border-light-border dark:border-gray-700">
                <Typography variant="headline-18" color="primary">
                  Edit Tag
                </Typography>
              </View>

              {/* Edit Form */}
              <View className="p-4">
                {/* Emoji + Name row */}
                <View className="mb-4 flex-row items-center" style={{ gap: 12 }}>
                  <Pressable
                    onPress={handleEditTagEmojiPress}
                    className="w-12 h-12 rounded-xl bg-gray-700 items-center justify-center border border-gray-500 active:opacity-80"
                  >
                    <Text className="text-2xl">{editTagEmoji || '🏷️'}</Text>
                  </Pressable>
                  <TextInput
                    value={editTagName}
                    onChangeText={setEditTagName}
                    placeholder="Tag name"
                    placeholderTextColor="#666"
                    className="flex-1"
                    style={{
                      backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 16,
                      color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                      borderWidth: 1,
                      borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
                    }}
                  />
                </View>

                {/* Color Selection */}
                <View>
                  <Typography variant="body-14" color="primary" className="mb-3">
                    Color
                  </Typography>
                  <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    <TagColorPicker selectedColor={editTagColor} onSelectColor={setEditTagColor} />
                  </ScrollView>
                </View>
              </View>

              {/* Inline Emoji Picker */}
              {showEditEmojiGrid && (
                <ScrollView style={{ maxHeight: 200 }} className="px-4 pb-2 border-t border-light-border dark:border-gray-700" nestedScrollEnabled>
                  {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <View key={category} className="mt-3">
                      <Typography variant="body-12" color="secondary" className="mb-2">
                        {category}
                      </Typography>
                      <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                        {emojis.map((emoji, index) => (
                          <Pressable
                            key={index}
                            onPress={() => {
                              setEditTagEmoji(emoji);
                              setShowEditEmojiGrid(false);
                            }}
                            className="w-10 h-10 items-center justify-center rounded-lg bg-gray-700 active:bg-gray-600"
                          >
                            <Text className="text-xl">{emoji}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* Action buttons */}
              <View className="p-3 border-t border-light-border dark:border-gray-700 flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={() => { setShowEditTagModal(false); setEditingTag(null); setShowEditEmojiGrid(false); }}
                  className="flex-1 bg-gray-600 rounded-xl py-3 items-center active:opacity-80"
                >
                  <Typography variant="body-14" color="white">
                    Cancel
                  </Typography>
                </Pressable>
                <Pressable
                  onPress={handleSaveEditTag}
                  disabled={!editTagName.trim()}
                  className={`flex-1 rounded-xl py-3 items-center ${editTagName.trim() ? 'bg-blue-600 active:opacity-80' : 'bg-gray-500 opacity-50'}`}
                >
                  <Typography variant="body-14" color="white" className="font-semibold">
                    Save
                  </Typography>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Delete Confirmation Popup - covers entire screen including tag picker */}
        {showDeleteModal && (
          <View className="absolute inset-0 bg-black/50 justify-center items-center p-4">
            <Pressable className="bg-light-bg dark:bg-dark-bg rounded-2xl w-full max-w-xs">
              {tagToDelete && tagDeletionBlockReason(tagToDelete) ? (
                <>
                  {/* Cannot Delete Header */}
                  <View className="p-4 border-b border-light-border dark:border-gray-700">
                    <Typography variant="headline-18" color="primary" className="text-center">
                      Cannot Delete Tag
                    </Typography>
                  </View>

                  {/* Explanation */}
                  <View className="p-4">
                    <Typography variant="body-14" color="primary" className="leading-5">
                      {tagDeletionBlockReason(tagToDelete)}
                    </Typography>
                  </View>

                  {/* OK button */}
                  <View className="p-3 border-t border-light-border dark:border-gray-700">
                    <Pressable
                      onPress={handleCancelDelete}
                      className="w-full bg-gray-600 rounded-xl py-3 items-center active:opacity-80"
                    >
                      <Typography variant="body-14" color="white">
                        OK
                      </Typography>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {/* Delete Popup Header */}
                  <View className="p-4 border-b border-light-border dark:border-gray-700">
                    <Typography variant="headline-18" color="primary" className="text-center">
                      Delete Tag
                    </Typography>
                  </View>

                  {/* Warning content */}
                  <View className="p-4">
                    <Typography variant="body-14" color="primary" className="leading-5">
                      Are you sure you want to delete {tagToDelete?.name ? `"${tagToDelete.name}"` : 'this tag'}? Existing focus sessions will be kept.
                    </Typography>
                  </View>

                  {/* Action buttons */}
                  <View className="p-3 border-t border-light-border dark:border-gray-700 flex-row" style={{ gap: 8 }}>
                    <Pressable
                      onPress={handleCancelDelete}
                      className="flex-1 bg-gray-600 rounded-xl py-3 items-center active:opacity-80"
                    >
                      <Typography variant="body-14" color="white">
                        Cancel
                      </Typography>
                    </Pressable>
                    <Pressable
                      onPress={handleConfirmDelete}
                      className="flex-1 rounded-xl py-3 items-center bg-red-600 active:opacity-80"
                    >
                      <Typography variant="body-14" color="white" className="font-semibold">
                        Delete
                      </Typography>
                    </Pressable>
                  </View>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* Share Tag Overlay - covers entire screen including tag picker */}
        {showShareModal && sharingTag && (
          <ShareTagOverlay
            tag={sharingTag}
            onClose={() => { setShowShareModal(false); setSharingTag(null); }}
            onShareTag={shareTag}
            onStopSharing={stopSharingTag}
          />
        )}
      </Modal>

      {/* New Tag Creation Modal */}
      <Modal
        visible={showNewTagModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowNewTagModal(false);
          setNewTagName('');
          setNewTagEmoji('');
          setNewTagColor('#6592E9');
        }}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4"
            onPress={() => {
              setShowNewTagModal(false);
              setNewTagName('');
              setNewTagEmoji('');
              setNewTagColor('#6592E9');
            }}
          >
            <Pressable onPress={() => {}} className="bg-light-bg dark:bg-dark-bg rounded-3xl w-full max-w-sm overflow-hidden">
              {/* Modal Header */}
              <View className="flex-row items-center justify-between p-6 border-b border-light-border dark:border-gray-700">
                <Typography variant="headline-20" color="primary">
                  Create New Tag
                </Typography>
                <Pressable
                  onPress={() => {
                    setShowNewTagModal(false);
                    setNewTagName('');
                    setNewTagEmoji('');
                    setNewTagColor('#6592E9');
                  }}
                  className="w-8 h-8 rounded-full bg-light-border/50 dark:bg-gray-700 items-center justify-center"
                >
                  <Ionicons name="close" size={20} color={colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37'} />
                </Pressable>
              </View>

              {/* New Tag Form */}
              <View className="p-6">
                {/* Emoji + Name row */}
                <View className="mb-6 flex-row items-center" style={{ gap: 12 }}>
                  <Pressable
                    onPress={handleNewTagEmojiPress}
                    className="w-12 h-12 rounded-xl bg-light-border/30 dark:bg-gray-700 items-center justify-center border border-light-border dark:border-gray-500 active:opacity-80"
                  >
                    {newTagEmoji ? (
                      <Text className="text-2xl">{newTagEmoji}</Text>
                    ) : (
                      <Ionicons name="happy-outline" size={24} color="#6592E9" />
                    )}
                  </Pressable>
                  <TextInput
                    value={newTagName}
                    onChangeText={setNewTagName}
                    placeholder="Tag name"
                    placeholderTextColor="#666"
                    className="flex-1"
                    style={{
                      backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0E0CC',
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 16,
                      color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37',
                      borderWidth: 1,
                      borderColor: colorScheme === 'dark' ? '#444' : '#D4C4A8',
                    }}
                    autoFocus={true}
                  />
                </View>

                {/* Color Selection */}
                <View>
                  <Typography variant="body-14" color="primary" className="mb-3">
                    Color
                  </Typography>
                  <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    <TagColorPicker selectedColor={newTagColor} onSelectColor={setNewTagColor} />
                  </ScrollView>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="p-4 border-t border-light-border dark:border-gray-700 flex-row" style={{ gap: 12 }}>
                <Pressable
                  onPress={() => {
                    setShowNewTagModal(false);
                    setNewTagName('');
                    setNewTagEmoji('');
                    setNewTagColor('#6592E9');
                  }}
                  className="flex-1 bg-gray-600 rounded-2xl py-4 items-center active:opacity-80"
                >
                  <Typography variant="subtitle-16" color="white">
                    Cancel
                  </Typography>
                </Pressable>
                <Pressable
                  onPress={handleCreateNewTag}
                  disabled={!newTagName.trim() || !newTagEmoji}
                  className={`flex-1 rounded-2xl py-4 items-center ${newTagName.trim() && newTagEmoji ? 'bg-blue-600 active:opacity-80' : 'bg-gray-500 opacity-50'
                    }`}
                >
                  <Typography variant="subtitle-16" color="white" className="font-semibold">
                    Create Tag
                  </Typography>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>




      {/* Emoji Picker */}
      {/* Blocklist Tip Modal */}
      <Modal
        visible={showBlocklistTip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBlocklistTip(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-6"
          onPress={() => setShowBlocklistTip(false)}
        >
          <Pressable onPress={() => {}} className="bg-light-bg dark:bg-dark-bg rounded-2xl w-full max-w-sm overflow-hidden p-6">
            <Text style={{ color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37', fontSize: 17, fontWeight: '600', marginBottom: 12 }}>
              Block List
            </Text>
            <Text style={{ color: colorScheme === 'dark' ? '#AAAAAA' : '#8B7355', fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
              This is where you add apps that are unnecessary for achieving your goals and also distracting.{'\n\n'}Your first setup is free. After that, each edit costs fruits — starting at 1 and doubling each time, resetting weekly.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <Pressable
                onPress={() => setShowBlocklistTip(false)}
                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: colorScheme === 'dark' ? '#888888' : '#8B7355', fontSize: 15, fontWeight: '500' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleBlocklistTipUnderstood}
                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#6592E9' }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>Understood</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Cost Confirmation Modal */}
      <Modal
        visible={showEditCostModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditCostModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-6"
          onPress={() => setShowEditCostModal(false)}
        >
          <Pressable onPress={() => {}} className="bg-light-bg dark:bg-dark-bg rounded-2xl w-full max-w-sm overflow-hidden p-6">
            <Text style={{ color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37', fontSize: 17, fontWeight: '600', marginBottom: 12 }}>
              Edit Block List
            </Text>
            <Text style={{ color: colorScheme === 'dark' ? '#AAAAAA' : '#8B7355', fontSize: 14, lineHeight: 20, marginBottom: 15 }}>
              Editing the blocklist is a thoughtful process. The cost starts at 1 fruit and doubles with each edit, resetting weekly.
            </Text>
            <Text style={{ color: colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37', fontSize: 15, fontWeight: '500', marginBottom: 15 }}>
              This edit will cost {blocklistEditCost.cost} 🍎
            </Text>
            {!blocklistEditCost.canAfford && (
              <Text style={{ color: '#E57373', fontSize: 13, marginBottom: 24 }}>
                {"You don't have enough fruits. Focus more to earn!"}
              </Text>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <Pressable
                onPress={() => setShowEditCostModal(false)}
                style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: colorScheme === 'dark' ? '#888888' : '#8B7355', fontSize: 15, fontWeight: '500' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setShowEditCostModal(false);
                  await proceedToBlockList();
                }}
                disabled={!blocklistEditCost.canAfford}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: '#6592E9',
                  opacity: blocklistEditCost.canAfford ? 1 : 0.5,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>Confirm</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => {
          setShowEmojiPicker(false);
          setShowNewTagModal(true);
        }}
        onEmojiSelect={handleEmojiSelect}
        title="Choose Emoji for New Tag"
      />

      <UpgradePrompt
        isVisible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        onUpgrade={() => setShowUpgradeSheet(true)}
        limitType="tags"
      />

      <UpgradeSheet
        isVisible={showUpgradeSheet}
        onClose={() => setShowUpgradeSheet(false)}
      />

      {/* Join Tag — step 1: enter + resolve the share code */}
      <JoinTagModal
        visible={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onResolve={resolveSharedTagCode}
        onResolved={(result) => {
          setShowJoinModal(false);
          setResolvedSharedTag(result);
        }}
      />

      {/* Join Tag — step 2: map onto an existing tag or clone a new one */}
      <JoinSharedTagSheet
        resolved={resolvedSharedTag}
        isVisible={!!resolvedSharedTag}
        onClose={() => setResolvedSharedTag(null)}
      />

    </SwipeableTabWrapper>
    </SafeAreaView>
  );
}
