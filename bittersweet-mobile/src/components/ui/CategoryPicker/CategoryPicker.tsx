import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../Typography';

export interface TaskCategory {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

interface CategoryPickerProps {
  categories?: TaskCategory[];
  selectedCategory?: string;
  onSelect: (categoryId: string) => void;
  label?: string;
  error?: string;
}

const DEFAULT_CATEGORIES: TaskCategory[] = [
  {
    id: 'reading',
    name: 'Reading',
    icon: 'book-outline',
    color: '#51BC6F', // Green
  },
  {
    id: 'sport',
    name: 'Sport',
    icon: 'fitness-outline',
    color: '#FF9800', // Orange
  },
  {
    id: 'music',
    name: 'Music',
    icon: 'musical-notes-outline',
    color: '#9C27B0', // Purple
  },
  {
    id: 'meditation',
    name: 'Meditation',
    icon: 'leaf-outline',
    color: '#4CAF50', // Light Green
  },
  {
    id: 'code',
    name: 'Code',
    icon: 'code-slash-outline',
    color: '#EF786C', // Red
  },
  {
    id: 'it',
    name: 'IT',
    icon: 'laptop-outline',
    color: '#6592E9', // Blue
  },
];

export const CategoryPicker: FC<CategoryPickerProps> = ({
  categories = DEFAULT_CATEGORIES,
  selectedCategory,
  onSelect,
  label,
  error,
}) => {
  return (
    <View className="w-full">
      {label && (
        <Typography variant="subtitle-14-medium" color="white" className="mb-3">
          {label}
        </Typography>
      )}
      
      <View className="flex-row flex-wrap justify-between">
        {categories.map((category) => {
          const isSelected = selectedCategory === category.id;
          
          return (
            <Pressable
              key={category.id}
              onPress={() => onSelect(category.id)}
              className={`
                w-[30%] aspect-square
                items-center justify-center
                rounded-2xl mb-4
                ${isSelected 
                  ? 'border-2' 
                  : 'border border-dark-border'
                }
                active:opacity-80
              `}
              style={{
                borderColor: isSelected ? category.color : '#575757',
                backgroundColor: isSelected ? `${category.color}20` : 'transparent',
              }}
              accessibilityRole="button"
              accessibilityLabel={`Select ${category.name} category`}
              accessibilityState={{ selected: isSelected }}
            >
              <View 
                className="w-12 h-12 rounded-full items-center justify-center mb-2"
                style={{ backgroundColor: category.color }}
              >
                <Ionicons 
                  name={category.icon} 
                  size={24} 
                  color="#FFFFFF" 
                />
              </View>
              
              <Typography 
                variant="body-12" 
                color={isSelected ? 'white' : 'secondary'}
                className="text-center"
              >
                {category.name}
              </Typography>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <Typography variant="body-12" color="error" className="mt-1">
          {error}
        </Typography>
      )}
    </View>
  );
};