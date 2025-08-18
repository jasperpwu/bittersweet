import { FC, useState } from 'react';
import { View, ScrollView, Alert, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { CalendarModal } from '../../ui/CalendarModal';

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
  isLoading?: boolean;
}

interface FormErrors {
  title?: string;
  category?: string;
  date?: string;
  startTime?: string;
}

// Category data matching Figma design exactly
const categories = [
  { 
    id: 'reading', 
    name: 'Reading', 
    gradient: ['#51BC6F', '#4CAF50'], 
    icon: 'book',
    selected: true // Default selected as shown in Figma
  },
  { 
    id: 'sport', 
    name: 'Sport', 
    gradient: ['#FFA556', '#F3913B'], 
    icon: 'fitness',
    selected: false
  },
  { 
    id: 'music', 
    name: 'Music', 
    gradient: ['#438EEC', '#2196F3'], 
    icon: 'musical-notes',
    selected: false
  },
  { 
    id: 'meditation', 
    name: 'Meditation', 
    gradient: ['#FAC438', '#FFC107'], 
    icon: 'leaf',
    selected: false
  },
  { 
    id: 'code', 
    name: 'Code', 
    gradient: ['#FD5B71', '#EB4C62'], 
    icon: 'code-slash',
    selected: false
  },
  { 
    id: 'it', 
    name: 'IT', 
    gradient: ['#2196F3', '#1976D2'], 
    icon: 'laptop',
    selected: false
  },
];

