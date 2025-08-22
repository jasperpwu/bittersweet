import React, { FC } from 'react';
import { View, Modal, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  title?: string;
}

// Curated emoji collection for focus session tags
const FOCUS_EMOJIS = [
  // Work & Professional
  '💼', '💻', '📊', '📈', '📝', '📋', '🗂️', '📁', '🖥️', '⌨️', '🖱️', '📞',

  // Study & Learning
  '📚', '📖', '✏️', '📓', '📔', '🎓', '🧠', '💡', '🔬', '🧪', '📐', '🔍',

  // Creative & Arts
  '🎨', '🖌️', '✨', '🎭', '🎪', '🎬', '📸', '🎵', '🎶', '🎸', '🎹', '🎤',

  // Health & Fitness
  '💪', '🏃', '🧘', '🏋️', '🚴', '🏊', '🤸', '🧗', '⚽', '🏀', '🎾', '🏓',

  // Food & Cooking
  '🍳', '👨‍🍳', '🥗', '🍎', '🥑', '🥕', '☕', '🍵', '🥤', '🍪', '🧁', '🍰',

  // Nature & Environment
  '🌱', '🌳', '🌸', '🌺', '🌻', '🌿', '🍃', '🌲', '🌴', '🌵', '🌾', '🌙',

  // Technology & Gaming
  '📱', '⌚', '🎧', '📷', '🎮', '🕹️', '💾', '🔧', '⚙️', '🔌', '💻', '📡',

  // Goals & Achievement
  '🎯', '🏆', '🥇', '🏅', '⭐', '🌟', '💯', '✅', '🔥', '💎', '👑', '🚀'
];

export const EmojiPickerModal: FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onEmojiSelect,
  title = 'Choose Emoji'
}) => {
  const handleEmojiSelect = (emoji: string) => {
    console.log('Emoji selected:', emoji);
    onEmojiSelect(emoji);
    onClose();
  };



  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        zIndex: 99999
      }}>
        <View style={{
          backgroundColor: '#1B1C30',
          borderRadius: 20,
          width: '90%',
          height: '70%',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#575757'
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF'
            }}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#575757',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Emoji Grid */}
          <View style={{ flex: 1, padding: 20 }}>
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}>
                {FOCUS_EMOJIS.map((emoji, index) => (
                  <Pressable
                    key={`${emoji}-${index}`}
                    onPress={() => handleEmojiSelect(emoji)}
                    style={{
                      width: 48,
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 12,
                      backgroundColor: '#2A2A2A',
                      marginBottom: 12,
                      marginHorizontal: 2,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>
                      {emoji}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};