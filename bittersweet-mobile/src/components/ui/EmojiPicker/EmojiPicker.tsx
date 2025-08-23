import React, { FC } from 'react';
import { View, Modal, Pressable, ScrollView, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../Typography';

interface EmojiPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  title?: string;
}

const EMOJI_CATEGORIES = {
  'Smileys & People': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
  'Activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️'],
  'Objects': ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️'],
  'Nature': ['🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🍄', '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑'],
  'Food & Drink': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔'],
};

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
      <View className="flex-1 bg-black bg-opacity-50 justify-end">
        <View className="bg-dark-bg rounded-t-3xl max-h-96">
          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b border-gray-700">
            <Typography variant="headline-20" color="white">
              {title}
            </Typography>
            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-gray-700 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Emoji Grid */}
          <ScrollView className="flex-1 p-4">
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
                      className="w-12 h-12 items-center justify-center m-1 rounded-lg bg-gray-700 active:bg-gray-600"
                    >
                      <Text className="text-2xl">
                        {emoji}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};