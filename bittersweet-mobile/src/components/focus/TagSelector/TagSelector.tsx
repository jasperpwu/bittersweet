import React, { FC, useState } from 'react';
import { ScrollView, Pressable, View, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../ui/Typography';

interface Tag {
  name: string;
  icon: string;
  usageCount: number;
  isDefault?: boolean;
}

interface TagSelectorProps {
  tags: Tag[];
  selectedTags: string[];
  onTagSelect: (tagName: string) => void;
  maxSelections?: number;
  onTagDelete?: (tagName: string) => void;
}


export const TagSelector: FC<TagSelectorProps> = ({
  tags,
  selectedTags,
  onTagSelect,
  maxSelections,
  onTagDelete,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [confirmationText, setConfirmationText] = useState('');
  
  const isTagSelected = (tagName: string) => selectedTags.includes(tagName);
  
  const canSelectMore = maxSelections ? selectedTags.length < maxSelections : true;
  
  const handleDeletePress = (tag: Tag, event: any) => {
    event.stopPropagation(); // Prevent tag selection when clicking delete
    setTagToDelete(tag);
    setShowDeleteModal(true);
  };
  
  const handleConfirmDelete = () => {
    if (tagToDelete && confirmationText === tagToDelete.name && onTagDelete) {
      onTagDelete(tagToDelete.name);
      setShowDeleteModal(false);
      setTagToDelete(null);
      setConfirmationText('');
    }
  };
  
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setTagToDelete(null);
    setConfirmationText('');
  };

  return (
    <View className="relative">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-4"
        contentContainerStyle={{ paddingRight: 16 }}
      >
      {tags.map((tag) => {
        const selected = isTagSelected(tag.name);
        const disabled = !selected && !canSelectMore;
        
        return (
          <View key={tag.name} className="relative mr-3">
            <Pressable
              onPress={() => onTagSelect(tag.name)}
              disabled={disabled}
              className={`
                px-4 py-3 pr-10 rounded-full border relative
                ${selected 
                  ? 'border-white' 
                  : 'border-gray-600'
                }
                ${disabled ? 'opacity-50' : 'active:opacity-80'}
              `}
              style={{
                backgroundColor: selected ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              }}
            >
              <Typography 
                variant="body-14" 
                className="font-medium"
                style={{ color: '#FFFFFF' }}
              >
                {tag.name}
              </Typography>
            </Pressable>
            
            {/* Delete button - always visible if onTagDelete is provided */}
            {onTagDelete && (
              <Pressable
                onPress={(event) => handleDeletePress(tag, event)}
                className="absolute right-2 top-1/2 w-6 h-6 -mt-3 items-center justify-center rounded-full"
                style={{
                  backgroundColor: 'rgba(237, 223, 223, 0.8)',
                }}
              >
                <Ionicons name="trash-outline" size={12} color="white" />
              </Pressable>
            )}
          </View>
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
    </View>
  );
};