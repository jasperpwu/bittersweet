import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Typography, EmojiPickerModal } from '../ui';
import { colors } from '../../config/theme';
import { CLASSIC_TAG_COLORS } from '../../config/tagColors';

/**
 * Curated onboarding tag suggestions. `key` doubles as the i18n key
 * (`onboarding.suggestedTags.<key>`) and the identity used to return a
 * replaced slot back to the suggestion pool. The first three are the
 * pre-filled slots; the colors are tag data (see tagColors.ts), not chrome.
 */
export interface SuggestedTag {
  key: string;
  emoji: string;
  color: string;
}

export const SUGGESTED_TAGS: SuggestedTag[] = [
  { key: 'work', emoji: '💼', color: CLASSIC_TAG_COLORS.blue },
  { key: 'study', emoji: '📚', color: CLASSIC_TAG_COLORS.amber },
  { key: 'workout', emoji: '🏋️', color: CLASSIC_TAG_COLORS.green },
  { key: 'reading', emoji: '📖', color: CLASSIC_TAG_COLORS.orange },
  { key: 'meditation', emoji: '🧘', color: CLASSIC_TAG_COLORS.purple },
  { key: 'coding', emoji: '💻', color: CLASSIC_TAG_COLORS.skyBlue },
  { key: 'art', emoji: '🎨', color: CLASSIC_TAG_COLORS.red },
  { key: 'music', emoji: '🎵', color: '#AA96DA' }, // Pastel family
  { key: 'chores', emoji: '🧹', color: '#8D6E63' }, // Earth family
];

/**
 * One of the three in-memory tag drafts shown during onboarding. Nothing is
 * persisted until `completeOnboarding` turns the drafts into real tags.
 */
export interface OnboardingTagDraft {
  /** Which suggestion this slot started from — the snapshot restored to the pool on swap. */
  suggestionKey: string;
  emoji: string;
  color: string;
  /** User-typed name override; null means "show the localized suggestion name". */
  customName: string | null;
}

export function defaultTagDrafts(): OnboardingTagDraft[] {
  return SUGGESTED_TAGS.slice(0, 3).map((s) => ({
    suggestionKey: s.key,
    emoji: s.emoji,
    color: s.color,
    customName: null,
  }));
}

/** Final tag name for a draft — custom text if edited, else the localized suggestion. */
export function resolveDraftName(draft: OnboardingTagDraft, t: TFunction): string {
  return (draft.customName ?? t(`onboarding.suggestedTags.${draft.suggestionKey}`)).trim();
}

interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Marquee drift speed in px/s. */
const MARQUEE_SPEED = 24;
/** Gap between chips; the loop copy also leads with it so the seam is uniform. */
const CHIP_GAP = 8;
const SPRING_BACK = { damping: 20, stiffness: 300 };

interface OnboardingTagPickerProps {
  /** Reports every draft change so the parent can create the tags at onboarding completion. */
  onDraftsChange: (drafts: OnboardingTagDraft[]) => void;
  /** True while a chip is being dragged — the parent pauses pager scrolling. */
  onDragActiveChange: (active: boolean) => void;
}

/**
 * Onboarding tag picker: three editable tag slots (emoji tap → picker, name
 * inline) pre-filled with the first three suggestions, plus a slowly drifting
 * marquee of the remaining suggestions above. Touching a chip freezes the
 * marquee; dragging it (no long-press needed) lifts a proxy copy that follows
 * the finger — the proxy lives outside the marquee's clipped container so it
 * can travel down to the slots. Dropping on a slot swaps the suggestion in and
 * returns the slot's original suggestion to the pool pristine (edits
 * discarded — the pool holds snapshots); releasing anywhere else springs the
 * proxy back to the chip's frozen spot. The hovered slot is highlighted in
 * the dragged chip's color before the drop.
 */
