import React, { FC } from 'react';
import { ScrollView, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface TagSelectorProps {
  tags: Tag[];
  selectedTags: string[];
  onTagSelect: (tagId: string) => void;
  maxSelections?: number;
}


export const TagSelector: FC<TagSelectorProps> = ({
  tags,
  selectedTags,
  onTagSelect,
  maxSelections,
}) => {
  const isTagSelected = (tagId: string) => selectedTags.includes(tagId);
  
  const canSelectMore = maxSelections ? selectedTags.length < maxSelections : true;

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      className="px-4"
      contentContainerStyle={{ paddingRight: 16 }}
    >
      {tags.map((tag) => {
        const selected = isTagSelected(tag.id);
        const disabled = !selected && !canSelectMore;
        
        return (
          <Pressable
            key={tag.id}
            onPress={() => onTagSelect(tag.id)}
            disabled={disabled}
            className={`
              px-4 py-3 rounded-full mr-3 border
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
        );
      })}
    </ScrollView>
  );
};