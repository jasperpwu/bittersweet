import React, { FC, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocus } from '../../store';

export interface CreateTaskInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category: string; // This will be the category ID
  priority: 'low' | 'medium' | 'high';
  tags: string[];
}

interface TaskFormProps {
  onSubmit: (data: CreateTaskInput) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  initialData?: Partial<CreateTaskInput>;
}

export const TaskForm: FC<TaskFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
  initialData,
}) => {
  const { categories } = useFocus();
  
  // Get available categories
  const availableCategories = categories.allIds.map(id => categories.byId[id]).filter(Boolean);
  const defaultCategoryId = availableCategories.length > 0 ? availableCategories[0].id : '';
  
  const [formData, setFormData] = useState<CreateTaskInput>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    startTime: initialData?.startTime || new Date(),
    endTime: initialData?.endTime || new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
    category: initialData?.category || defaultCategoryId,
    priority: initialData?.priority || 'medium',
    tags: initialData?.tags || [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateTaskInput, string>>>({});
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateTaskInput, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const updateFormData = (field: keyof CreateTaskInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <View className="flex-1 bg-dark-bg">
      <ScrollView className="flex-1 px-4 py-4">
        <View className="space-y-4">
          {/* Title */}
          <Input
            label="Task Title"
            value={formData.title}
            onChangeText={(text) => updateFormData('title', text)}
            placeholder="Enter task title"
            error={errors.title}
          />

          {/* Description */}
          <Input
            label="Description (Optional)"
            value={formData.description}
            onChangeText={(text) => updateFormData('description', text)}
            placeholder="Add task description"
            multiline
            numberOfLines={3}
            error={errors.description}
          />

          {/* Category */}
          <View>
            <Typography variant="body-14" color="white" className="mb-3">
              Category
            </Typography>
            <View className="flex-row flex-wrap">
              {availableCategories.map((category) => (
                <Button
                  key={category.id}
                  variant={formData.category === category.id ? 'primary' : 'secondary'}
                  size="small"
                  onPress={() => updateFormData('category', category.id)}
                  className="mr-2 mb-2"
                >
                  {category.icon} {category.name}
                </Button>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View>
            <Typography variant="body-14" color="white" className="mb-3">
              Priority
            </Typography>
            <View className="flex-row">
              {(['low', 'medium', 'high'] as const).map((priority) => (
                <Button
                  key={priority}
                  variant={formData.priority === priority ? 'primary' : 'secondary'}
                  size="small"
                  onPress={() => updateFormData('priority', priority)}
                  className="mr-2 capitalize"
                >
                  {priority}
                </Button>
              ))}
            </View>
          </View>

          {/* Time Selectors */}
          <View>
            <Typography variant="body-14" color="white" className="mb-3">
              Time
            </Typography>
            
            {/* Start Time */}
            <View className="mb-3">
              <Typography variant="body-12" color="secondary" className="mb-2">
                Start Time
              </Typography>
              <Pressable
                onPress={() => setShowStartTimePicker(true)}
                className="bg-gray-700 rounded-xl p-4 border border-gray-600"
              >
                <Typography variant="body-14" color="white">
                  {formData.startTime.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Typography>
              </Pressable>
            </View>

            {/* End Time */}
            <View className="mb-3">
              <Typography variant="body-12" color="secondary" className="mb-2">
                End Time
              </Typography>
              <Pressable
                onPress={() => setShowEndTimePicker(true)}
                className="bg-gray-700 rounded-xl p-4 border border-gray-600"
              >
                <Typography variant="body-14" color="white">
                  {formData.endTime.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </Typography>
              </Pressable>
            </View>

            {/* Duration Display */}
            <View className="bg-gray-800 rounded-xl p-3">
              <Typography variant="body-12" color="secondary">
                Duration: {Math.round((formData.endTime.getTime() - formData.startTime.getTime()) / (1000 * 60))} minutes
              </Typography>
            </View>

            {/* Time Pickers */}
            {showStartTimePicker && (
              <DateTimePicker
                value={formData.startTime}
                mode="time"
                display="default"
                onChange={(event, selectedTime) => {
                  setShowStartTimePicker(false);
                  if (selectedTime) {
                    updateFormData('startTime', selectedTime);
                    // Auto-adjust end time to maintain duration if needed
                    if (selectedTime >= formData.endTime) {
                      const newEndTime = new Date(selectedTime.getTime() + 60 * 60 * 1000);
                      updateFormData('endTime', newEndTime);
                    }
                  }
                }}
              />
            )}

            {showEndTimePicker && (
              <DateTimePicker
                value={formData.endTime}
                mode="time"
                display="default"
                minimumDate={formData.startTime}
                onChange={(event, selectedTime) => {
                  setShowEndTimePicker(false);
                  if (selectedTime) {
                    updateFormData('endTime', selectedTime);
                  }
                }}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View className="px-4 pb-8 pt-4 border-t border-gray-700">
        <View className="flex-row space-x-3">
          {onCancel && (
            <Button
              variant="secondary"
              onPress={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            onPress={handleSubmit}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Creating...' : 'Create Task'}
          </Button>
        </View>
      </View>
    </View>
  );
};