export function OnboardingTagPicker({
  onDraftsChange,
  onDragActiveChange,
}: OnboardingTagPickerProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  const [drafts, setDrafts] = useState<OnboardingTagDraft[]>(defaultTagDrafts);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState(-1);
  // The chip currently "in hand": a proxy chip rendered at picker-root level
  // (escaping the marquee's overflow clipping), positioned where the original
  // chip sat when lifted. Null when no drag is in flight.
  const [dragProxy, setDragProxy] = useState<{ key: string; x: number; y: number } | null>(null);

  // Slot hit-testing runs on the UI thread against rects measured at drag start.
  const slotRects = useSharedValue<SlotRect[]>([]);
  const hoveredSV = useSharedValue(-1);
  const slotViewRefs = useRef<(View | null)[]>([]);
  const rootRef = useRef<View>(null);

  // Marquee state: the chip row drifts left by scrollX and wraps every
  // copyWidth px (the width of one copy of the pool). frozen pauses the drift
  // from the moment a finger lands on a chip until its drag fully resolves,
  // so a released chip can spring back to a spot that hasn't moved.
  const scrollX = useSharedValue(0);
  const copyWidth = useSharedValue(0);
  const frozen = useSharedValue(false);
  // Proxy translation relative to the lift position.
  const proxyTX = useSharedValue(0);
  const proxyTY = useSharedValue(0);

  useFrameCallback((frame) => {
    if (frozen.value || copyWidth.value <= 0) return;
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    scrollX.value = (scrollX.value + MARQUEE_SPEED * dt) % copyWidth.value;
  });

  useEffect(() => {
    onDraftsChange(drafts);
  }, [drafts, onDraftsChange]);

  useAnimatedReaction(
    () => hoveredSV.value,
    (current, previous) => {
      if (current !== previous) runOnJS(setHoveredSlot)(current);
    }
  );

  const pool = SUGGESTED_TAGS.filter((s) => !drafts.some((d) => d.suggestionKey === s.key));

  const measureSlots = useCallback(() => {
    const rects: SlotRect[] = [];
    let pending = drafts.length;
    slotViewRefs.current.forEach((ref, index) => {
      if (!ref) {
        pending -= 1;
        return;
      }
      ref.measureInWindow((x, y, w, h) => {
        rects[index] = { x, y, w, h };
        pending -= 1;
        if (pending === 0) slotRects.value = rects;
      });
    });
  }, [drafts.length, slotRects]);

  // Called (from JS) once a chip's pan activates, with the chip's window
  // position. Converts to picker-root coordinates for the proxy.
  const handleLift = useCallback(
    (key: string, windowX: number, windowY: number) => {
      rootRef.current?.measureInWindow((rootX, rootY) => {
        setDragProxy({ key, x: windowX - rootX, y: windowY - rootY });
      });
      measureSlots();
      onDragActiveChange(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [measureSlots, onDragActiveChange]
  );

  const handleDragFinished = useCallback(() => {
    setDragProxy(null);
    onDragActiveChange(false);
  }, [onDragActiveChange]);

  const handleDrop = useCallback((key: string, slotIndex: number) => {
    const suggestion = SUGGESTED_TAGS.find((s) => s.key === key);
    if (!suggestion) return;
    setDrafts((prev) =>
      prev.map((draft, index) =>
        index === slotIndex
          ? {
              suggestionKey: suggestion.key,
              emoji: suggestion.emoji,
              color: suggestion.color,
              customName: null,
            }
          : draft
      )
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const updateSlotName = (slotIndex: number, name: string) => {
    setDrafts((prev) =>
      prev.map((draft, index) => (index === slotIndex ? { ...draft, customName: name } : draft))
    );
  };

  const updateSlotEmoji = (slotIndex: number, emoji: string) => {
    setDrafts((prev) =>
      prev.map((draft, index) => (index === slotIndex ? { ...draft, emoji } : draft))
    );
  };

  const draggingSuggestion = dragProxy
    ? SUGGESTED_TAGS.find((s) => s.key === dragProxy.key)
    : undefined;
  const draggingColor = draggingSuggestion?.color ?? colors.primary;

  const marqueeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -scrollX.value }],
  }));

  const proxyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: proxyTX.value }, { translateY: proxyTY.value }, { scale: 1.06 }],
  }));

  return (
    <View
      ref={rootRef}
      collapsable={false}
      className="w-full self-center"
      style={{ maxWidth: 340 }}>
      {/* Suggestion marquee — a clipped strip where two copies of the pool
          drift left and wrap seamlessly. */}
      <Typography variant="body-12" color="secondary" className="mb-2">
        {t('onboarding.moreSuggestions')}
      </Typography>
      <View className="mb-6 overflow-hidden">
        <Animated.View className="flex-row" style={marqueeStyle}>
          {[0, 1].map((copy) => (
            <View
              key={copy}
              className="flex-row"
              style={{ gap: CHIP_GAP, paddingRight: CHIP_GAP }}
              onLayout={
                copy === 0
                  ? (e) => {
                      copyWidth.value = e.nativeEvent.layout.width;
                    }
                  : undefined
              }>
              {pool.map((suggestion) => (
                <DraggableChip
                  key={suggestion.key}
                  suggestion={suggestion}
                  label={t(`onboarding.suggestedTags.${suggestion.key}`)}
                  hidden={dragProxy?.key === suggestion.key}
                  slotRects={slotRects}
                  hoveredSV={hoveredSV}
                  frozen={frozen}
                  proxyTX={proxyTX}
                  proxyTY={proxyTY}
                  onLift={handleLift}
                  onDrop={handleDrop}
                  onDragFinished={handleDragFinished}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      </View>

      {/* The three chosen slots */}
      <View style={{ gap: 10 }}>
        {drafts.map((draft, index) => {
          const isHovered = dragProxy !== null && hoveredSlot === index;
          return (
            <View
              key={index}
              ref={(ref) => {
                slotViewRefs.current[index] = ref;
              }}
              collapsable={false}
              className="flex-row items-center rounded-2xl px-3 py-2.5"
              style={{
                backgroundColor: isHovered
                  ? draggingColor + '14'
                  : isDark
                    ? colors.dark.input
                    : colors.light.input,
                borderWidth: 2,
                // While dragging, all slots show a dashed drop hint; the one under
                // the finger turns solid in the dragged chip's color.
                borderColor: isHovered
                  ? draggingColor
                  : dragProxy
                    ? isDark
                      ? colors.dark.border
                      : colors.light.screenBorder
                    : 'transparent',
                borderStyle: dragProxy && !isHovered ? 'dashed' : 'solid',
              }}>
              <Pressable
                onPress={() => setEditingSlot(index)}
                hitSlop={6}
                className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: draft.color + '26' }}>
                <Text style={{ fontSize: 22 }}>{draft.emoji}</Text>
              </Pressable>
              <TextInput
                value={draft.customName ?? t(`onboarding.suggestedTags.${draft.suggestionKey}`)}
                onChangeText={(text) => updateSlotName(index, text)}
                placeholder={t('onboarding.tagNamePlaceholder')}
                placeholderTextColor={
                  isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary
                }
                maxLength={30}
                style={{
                  flex: 1,
                  fontSize: 16,
                  paddingVertical: 6,
                  color: isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary,
                }}
              />
            </View>
          );
        })}
      </View>

      {/* Drag proxy — the chip "in hand", following the finger above everything. */}
      {dragProxy && draggingSuggestion && (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: dragProxy.x, top: dragProxy.y, zIndex: 100 },
            proxyStyle,
          ]}>
          <ChipVisual
            suggestion={draggingSuggestion}
            label={t(`onboarding.suggestedTags.${draggingSuggestion.key}`)}
          />
        </Animated.View>
      )}

      <EmojiPickerModal
        visible={editingSlot !== null}
        onClose={() => setEditingSlot(null)}
        onEmojiSelect={(emoji) => {
          if (editingSlot !== null) updateSlotEmoji(editingSlot, emoji);
          setEditingSlot(null);
        }}
        title={t('home.chooseEmojiNewTag')}
      />
    </View>
  );
}

