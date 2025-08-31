import { FC, useState, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TimePickerModal } from '../ui/TimePickerModal/TimePickerModal';
import { useFocus } from '../../store';
import { CreateSessionInput } from '../../types/models';

interface SessionFormProps {
  onSubmit: (data: CreateSessionInput) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  initialData?: Partial<CreateSessionInput>;
}

export const SessionForm: FC<SessionFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
  initialData,
}) => {
  const { tags, sessions } = useFocus();
  
  // Get available tags
  const availableTags = tags.allIds.map(id => tags.byId[id]).filter(Boolean);
  const defaultTag = availableTags.length > 0 ? availableTags[0].name : '';
  
  // Calculate default times based on requirements
  const defaultTimes = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    // Find last session of today
    const todaySessions = sessions.allIds
      .map(id => sessions.byId[id])
      .filter(Boolean) // Filter out undefined sessions
      .filter(session => {
        if (!session.endTime) return false; // Skip sessions without endTime
        const sessionDate = new Date(session.endTime);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === today.getTime();
      })
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
    
    let defaultStartTime: Date;
    if (todaySessions.length > 0 && todaySessions[0].endTime) {
      // End of last session today
      defaultStartTime = new Date(todaySessions[0].endTime);
    } else {
      // 25 minutes ago
      defaultStartTime = new Date(now.getTime() - 25 * 60 * 1000);
    }
    
    return {
      startTime: defaultStartTime,
      endTime: now,
    };
  }, [sessions]);

  const [formData, setFormData] = useState<CreateSessionInput>({
    tags: initialData?.tags || [defaultTag],
    startTime: initialData?.startTime || defaultTimes.startTime,
    endTime: initialData?.endTime || defaultTimes.endTime,
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateSessionInput, string>>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tags || [defaultTag]);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Calculate duration in minutes
  const calculatedDuration = useMemo(() => {
    const diffMs = formData.endTime.getTime() - formData.startTime.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60))); // Convert to minutes
  }, [formData.startTime, formData.endTime]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateSessionInput, string>> = {};

    if (formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }

    if (calculatedDuration <= 0) {
      newErrors.endTime = 'Session must have a duration greater than 0 minutes';
    }

    if (formData.tags.length === 0) {
      newErrors.tags = 'At least one tag is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      const sessionData: CreateSessionInput = {
        tags: formData.tags,
        startTime: formData.startTime,
        endTime: formData.endTime,
        notes: formData.notes,
      };
      onSubmit(sessionData);
    }
  };

  const updateFormData = (field: keyof CreateSessionInput, value: any) => {
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
          {/* Tags */}
          <View>
            <Typography variant="body-14" color="white" className="mb-3">
              Tags
            </Typography>
            <View className="flex-row flex-wrap">
              {availableTags.map((tag) => (
                <Button
                  key={tag.id}
                  variant={selectedTags.includes(tag.name) ? 'primary' : 'secondary'}
                  size="small"
                  onPress={() => {
                    const newTags = selectedTags.includes(tag.name)
                      ? selectedTags.filter(t => t !== tag.name)
                      : [...selectedTags, tag.name];
                    setSelectedTags(newTags);
                    updateFormData('tags', newTags);
                  }}
                  className="mr-2 mb-2"
                >
                  {tag.icon || '🏷️'} {tag.name}
                </Button>
              ))}
            </View>
            {errors.tags && (
              <Typography variant="body-12" className="text-red-500 mt-1">
                {errors.tags}
              </Typography>
            )}
          </View>

          {/* Start Time */}
          <View>
            <Typography variant="body-14" color="white" className="mb-3">
              Start From
            </Typography>
            <Button
              variant="secondary"
              onPress={() => setShowStartTimePicker(true)}
              className="justify-start"
            >
              <Typography variant="body-14" color="white">
                {formData.startTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  hour12: true 
                })}
              </Typography>
            </Button>
            {errors.startTime && (
              <Typography variant="body-12" className="text-red-500 mt-1">
                {errors.startTime}
              </Typography>
            )}
          </View>

          {/* End Time */}
          <View>
            <Typography variant="body-14" color="white" className="mb-3">
              End At
            </Typography>
            <Button
              variant="secondary"
              onPress={() => setShowEndTimePicker(true)}
              className="justify-start"
            >
              <Typography variant="body-14" color="white">
                {formData.endTime.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  hour12: true 
                })}
              </Typography>
            </Button>
            {errors.endTime && (
              <Typography variant="body-12" className="text-red-500 mt-1">
                {errors.endTime}
              </Typography>
            )}
          </View>

          {/* Duration Display */}
          <View className="p-4 bg-dark-border/30 rounded-lg">
            <Typography variant="body-14" color="secondary" className="mb-1">
              Session Duration
            </Typography>
            <Typography variant="headline-18" color="white" className="font-semibold">
              {calculatedDuration} minutes
            </Typography>
          </View>

          {/* Notes */}
          <Input
            label="Notes (Optional)"
            value={formData.notes}
            onChangeText={(text) => updateFormData('notes', text)}
            placeholder="Add session notes"
            multiline
            numberOfLines={3}
            error={errors.notes}
          />
        </View>
      </ScrollView>

      {/* Time Picker Modals */}
      <TimePickerModal
        visible={showStartTimePicker}
        onClose={() => setShowStartTimePicker(false)}
        onSave={(time) => updateFormData('startTime', time)}
        initialTime={formData.startTime}
        title="Start From"
        maxTime={formData.endTime}
      />

      <TimePickerModal
        visible={showEndTimePicker}
        onClose={() => setShowEndTimePicker(false)}
        onSave={(time) => updateFormData('endTime', time)}
        initialTime={formData.endTime}
        title="End At"
        minTime={formData.startTime}
      />

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
            {isLoading ? 'Creating...' : 'Create Session'}
          </Button>
        </View>
      </View>
    </View>
  );
};