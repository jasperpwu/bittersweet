import React, { useEffect, useRef, useState } from 'react';
import { View, SafeAreaView, Pressable, Animated, Easing, Modal, Text, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui';
import { EmojiPickerModal } from '../../src/components/ui/EmojiPicker/EmojiPicker';
import { TimeScroller } from '../../src/components/focus';

// Initial mock data for tags
const initialTags = [
  { id: '1', name: 'Work', emoji: '💼' },
  { id: '2', name: 'Study', emoji: '📚' },
  { id: '3', name: 'Personal', emoji: '👤' },
  { id: '4', name: 'Exercise', emoji: '💪' },
  { id: '5', name: 'Reading', emoji: '📖' },
  { id: '6', name: 'Creative', emoji: '🎨' },
];

export default function FocusScreen() {
  const [selectedTime, setSelectedTime] = useState(10); // minutes; 0 => ∞
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tags, setTags] = useState(initialTags);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('');
  const [emojiPickerMode, setEmojiPickerMode] = useState<'edit' | 'new'>('edit');

  // Session + timer state
  const [isSessionActive, setIsSessionActive] = useState(false); // true during transition or running
  const [isRunning, setIsRunning] = useState(false);
  const [isInfinite, setIsInfinite] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transitionCancelledRef = useRef(false);

  // Animation refs
  const scrollerOpacity = useRef(new Animated.Value(1)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(0.94)).current;
  const timerTranslateY = useRef(new Animated.Value(6)).current;
  const tagsOpacity = useRef(new Animated.Value(1)).current;

  const handleTagSelect = (tagId: string) => {
    setSelectedTags([tagId]); // Single choice - replace with new selection
    setShowTagModal(false); // Close modal immediately
  };

  const handleEmojiPress = (tagId: string) => {
    console.log('🎯 Emoji button pressed for tag:', tagId);
    // Close the tag modal first, then show emoji picker
    setShowTagModal(false);
    setEditingTagId(tagId);
    setEmojiPickerMode('edit');
    setShowEmojiPicker(true);
    console.log('🎯 showEmojiPicker set to true');
  };

  const handleNewTagEmojiPress = () => {
    setShowNewTagModal(false);
    setEmojiPickerMode('new');
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emoji: string) => {
    if (emojiPickerMode === 'edit' && editingTagId) {
      // Update existing tag emoji
      setTags(prevTags =>
        prevTags.map(tag =>
          tag.id === editingTagId
            ? { ...tag, emoji }
            : tag
        )
      );
      setEditingTagId(null);
      // Close emoji picker and reopen tag modal
      setShowEmojiPicker(false);
      setShowTagModal(true);
    } else if (emojiPickerMode === 'new') {
      // Set emoji for new tag
      setNewTagEmoji(emoji);
      setShowEmojiPicker(false);
      setShowNewTagModal(true);
    }
  };

  const handleCreateNewTag = () => {
    if (newTagName.trim() && newTagEmoji) {
      const newTag = {
        id: Date.now().toString(),
        name: newTagName.trim(),
        emoji: newTagEmoji,
      };

      setTags(prevTags => [...prevTags, newTag]);
      setShowNewTagModal(false);
      setNewTagName('');
      setNewTagEmoji('');
    }
  };

  const resetToIdleVisuals = () => {
    scrollerOpacity.setValue(1);
    tagsOpacity.setValue(1);
    timerOpacity.setValue(0);
    timerScale.setValue(0.94);
    timerTranslateY.setValue(6);
  };

  const startTimer = () => {
    const infinite = selectedTime === 0;
    setIsInfinite(infinite);
    setIsRunning(true);

    if (infinite) {
      setElapsedSeconds(0);
    } else {
      setRemainingSeconds(selectedTime * 60);
    }

    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = setInterval(() => {
      if (infinite) {
        setElapsedSeconds(prev => prev + 1);
      } else {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current as any);
            timerRef.current = null;
            setIsRunning(false);
            setIsSessionActive(false);
            // Reverse to scroller view at the end
            Animated.parallel([
              Animated.timing(timerOpacity, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(timerScale, { toValue: 0.96, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(timerTranslateY, { toValue: 6, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            ]).start(() => {
              Animated.parallel([
                Animated.timing(scrollerOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
                Animated.timing(tagsOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              ]).start();
            });
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
  };

  const stopCompletely = () => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;
    setIsRunning(false);
    setIsSessionActive(false);
  };

  const stopWithAnimation = () => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    timerRef.current = null;
    setIsRunning(false);

    Animated.parallel([
      Animated.timing(timerOpacity, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(timerScale, { toValue: 0.96, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(timerTranslateY, { toValue: 6, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      Animated.parallel([
        Animated.timing(scrollerOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagsOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        setIsSessionActive(false);
      });
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
    };
  }, []);

  const handleStartFocus = () => {
    // If running or transitioning, treat as Stop/Cancel immediately
    if (isRunning || isSessionActive) {
      transitionCancelledRef.current = true;
      // Cancel any in-flight animations and reset visuals
      resetToIdleVisuals();
      stopCompletely();
      return;
    }

    // Start flow: switch button to Stop immediately
    setIsSessionActive(true);
    transitionCancelledRef.current = false;

    // Prepare timer visuals for entrance
    timerOpacity.setValue(0);
    timerScale.setValue(0.94);
    timerTranslateY.setValue(6);

    // Fade out scroller and tags first to avoid layout shifts
    Animated.parallel([
      Animated.timing(scrollerOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(tagsOpacity, { toValue: 0, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      if (transitionCancelledRef.current) return;
      Animated.parallel([
        Animated.timing(timerOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(timerScale, { toValue: 1, stiffness: 220, damping: 20, mass: 0.6, useNativeDriver: true }),
        Animated.spring(timerTranslateY, { toValue: 0, stiffness: 220, damping: 20, mass: 0.6, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !transitionCancelledRef.current) startTimer();
      });
    });
  };

  const handleTimeChange = (time: number) => {
    setSelectedTime(time);
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const displayTime = isInfinite ? formatTime(elapsedSeconds) : formatTime(remainingSeconds);

  const selectedTagName = selectedTags.length > 0 ? tags.find(tag => tag.id === selectedTags[0])?.name : null;

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <Pressable className="w-10 h-10 rounded-full bg-gray-700 items-center justify-center">
          <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center px-4">
        {/* Time Selector or Running Timer - stacked and crossfaded */}
        <View style={{ height: 240, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          <Animated.View style={{ position: 'absolute', opacity: scrollerOpacity, width: '100%', zIndex: 0 }} pointerEvents={isRunning ? 'none' : 'auto'}>
            <TimeScroller
              selectedTime={selectedTime}
              onTimeChange={handleTimeChange}
            />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', opacity: timerOpacity, transform: [{ scale: timerScale }, { translateY: timerTranslateY }], zIndex: 100 }}>
            <Animated.Text
              style={{ fontSize: 96, lineHeight: 104, color: '#FFFFFF', fontFamily: 'Poppins-Bold', textAlign: 'center' }}
            >
              {displayTime}
            </Animated.Text>
          </Animated.View>
        </View>

        {/* Focus Button (kept mounted, fade only) */}
        <View style={{ width: '100%', marginBottom: 64, minHeight: 96, justifyContent: 'center' }}>
          <Animated.View style={{ opacity: tagsOpacity }} pointerEvents={isRunning ? 'none' : 'auto'}>
            <Pressable
              onPress={() => setShowTagModal(true)}
              className="bg-gray-700 rounded-2xl py-4 px-6 flex-row items-center justify-between active:opacity-80"
            >
              <View className="flex-row items-center">
                <Typography variant="subtitle-16" color="white">
                  {selectedTagName || 'Focus'}
                </Typography>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* Start/Stop Button - Fixed at bottom */}
      <View className="px-4 pb-8">
        <Pressable
          onPress={handleStartFocus}
          className="bg-white rounded-2xl py-4 items-center active:opacity-80"
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
            style={{ color: '#1B1C30' }}
          >
            {isSessionActive ? 'Stop' : 'Start Focus'}
          </Typography>
        </Pressable>
      </View>

      {/* Tag Selection Modal */}
      <Modal
        visible={showTagModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTagModal(false)}
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
          <View className="bg-dark-bg rounded-3xl w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-6 border-b border-gray-700">
              <Typography variant="headline-20" color="white">
                Select Focus
              </Typography>
              <Pressable
                onPress={() => setShowTagModal(false)}
                className="w-8 h-8 rounded-full bg-gray-700 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Tags List */}
            <View className="p-4">
              {tags.map((tag) => (
                <Pressable
                  key={tag.id}
                  onPress={() => handleTagSelect(tag.id)}
                  className={`mb-3 rounded-2xl p-4 flex-row items-center ${selectedTags.includes(tag.id) ? 'bg-primary bg-opacity-20 border border-primary' : 'bg-gray-700'
                    }`}
                >
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEmojiPress(tag.id);
                    }}
                    className="w-10 h-10 items-center justify-center mr-3 rounded-lg bg-gray-600 active:bg-gray-500 border border-gray-500"
                  >
                    <Text className="text-xl">
                      {tag.emoji}
                    </Text>
                  </Pressable>
                  <View className="flex-1">
                    <Typography
                      variant="subtitle-16"
                      color="white"
                      className={selectedTags.includes(tag.id) ? 'font-semibold' : ''}
                    >
                      {tag.name}
                    </Typography>
                    {selectedTags.includes(tag.id) && (
                      <Typography variant="body-12" color="primary" className="mt-1">
                        Selected
                      </Typography>
                    )}
                  </View>
                  <View className="ml-2">
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color="#6592E9"
                    />
                  </View>
                </Pressable>
              ))}
            </View>

            {/* New Tag Button */}
            <View className="p-4 border-t border-gray-700">
              <Pressable
                onPress={() => {
                  setShowTagModal(false);
                  setShowNewTagModal(true);
                }}
                className="bg-blue-600 rounded-2xl py-4 items-center active:opacity-80"
              >
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  New Tag
                </Typography>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Tag Creation Modal */}
      <Modal
        visible={showNewTagModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewTagModal(false)}
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
          <View className="bg-dark-bg rounded-3xl w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between p-6 border-b border-gray-700">
              <Typography variant="headline-20" color="white">
                Create New Tag
              </Typography>
              <Pressable
                onPress={() => setShowNewTagModal(false)}
                className="w-8 h-8 rounded-full bg-gray-700 items-center justify-center"
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* New Tag Form */}
            <View className="p-6">
              {/* Emoji Selection */}
              <View className="mb-6">
                <Typography variant="body-14" color="white" className="mb-3">
                  Choose Emoji
                </Typography>
                <Pressable
                  onPress={handleNewTagEmojiPress}
                  className="bg-gray-700 rounded-2xl p-6 items-center active:opacity-80 border-2 border-dashed border-gray-500"
                >
                  {newTagEmoji ? (
                    <View className="items-center">
                      <Text className="text-5xl mb-2">
                        {newTagEmoji}
                      </Text>
                      <Typography variant="body-12" color="secondary">
                        Tap to change
                      </Typography>
                    </View>
                  ) : (
                    <View className="items-center py-2">
                      <Ionicons name="happy-outline" size={36} color="#6592E9" />
                      <Typography variant="body-14" color="primary" className="mt-2 font-medium">
                        Select Emoji
                      </Typography>
                      <Typography variant="body-12" color="secondary" className="mt-1">
                        Tap to choose from collection
                      </Typography>
                    </View>
                  )}
                </Pressable>
              </View>

              {/* Tag Name Input */}
              <View className="mb-6">
                <Typography variant="body-14" color="white" className="mb-3">
                  Tag Name
                </Typography>
                <TextInput
                  value={newTagName}
                  onChangeText={setNewTagName}
                  placeholder="Enter tag name"
                  placeholderTextColor="#666"
                  style={{
                    backgroundColor: '#2A2A2A',
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: '#444',
                  }}
                  autoFocus={true}
                />
              </View>
            </View>

            {/* Action Buttons */}
            <View className="p-4 border-t border-gray-700 flex-row space-x-3">
              <Pressable
                onPress={() => {
                  setShowNewTagModal(false);
                  setNewTagName('');
                  setNewTagEmoji('');
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
          </View>
        </View>
      </Modal>



      {/* Emoji Picker */}
      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => {
          setShowEmojiPicker(false);
          if (emojiPickerMode === 'edit') {
            setEditingTagId(null);
            setShowTagModal(true);
          } else {
            setShowNewTagModal(true);
          }
        }}
        onEmojiSelect={handleEmojiSelect}
        title={emojiPickerMode === 'edit' ? 'Change Emoji' : 'Choose Emoji for New Tag'}
      />
    </SafeAreaView>
  );
}