/** The chip pill itself — shared by the marquee chips and the drag proxy. */
function ChipVisual({ suggestion, label }: { suggestion: SuggestedTag; label: string }) {
  return (
    <View
      className="flex-row items-center rounded-full px-3 py-2"
      style={{
        backgroundColor: suggestion.color + '1F',
        borderWidth: 1,
        borderColor: suggestion.color + '66',
      }}>
      <Text style={{ fontSize: 15, marginRight: 5 }}>{suggestion.emoji}</Text>
      <Typography variant="body-14" color="primary">
        {label}
      </Typography>
    </View>
  );
}

interface DraggableChipProps {
  suggestion: SuggestedTag;
  label: string;
  /** True while this suggestion is "in hand" — the static chip hides under the proxy. */
  hidden: boolean;
  slotRects: SharedValue<SlotRect[]>;
  hoveredSV: SharedValue<number>;
  frozen: SharedValue<boolean>;
  proxyTX: SharedValue<number>;
  proxyTY: SharedValue<number>;
  onLift: (key: string, windowX: number, windowY: number) => void;
  onDrop: (key: string, slotIndex: number) => void;
  onDragFinished: () => void;
}

/**
 * A marquee chip that starts dragging on plain touch-and-move (no long-press).
 * Touch-down freezes the marquee immediately so the chip can't drift out from
 * under the finger; activation measures the chip and hands off all visuals to
 * the parent's drag proxy. Slot hit-testing runs per-frame on the UI thread in
 * window coordinates (matching `measureInWindow`). On release without a drop,
 * the proxy springs back to the (still frozen) lift position before the
 * marquee resumes.
 */
