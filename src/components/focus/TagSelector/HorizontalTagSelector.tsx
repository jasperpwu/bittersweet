import React, { FC, useState } from 'react';
import { ScrollView, Pressable, View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Typography } from '../../ui/Typography';

interface Tag {
  id: string;
  name: string;
  icon: string;
  usageCount: number;
  isDefault?: boolean;
}

interface HorizontalTagSelectorProps {
  tags: Tag[];
  selectedTags: string[]; // tag IDs
  onTagSelect: (tagId: string) => void;
  maxSelections?: number;
  onTagDelete?: (tagId: string) => void;
  onTagReorder?: (reorderedTags: Tag[]) => void;
}


export const HorizontalTagSelector: FC<HorizontalTagSelectorProps> = ({
  tags,
  selectedTags,
  onTagSelect,
  maxSelections,
  onTagDelete,
  onTagReorder,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  
  const isTagSelected = (tagId: string) => selectedTags.includes(tagId);
  
  const canSelectMore = maxSelections ? selectedTags.length < maxSelections : true;
  
  const handleDeletePress = (tag: Tag, event: any) => {
    event.stopPropagation(); // Prevent tag selection when clicking delete
    setTagToDelete(tag);
    setShowDeleteModal(true);
  };
  
  const handleConfirmDelete = () => {
    if (tagToDelete && onTagDelete) {
      onTagDelete(tagToDelete.id);
      setShowDeleteModal(false);
      setTagToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setTagToDelete(null);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (!onTagReorder || fromIndex === toIndex) return;
    
    const reorderedTags = [...tags];
    const [movedTag] = reorderedTags.splice(fromIndex, 1);
    reorderedTags.splice(toIndex, 0, movedTag);
    
    onTagReorder(reorderedTags);
  };

  // DraggableTag component
  const DraggableTag: FC<{
    tag: Tag;
    index: number;
    selected: boolean;
    disabled: boolean;
    onSelect: () => void;
    onDelete?: (tag: Tag, event: any) => void;
    onReorder: (fromIndex: number, toIndex: number) => void;
    isDragging: boolean;
  }> = ({ tag, index, selected, disabled, onSelect, onDelete, onReorder, isDragging }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);
    const zIndex = useSharedValue(0);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: zIndex.value,
      elevation: zIndex.value,
    }));

    const gestureHandler = useAnimatedGestureHandler({
      onStart: () => {
        runOnJS(setDraggingIndex)(index);
        scale.value = withSpring(1.1);
        zIndex.value = 1000;
      },
      onActive: (event) => {
        translateX.value = event.translationX;
        translateY.value = event.translationY;

        // Calculate new position based on horizontal movement
        const tagWidth = 120; // Approximate tag width
        const newIndex = Math.round(event.translationX / tagWidth) + index;
        const clampedIndex = Math.max(0, Math.min(newIndex, tags.length - 1));
        
        if (clampedIndex !== index) {
          runOnJS(onReorder)(index, clampedIndex);
        }
      },
      onEnd: () => {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(1);
        zIndex.value = withSpring(0);
        runOnJS(setDraggingIndex)(null);
      },
    });

    return (
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={!!onTagReorder}>
        <Animated.View 
          style={[animatedStyle]} 
          className="relative mr-3"
        >
          <Pressable
            onPress={onSelect}
            disabled={disabled}
            className={`
              px-4 py-2.5 ${onDelete ? 'pr-10' : ''} rounded-xl relative
              ${selected
                ? 'bg-primary'
                : 'bg-dark-border'
              }
              ${disabled ? 'opacity-50' : 'active:opacity-80'}
              ${isDragging ? 'shadow-lg' : ''}
            `}
          >
            <Typography
              variant="body-14"
              className="text-center"
              style={{ color: '#FFFFFF' }}
            >
              {tag.name}
            </Typography>
          </Pressable>
          
          {/* Delete button - always visible if onDelete is provided */}
          {onDelete && (
            <Pressable
              onPress={(event) => onDelete(tag, event)}
              className="absolute right-2 top-1/2 w-6 h-6 -mt-3 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(237, 223, 223, 0.8)',
              }}
            >
              <Ionicons name="trash-outline" size={12} color="white" />
            </Pressable>
          )}
        </Animated.View>
      </PanGestureHandler>
    );
  };

  return (
    <View className="relative">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-4"
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {tags.map((tag, index) => {
          const selected = isTagSelected(tag.id);
          const disabled = !selected && (maxSelections === 1 ? false : !canSelectMore);
          const isDragging = draggingIndex === index;

          return (
            <DraggableTag
              key={tag.id}
              tag={tag}
              index={index}
              selected={selected}
              disabled={disabled}
              onSelect={() => onTagSelect(tag.id)}
              onDelete={onTagDelete ? handleDeletePress : undefined}
              onReorder={handleReorder}
              isDragging={isDragging}
            />
          );
        })}
      </ScrollView>
    
    
    {/* Delete confirmation modal */}
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
            <Typography variant="body-14" color="white" className="leading-5">
              Deleting "{tagToDelete?.name}" will permanently remove all focus sessions associated with it. This action cannot be undone.
            </Typography>
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
              className="flex-1 rounded-2xl py-4 items-center bg-red-600 active:opacity-80"
            >
              <Typography variant="subtitle-16" color="white" className="font-semibold">
                Delete Tag
              </Typography>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
};