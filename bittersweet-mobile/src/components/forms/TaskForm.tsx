import React, { FC, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface CreateTaskInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category: string;
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
  const [formData, setFormData] = useState<CreateTaskInput>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    startTime: initialData?.startTime || new Date(),
    endTime: initialData?.endTime || new Date(Date.now() + 60 * 60 * 1000), // 1 hour later
    category: initialData?.category || 'Work',
    priority: initialData?.priority || 'medium',
    tags: initialData?.tags || [],
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateTaskInput, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateTaskInput, string>> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
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
              {['Work', 'Personal', 'Study', 'Exercise', 'Other'].map((category) => (
                <Button
                  key={category}
                  variant={formData.category === category ? 'primary' : 'secondary'}
                  size="small"
                  onPress={() => updateFormData('category', category)}
                  className="mr-2 mb-2"
                >
                  {category}
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

          {/* Time placeholders - would need proper time pickers */}
          <View>
            <Typography variant="body-14" color="white" className="mb-3">
              Time
            </Typography>
            <View className="bg-gray-700 rounded-xl p-4">
              <Typography variant="body-14" color="secondary">
                Start: {formData.startTime.toLocaleTimeString()}
              </Typography>
              <Typography variant="body-14" color="secondary" className="mt-2">
                End: {formData.endTime.toLocaleTimeString()}
              </Typography>
            </View>
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