function DraggableChip({
  suggestion,
  label,
  hidden,
  slotRects,
  hoveredSV,
  frozen,
  proxyTX,
  proxyTY,
  onLift,
  onDrop,
  onDragFinished,
}: DraggableChipProps) {
  const chipRef = useRef<View>(null);
  const dropped = useSharedValue(false);
  const lifted = useSharedValue(false);

  const measureAndLift = useCallback(() => {
    chipRef.current?.measureInWindow((x, y) => onLift(suggestion.key, x, y));
  }, [onLift, suggestion.key]);

  const pan = Gesture.Pan()
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      // Freeze on touch-down (before activation) so the marquee stops moving
      // while the finger decides between a drag and a pager swipe.
      frozen.value = true;
    })
    .onStart((event) => {
      dropped.value = false;
      lifted.value = true;
      proxyTX.value = event.translationX;
      proxyTY.value = event.translationY;
      runOnJS(measureAndLift)();
    })
    .onUpdate((event) => {
      proxyTX.value = event.translationX;
      proxyTY.value = event.translationY;
      const rects = slotRects.value;
      let hit = -1;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (
          r &&
          event.absoluteX >= r.x &&
          event.absoluteX <= r.x + r.w &&
          event.absoluteY >= r.y &&
          event.absoluteY <= r.y + r.h
        ) {
          hit = i;
          break;
        }
      }
      hoveredSV.value = hit;
    })
    .onEnd(() => {
      if (hoveredSV.value >= 0) {
        dropped.value = true;
        runOnJS(onDrop)(suggestion.key, hoveredSV.value);
      }
    })
    .onFinalize(() => {
      hoveredSV.value = -1;
      if (!lifted.value) {
        // Never activated (a tap, or the pager swipe won) — just resume.
        frozen.value = false;
        return;
      }
      lifted.value = false;
      if (dropped.value) {
        frozen.value = false;
        runOnJS(onDragFinished)();
      } else {
        // Spring the proxy back to the lift position; the marquee stays frozen
        // until it lands so the spot is still where the chip left it.
        proxyTX.value = withSpring(0, SPRING_BACK);
        proxyTY.value = withSpring(0, SPRING_BACK, (finished) => {
          // finished is false when a new drag cancels the spring — that drag
          // now owns frozen/proxy state, so only clean up on natural landing.
          if (finished) {
            frozen.value = false;
            runOnJS(onDragFinished)();
          }
        });
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View ref={chipRef} collapsable={false} style={{ opacity: hidden ? 0 : 1 }}>
        <ChipVisual suggestion={suggestion} label={label} />
      </View>
    </GestureDetector>
  );
}
