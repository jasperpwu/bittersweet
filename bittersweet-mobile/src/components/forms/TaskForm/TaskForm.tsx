import React, { FC, useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Input } from '../../ui/Input';
import { DatePicker } from '../../ui/DatePicker';
import { TimePicker } from '../../ui/TimePicker';
import { CategoryPicker, TaskCategory } from '../../ui/CategoryPicker';
import { Slider } from '../../ui/Slider';
import { Button } from '../../ui/Button';
import { Typography } from '../../ui/Typography';

export interface CreateTaskInput {
  title: string;
  date: Date;
  startTime: Date;
  category: string;
  workingSessions: number;
  shortBreakDuration: number;
  longBreakDuration: number;
}

interface TaskFormProps {
  onSubmit: (task: CreateTaskInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FormErrors {
  title?: string;
  category?: string;
  date?: string;
  startTime?: string;
}

export const TaskForm: FC<TaskFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CreateTaskInput>({
    title: '',
    date: new Date(),
    startTime: new Date(),
    category: '',
    workingSessions: 4,
    shortBreakDuration: 5,
    longBreakDuration: 15,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.date);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      newErrors.date = 'Please select a future date';
    }

    // Check if time is in the past for today
    if (selectedDate.getTime() === today.getTime()) {
      const now = new Date();
      if (formData.startTime < now) {
        newErrors.startTime = 'Please select a future time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit(formData);
    } else {
      Alert.alert('Validation Error', 'Please fix the errors and try again.');
    }
  };

  const updateFormData = <K extends keyof CreateTaskInput>(
    key: K,
    value: CreateTaskInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    
    // Clear error when user starts fixing it
    if (errors[key as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  return (
    <ScrollView 
      className="flex-1 bg-dark-bg"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View className="px-6 py-4 space-y-6">
        {/* Task Name */}
        <Input
          label="Task name"
          value={formData.title}
          onChangeText={(text) => updateFormData('title', text)}
          placeholder="Enter task name"
          error={errors.title}
          variant="outlined"
          maxLength={50}
          accessibilityLabel="Task name input"
          accessibilityHint="Enter the name of your task"
        />

        {/* Date Selection */}
        <DatePicker
          label="Date"
          value={formData.date}
          onChange={(date) => updateFormData('date', date)}
          error={errors.date}
        />

        {/* Time Selection */}
        <TimePicker
          label="Start time"
          value={formData.startTime}
          onChange={(time) => updateFormData('startTime', time)}
          error={errors.startTime}
        />

        {/* Category Selection */}
        <CategoryPicker
          label="Category"
          selectedCategory={formData.category}
          onSelect={(categoryId) => updateFormData('category', categoryId)}
          error={errors.category}
        />

        {/* Working Sessions Slider */}
        <View className="space-y-4">
          <Typography variant="subtitle-14-medium" color="white">
            Session Configuration
          </Typography>
          
          <Slider
            label="Working sessions"
            value={formData.workingSessions}
            minimumValue={1}
            maximumValue={8}
            step={1}
            onValueChange={(value) => updateFormData('workingSessions', value)}
            unit=" sessions"
            width={320}
          />

          <Slider
            label="Long break"
            value={formData.longBreakDuration}
            minimumValue={10}
            maximumValue={30}
            step={5}
            onValueChange={(value) => updateFormData('longBreakDuration', value)}
            unit=" min"
            width={320}
          />

          <Slider
            label="Short break"
            value={formData.shortBreakDuration}
            minimumValue={1}
            maximumValue={10}
            step={1}
            onValueChange={(value) => updateFormData('shortBreakDuration', value)}
            unit=" min"
            width={320}
          />
        </View>

        {/* Action Buttons */}
        <View className="space-y-3 pt-4">
          <Button
            variant="primary"
            size="large"
            onPress={handleSubmit}
            disabled={isLoading}
            accessibilityLabel="Create new task"
            accessibilityHint="Double tap to create the task with current settings"
          >
            {isLoading ? 'Creating...' : 'Create new project'}
          </Button>

          <Button
            variant="secondary"
            size="large"
            onPress={onCancel}
            disabled={isLoading}
            accessibilityLabel="Cancel task creation"
            accessibilityHint="Double tap to cancel and go back"
          >
            Cancel
          </Button>
        </View>

        {/* Bottom spacing for safe area */}
        <View className="h-8" />
      </View>
    </ScrollView>
  );
};