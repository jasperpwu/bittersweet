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
              px-4 py-2 rounded-full mr-2 border
              ${selected 
                ? 'bg-primary border-primary' 
                : 'bg-transparent border-light-border dark:border-dark-border'
              }
              ${disabled ? 'opacity-50' : 'active:opacity-80'}
            `}
          >
            <Typography 
              variant="body-14" 
              color={selected ? 'white' : 'primary'}
            >
              {tag.name}
            </Typography>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};