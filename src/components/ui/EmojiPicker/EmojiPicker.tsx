import React, { FC } from 'react';
import { View, Modal, Pressable, ScrollView, Text, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../Typography';
import { SheetOverlay } from '../BottomSheet';

interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  title?: string;
}

export const EMOJI_CATEGORIES = {
  'General': ['🏃', '💻', '📖', '🧹', '🧠', '🎨', '🎵', '✍️', '🧘', '💪', '🍳', '🛠️', '📷', '🌱', '💤'],
  'Sports': ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🥋', '⛳', '🏊', '🚴', '🧗', '⛷️', '🏋️', '🤸'],
  'Music': ['🎹', '🎸', '🎻', '🥁', '🎷', '🎺', '🪕', '🪗', '🎤'],
  'Study & Work': ['📝', '📚', '🔬', '🔭', '🧪', '📐', '🖊️', '📊', '🗂️'],
  'Creative': ['🖌️', '✏️', '🖍️', '📸', '🎬', '🧶', '🪡', '🏺', '🎭'],
  'Outdoors': ['🥾', '🏕️', '🎣', '🚣', '🏄', '🧭', '🌿', '🌻', '⛺'],
  'Wellness': ['🧘', '🛁', '💆', '🍵', '📿', '🕯️', '💊', '🩺', '❤️‍🩹'],
  'Home & Life': ['🏠', '🧺', '🪴', '🐕', '🐈', '👶', '🍽️', '🛒', '📦'],
};

/**
 * Header row (title, plus an optional close button). The sheet overlay dismisses
 * via drag / backdrop so it omits `onClose`; the centered Modal variant, which
 * has neither, passes it to show an X.
 */
const EmojiPickerHeader: FC<{ title: string; onClose?: () => void }> = ({ title, onClose }) => {
  const colorScheme = useColorScheme();
  const closeIconColor = colorScheme === 'dark' ? '#FFFFFF' : '#5D4E37';
  return (
    <View className="flex-row items-center justify-between px-6 pb-4 pt-1">
      <Typography variant="headline-20" color="primary">
        {title}
      </Typography>
      {onClose && (
        <Pressable
          onPress={onClose}
          className="w-8 h-8 rounded-full bg-light-border/30 dark:bg-gray-700 items-center justify-center">
          <Ionicons name="close" size={20} color={closeIconColor} />
        </Pressable>
      )}
    </View>
  );
};

/** Emoji category grid (no scroll container) — the caller provides scrolling. */
const EmojiGridBody: FC<{ onEmojiSelect: (emoji: string) => void }> = ({ onEmojiSelect }) => (
  <View className="px-4">
    {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
      <View key={category} className="mb-6">
        <Typography variant="body-14" color="secondary" className="mb-3">
          {category}
        </Typography>
        <View className="flex-row flex-wrap">
          {emojis.map((emoji, index) => (
            <Pressable
              key={index}
              onPress={() => onEmojiSelect(emoji)}
              className="w-12 h-12 items-center justify-center m-1 rounded-lg bg-light-border/30 dark:bg-gray-700 active:bg-light-border dark:active:bg-gray-600">
              <Text className="text-2xl">{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    ))}
  </View>
);

/** Scrollable emoji grid used by the centered Modal variant. */
const EmojiGrid: FC<{ onEmojiSelect: (emoji: string) => void }> = ({ onEmojiSelect }) => (
  <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
    <EmojiGridBody onEmojiSelect={onEmojiSelect} />
  </ScrollView>
);

/** Centered card used by the Modal variant. */
const EmojiPickerCard: FC<{
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  title: string;
}> = ({ onClose, onEmojiSelect, title }) => (
  <View className="bg-light-bg dark:bg-dark-bg rounded-3xl w-11/12 h-3/5 pt-5">
    <EmojiPickerHeader title={title} onClose={onClose} />
    <EmojiGrid onEmojiSelect={onEmojiSelect} />
  </View>
);

export const EmojiPickerModal: FC<EmojiPickerModalProps> = ({
  visible,
  onClose,
  onEmojiSelect,
  title = 'Choose Emoji',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        <EmojiPickerCard onClose={onClose} onEmojiSelect={onEmojiSelect} title={title} />
      </View>
    </Modal>
  );
};

/**
 * Overlay variant of the emoji picker — an in-place bottom sheet (SheetOverlay),
 * not a native `<Modal>`, so it can render on top of content already inside a
 * presented Modal (e.g. the New Tag / Edit Tag sheets) without stacking two
 * native modals, which is unreliable on iOS. Slides up with a grab handle and
 * drag-to-dismiss to match the surrounding sheets. The caller gates rendering
 * (`{visible && <EmojiPickerOverlay .../>}`).
 */
export const EmojiPickerOverlay: FC<Omit<EmojiPickerModalProps, 'visible'>> = ({
  onClose,
  onEmojiSelect,
  title = 'Choose Emoji',
}) => {
  return (
    <SheetOverlay onClose={onClose} heightRatio={0.6}>
      <EmojiPickerHeader title={title} />
      <EmojiGridBody onEmojiSelect={onEmojiSelect} />
    </SheetOverlay>
  );
};