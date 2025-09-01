import React, { useEffect, useRef, useState } from 'react';
import { View, SafeAreaView, Pressable, Animated, Easing, Modal, Text, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui';
import { EmojiPickerModal } from '../../src/components/ui/EmojiPicker/EmojiPicker';
import { TimeScroller } from '../../src/components/focus';
import { NotesModal } from '../../src/components/modals/NotesModal';
import { useFocus, useFocusActions, useRewards } from '../../src/store';
import { FruitCounter } from '../../src/components/rewards';

export default function FocusScreen() {
  // Get tags from store
  const { tags } = useFocus();
  const { createTag, updateTag, deleteTag, startSession, completeSession, createCompletedSession } = useFocusActions();
  const rewards = useRewards();
  const availableTags = tags.allNames.map(name => tags.byName[name]).filter(Boolean);
  
  const [selectedTime, setSelectedTime] = useState(10); // minutes; 0 => ∞
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Set default tag to first available tag on mount
  useEffect(() => {
    if (availableTags.length > 0 && !selectedTag) {
      setSelectedTag(availableTags[0].name);
    }
  }, [availableTags, selectedTag]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewTagModal, setShowNewTagModal] = useState(false);
  const [editingTagName, setEditingTagName] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('');
  const [emojiPickerMode, setEmojiPickerMode] = useState<'edit' | 'new'>('edit');
  
  // Delete functionality
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<any>(null);
  const [confirmationText, setConfirmationText] = useState('');
  
  // Notes modal state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');

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

  const handleTagSelect = (tagName: string) => {
    setSelectedTag(tagName); // Single choice - set selected tag
    setShowTagModal(false); // Close modal immediately
  };

  const handleEmojiPress = (tagName: string) => {
    console.log('🎯 Emoji button pressed for tag:', tagName);
    // Close the tag modal first, then show emoji picker
    setShowTagModal(false);
    setEditingTagName(tagName);
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
    if (emojiPickerMode === 'edit' && editingTagName) {
      // Update existing tag
      updateTag(editingTagName, { icon: emoji });
      setEditingTagName(null);
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
      // Create tag using store action
      createTag({
        name: newTagName.trim(),
        icon: newTagEmoji,
      });
      
      setShowNewTagModal(false);
      setNewTagName('');
      setNewTagEmoji('');
    }
  };
  
  const handleDeleteTag = (tag: any, event: any) => {
    event.stopPropagation(); // Prevent tag selection when clicking delete
    setTagToDelete(tag);
    setShowDeleteModal(true);
    // Keep tag modal open - don't call setShowTagModal(false)
  };
  
  const handleConfirmDelete = () => {
    if (tagToDelete && confirmationText === tagToDelete.name) {
      deleteTag(tagToDelete.name);
      // If deleted tag was selected, reset selection
      if (selectedTag === tagToDelete.name) {
        const remainingTags = availableTags.filter(t => t.name !== tagToDelete.name);
        setSelectedTag(remainingTags.length > 0 ? remainingTags[0].name : null);
      }
      setShowDeleteModal(false);
      setTagToDelete(null);
      setConfirmationText('');
      // Tag modal remains open after deletion
    }
  };
  
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setTagToDelete(null);
    setConfirmationText('');
    // Tag modal remains open
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
              ]).start(() => {
                // Show notes modal after session completes
                setShowNotesModal(true);
              });
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
        // Show notes modal after stopping
        setShowNotesModal(true);
      });
    });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current as any);
    };
  }, []);

  const handleStartFocus = () => {
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

  const selectedTagName = selectedTag ? availableTags.find(tag => tag.name === selectedTag)?.name : null;

  const handleNotesSave = (notes: string) => {
    setSessionNotes(notes);
    console.log('Session completed with notes:', notes);
    
    const actualDuration = isInfinite ? Math.floor(elapsedSeconds / 60) : selectedTime - Math.floor(remainingSeconds / 60);
    
    // Only create session if duration is meaningful (1+ minutes)
    if (actualDuration >= 1) {
      const startTime = new Date(Date.now() - (isInfinite ? elapsedSeconds * 1000 : (selectedTime * 60 * 1000 - remainingSeconds * 1000)));
      const endTime = new Date();
      
      // Use the store action to create and save the completed session
      createCompletedSession({
        startTime,
        endTime,
        duration: actualDuration,
        targetDuration: isInfinite ? actualDuration : selectedTime,
        tagName: selectedTag!,
        notes: notes,
      });
    }
  };

  const handleNotesClose = () => {
    setShowNotesModal(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Fruit Counter - Top Left */}
      <View className="absolute top-12 left-4 z-50">
        <FruitCounter fruitCount={rewards.balance} size="small" />
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
                  {availableTags.length === 0 ? 'Create a new tag' : (selectedTagName || 'Select a tag')}
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
            {isSessionActive ? 'Stop' : (availableTags.length === 0 ? 'Create Tag First' : 'Start Focus')}
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
              {availableTags.map((tag) => (
                <View
                  key={tag.name}
                  className={`mb-3 rounded-2xl p-4 pr-12 flex-row items-center relative ${selectedTag === tag.name ? 'bg-primary bg-opacity-20 border border-primary' : 'bg-gray-700'
                    }`}
                >
                  <Pressable
                    onPress={() => handleTagSelect(tag.name)}
                    className="flex-1 flex-row items-center"
                  >
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleEmojiPress(tag.name);
                    }}
                    className="w-10 h-10 items-center justify-center mr-3 rounded-lg bg-gray-600 active:bg-gray-500 border border-gray-500"
                  >
                    <Text className="text-xl">
                      {tag.icon || '🏷️'}
                    </Text>
                  </Pressable>
                  <View className="flex-1">
                    <Typography
                      variant="subtitle-16"
                      color="white"
                      className={selectedTag === tag.name ? 'font-semibold' : ''}
                    >
                      {tag.name}
                    </Typography>
                    {selectedTag === tag.name && (
                      <Typography variant="body-12" color="primary" className="mt-1">
                        Selected
                      </Typography>
                    )}
                  </View>
                  </Pressable>
                  
                  {/* Delete button */}
                  <Pressable
                    onPress={(event) => handleDeleteTag(tag, event)}
                    className="absolute right-3 top-1/2 w-8 h-8 -mt-4 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: 'rgba(237, 223, 223, 0.8)',
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color="white" />
                  </Pressable>
                </View>
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
            
            {/* Delete Confirmation Popup - appears as overlay within tag modal */}
            {showDeleteModal && (
              <View className="absolute inset-0 bg-black bg-opacity-70 rounded-3xl flex-1 justify-center items-center p-4">
                <View className="bg-gray-800 rounded-2xl w-full max-w-xs">
                  {/* Delete Popup Header */}
                  <View className="p-4 border-b border-gray-700">
                    <Typography variant="headline-18" color="white" className="text-center">
                      Delete Tag
                    </Typography>
                  </View>
                  
                  {/* Warning content */}
                  <View className="p-4">
                    <View className="bg-red-900 bg-opacity-30 border border-red-500 rounded-xl p-3 mb-4">
                      <View className="flex-row items-center mb-2">
                        <Ionicons name="warning" size={18} color="#EF4444" />
                        <Typography variant="subtitle-16" color="white" className="ml-2 font-semibold">
                          Warning
                        </Typography>
                      </View>
                      <Typography variant="body-12" color="white" className="leading-4">
                        Deleting "{tagToDelete?.name}" will permanently remove all associated focus sessions. This cannot be undone.
                      </Typography>
                    </View>
                    
                    {/* Confirmation input */}
                    <View className="mb-4">
                      <Typography variant="body-12" color="white" className="mb-2">
                        Type <Typography variant="body-12" className="font-semibold text-white">{tagToDelete?.name}</Typography> to confirm:
                      </Typography>
                      <TextInput
                        value={confirmationText}
                        onChangeText={setConfirmationText}
                        placeholder={`Type "${tagToDelete?.name}" here`}
                        placeholderTextColor="#666"
                        style={{
                          backgroundColor: '#2A2A2A',
                          borderRadius: 8,
                          padding: 12,
                          fontSize: 14,
                          color: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: confirmationText === tagToDelete?.name ? '#EF4444' : '#444',
                        }}
                        autoFocus={true}
                      />
                    </View>
                  </View>
                  
                  {/* Action buttons */}
                  <View className="p-3 border-t border-gray-700 flex-row space-x-2">
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
                      disabled={confirmationText !== tagToDelete?.name}
                      className={`flex-1 rounded-xl py-3 items-center ${
                        confirmationText === tagToDelete?.name 
                          ? 'bg-red-600 active:opacity-80' 
                          : 'bg-gray-500 opacity-50'
                      }`}
                    >
                      <Typography variant="body-14" color="white" className="font-semibold">
                        Delete
                      </Typography>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
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

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-center items-center px-4">
          <View className="bg-gray-800 rounded-3xl w-full max-w-sm overflow-hidden">
            {/* Modal Header */}
            <View className="p-6 border-b border-gray-700">
              <Typography variant="headline-20" color="white" className="text-center">
                Delete Tag
              </Typography>
            </View>
            
            {/* Warning content */}
            <View className="p-6">
              <View className="bg-red-900 bg-opacity-30 border border-red-500 rounded-xl p-4 mb-4">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="warning" size={20} color="#EF4444" />
                  <Typography variant="subtitle-16" color="white" className="ml-2 font-semibold">
                    Warning
                  </Typography>
                </View>
                <Typography variant="body-14" color="white" className="leading-5">
                  Deleting this tag will permanently remove all focus sessions associated with "{tagToDelete?.name}". This action cannot be undone.
                </Typography>
              </View>
              
              {/* Confirmation input */}
              <View className="mb-4">
                <Typography variant="body-14" color="white" className="mb-3">
                  To confirm deletion, type the tag name: <Typography variant="body-14" className="font-semibold text-white">{tagToDelete?.name}</Typography>
                </Typography>
                <TextInput
                  value={confirmationText}
                  onChangeText={setConfirmationText}
                  placeholder={`Type "${tagToDelete?.name}" here`}
                  placeholderTextColor="#666"
                  style={{
                    backgroundColor: '#2A2A2A',
                    borderRadius: 12,
                    padding: 16,
                    fontSize: 16,
                    color: '#FFFFFF',
                    borderWidth: 1,
                    borderColor: confirmationText === tagToDelete?.name ? '#EF4444' : '#444',
                  }}
                  autoFocus={true}
                />
              </View>
            </View>
            
            {/* Action buttons */}
            <View className="p-4 border-t border-gray-700 flex-row space-x-3">
              <Pressable
                onPress={handleCancelDelete}
                className="flex-1 bg-gray-600 rounded-2xl py-4 items-center active:opacity-80"
              >
                <Typography variant="subtitle-16" color="white">
                  Cancel
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleConfirmDelete}
                disabled={confirmationText !== tagToDelete?.name}
                className={`flex-1 rounded-2xl py-4 items-center ${
                  confirmationText === tagToDelete?.name 
                    ? 'bg-red-600 active:opacity-80' 
                    : 'bg-gray-500 opacity-50'
                }`}
              >
                <Typography variant="subtitle-16" color="white" className="font-semibold">
                  Delete Tag
                </Typography>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notes Modal */}
      <NotesModal
        visible={showNotesModal}
        onClose={handleNotesClose}
        onSave={handleNotesSave}
        initialNotes={sessionNotes}
      />
    </SafeAreaView>
  );
}