export const TaskForm: FC<TaskFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<CreateTaskInput>({
    title: 'Reading the book',
    date: new Date(2021, 10, 20), // Nov 20, 2021 to match Figma
    startTime: new Date(2021, 10, 20, 11, 0), // 11:00 AM to match Figma
    category: 'reading',
    workingSessions: 4,
    shortBreakDuration: 3,
    longBreakDuration: 25,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    }

    if (!formData.category) {
      newErrors.category = 'Please select a category';
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



  const CategoryButton: FC<{ category: typeof categories[0]; isSelected: boolean; onPress: () => void }> = ({ 
    category, 
    isSelected, 
    onPress 
  }) => (
    <Pressable
      onPress={onPress}
      className={`w-12 h-12 rounded-lg overflow-hidden ${isSelected ? 'opacity-100' : 'opacity-60'}`}
    >
      <Svg width="48" height="48" viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id={`gradient-${category.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={category.gradient[0]} />
            <Stop offset="100%" stopColor={category.gradient[1]} />
          </LinearGradient>
        </Defs>
        <Rect width="48" height="48" rx="8" fill={`url(#gradient-${category.id})`} />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Ionicons 
          name={category.icon as keyof typeof Ionicons.glyphMap} 
          size={20} 
          color="#FFFFFF" 
        />
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-[#1B1C30]">
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {/* Content matching Figma exactly */}
        <View className="px-5 pt-6" style={{ gap: 24 }}>
          {/* Task Name - Height 77px */}
          <View className="h-[77px] w-[335px]">
            <Text className="font-poppins-medium text-[14px] text-white leading-[14px] mb-4">
              Task name
            </Text>
            <View className="border border-[#575757] rounded-lg px-5 py-4 h-12 justify-center">
              <Text className="font-poppins-regular text-[14px] text-white leading-[14px]">
                Reading the book
              </Text>
            </View>
          </View>

          {/* Date and Time Row - Height 77px */}
          <View className="h-[77px] w-[335px]">
            {/* Labels */}
            <Text className="absolute font-poppins-medium text-[14px] text-white leading-[14px] left-0 top-0">
              Date
            </Text>
            <Text className="absolute font-poppins-medium text-[14px] text-white leading-[14px] left-[173px] top-0">
              Start time
            </Text>
            
            {/* Date Input */}
            <Pressable 
              onPress={() => setShowDatePicker(true)}
              className="absolute bottom-0 left-0 w-[162px] h-12 top-[29px]"
            >
              <View className="border border-[#575757] rounded-lg h-full flex-row items-center px-5">
                <Ionicons name="calendar-outline" size={16} color="#CACACA" />
                <Text className="font-poppins-regular text-[12px] text-white leading-[12px] ml-3">
                  Nov 20, 2021
                </Text>
              </View>
            </Pressable>

            {/* Time Input */}
            <View className="absolute bottom-0 right-0 w-[162px] h-12 top-[29px]">
              <View className="border border-[#575757] rounded-lg h-full flex-row items-center px-5">
                <Ionicons name="time-outline" size={16} color="#CACACA" />
                <Text className="font-poppins-regular text-[12px] text-white leading-[12px] ml-3">
                  11:00 am
                </Text>
              </View>
            </View>
          </View>

          {/* Category Selection - Height 77px */}
          <View className="h-[77px] w-[335px]">
            <Text className="font-poppins-medium text-[14px] text-white leading-[14px] mb-0">
              Select category
            </Text>
            <View className="absolute top-[29px] flex-row" style={{ gap: 8 }}>
              {categories.map((category) => (
                <CategoryButton
                  key={category.id}
                  category={category}
                  isSelected={formData.category === category.id}
                  onPress={() => updateFormData('category', category.id)}
                />
              ))}
            </View>
          </View>

          {/* Working Sessions Slider - Height 74px */}
          <View className="h-[74px] w-[335px]">
            <Text className="font-poppins-medium text-[14px] text-white leading-[14px] left-0 top-0">
              Working sessions
            </Text>
            
            {/* Value Labels */}
            <Text className="absolute font-poppins-regular text-[12px] text-white leading-[12px] left-0" style={{ top: 37 }}>
              1
            </Text>
            <Text className="absolute font-poppins-semibold text-[12px] text-white leading-[12px]" style={{ left: 162, top: 37 }}>
              {formData.workingSessions}
            </Text>
            <Text className="absolute font-poppins-regular text-[12px] text-white leading-[12px] right-0" style={{ top: 37 }}>
              8
            </Text>

            {/* Slider Track */}
            <View className="absolute bg-[#4F5170] rounded-lg left-0 right-0 h-1" style={{ top: 58 }} />
            
            {/* Active Track */}
            <View 
              className="absolute bg-[#6592E9] rounded-lg h-1 opacity-70"
              style={{ 
                top: 58,
                width: `${((formData.workingSessions - 1) / 7) * 100}%`
              }}
            />
            
            {/* Thumb */}
            <View
              className="absolute w-4 h-4 bg-white rounded-full shadow-lg"
              style={{ 
                top: 54,
                left: `${((formData.workingSessions - 1) / 7) * 100}%`,
                marginLeft: -8
              }}
            />
          </View>

          {/* Long Break Slider - Height 74px */}
          <View className="h-[74px] w-[335px]">
            <Text className="font-poppins-medium text-[14px] text-white leading-[14px] left-0 top-0">
              Long break
            </Text>
            
            {/* Value Labels */}
            <Text className="absolute font-poppins-regular text-[12px] text-white leading-[12px] left-0" style={{ top: 37 }}>
              10
            </Text>
            <Text className="absolute font-poppins-semibold text-[12px] text-white leading-[12px]" style={{ left: 259, top: 37 }}>
              {formData.longBreakDuration}
            </Text>
            <Text className="absolute font-poppins-regular text-[12px] text-white leading-[12px] right-0" style={{ top: 37 }}>
              30
            </Text>

            {/* Slider Track */}
            <View className="absolute bg-[#4F5170] rounded-lg left-0 right-0 h-1" style={{ top: 58 }} />
            
            {/* Active Track */}
            <View 
              className="absolute bg-[#6592E9] rounded-lg h-1 opacity-70"
              style={{ 
                top: 58,
                width: `${((formData.longBreakDuration - 10) / 20) * 100}%`
              }}
            />
            
            {/* Thumb */}
            <View
              className="absolute w-4 h-4 bg-white rounded-full shadow-lg"
              style={{ 
                top: 54,
                left: `${((formData.longBreakDuration - 10) / 20) * 100}%`,
                marginLeft: -8
              }}
            />
          </View>

          {/* Short Break Slider - Height 74px */}
          <View className="h-[74px] w-[335px]">
            <Text className="font-poppins-medium text-[14px] text-white leading-[14px] left-0 top-0">
              Short break
            </Text>
            
            {/* Value Labels */}
            <Text className="absolute font-poppins-regular text-[12px] text-white leading-[12px] left-0" style={{ top: 37 }}>
              1
            </Text>
            <Text className="absolute font-poppins-semibold text-[12px] text-white leading-[12px]" style={{ left: 79, top: 37 }}>
              {formData.shortBreakDuration}
            </Text>
            <Text className="absolute font-poppins-regular text-[12px] text-white leading-[12px] right-0" style={{ top: 37 }}>
              10
            </Text>

            {/* Slider Track */}
            <View className="absolute bg-[#4F5170] rounded-lg left-0 right-0 h-1" style={{ top: 58 }} />
            
            {/* Active Track */}
            <View 
              className="absolute bg-[#6592E9] rounded-lg h-1 opacity-70"
              style={{ 
                top: 58,
                width: `${((formData.shortBreakDuration - 1) / 9) * 100}%`
              }}
            />
            
            {/* Thumb */}
            <View
              className="absolute w-4 h-4 bg-white rounded-full shadow-lg"
              style={{ 
                top: 54,
                left: `${((formData.shortBreakDuration - 1) / 9) * 100}%`,
                marginLeft: -8
              }}
            />
          </View>
        </View>
      </ScrollView>

      {/* Calendar Modal */}
      <CalendarModal
        visible={showDatePicker}
        selectedDate={formData.date}
        onDateSelect={(date) => updateFormData('date', date)}
        onClose={() => setShowDatePicker(false)}
      />

      {/* Fixed Bottom Button - Adjusted positioning */}
      <View className="absolute bottom-0 left-0 right-0 bg-[#1B1C30] px-5 pb-4 pt-4">
        <Pressable 
          onPress={handleSubmit}
          disabled={isLoading}
          className="bg-[#6592E9] h-[60px] rounded-lg items-center justify-center active:opacity-80"
        >
          <Text className="font-poppins-semibold text-[14px] text-white leading-[14px]">
            {isLoading ? 'Creating...' : 'Create new project'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};