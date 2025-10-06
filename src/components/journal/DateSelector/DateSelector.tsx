import { FC, useRef, useEffect } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography';

interface DateSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  weekDates: Date[];
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const formatDayNumber = (date: Date) => {
  return date.getDate().toString();
};

const formatDayName = (date: Date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
};

export const DateSelector: FC<DateSelectorProps> = ({
  selectedDate,
  onDateSelect,
  weekDates,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to selected date on mount
  useEffect(() => {
    const selectedIndex = weekDates.findIndex(
      date => date.toDateString() === selectedDate.toDateString()
    );
    if (selectedIndex !== -1 && scrollViewRef.current) {
      // Delay scroll to ensure component is mounted
      setTimeout(() => {
        const itemWidth = 64 + 16; // width + margin
        const scrollX = Math.max(0, selectedIndex * itemWidth - 40);
        scrollViewRef.current?.scrollTo({
          x: scrollX,
          animated: true,
        });
      }, 100);
    }
  }, [selectedDate, weekDates]);

  const DateItem: FC<{ date: Date; isSelected: boolean }> = ({ date, isSelected }) => {
    const scale = useSharedValue(1);
    const backgroundColor = useSharedValue(isSelected ? 1 : 0);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
      backgroundColor: withSpring(
        backgroundColor.value === 1 ? '#6592E9' : 'transparent',
        { damping: 20, stiffness: 400 }
      ),
    }));

    const handlePressIn = () => {
      scale.value = 0.95;
    };

    const handlePressOut = () => {
      scale.value = 1;
    };

    const handlePress = () => {
      onDateSelect(date);
    };

    // Update background animation when selection changes
    useEffect(() => {
      backgroundColor.value = isSelected ? 1 : 0;
    }, [isSelected, backgroundColor]);

    return (
      <AnimatedPressable
        style={[
          animatedStyle,
          {
            width: 64,
            height: 80,
            marginHorizontal: 8,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Typography
          variant="body-12"
          color={isSelected ? 'white' : 'secondary'}
        >
          {formatDayName(date)}
        </Typography>
        <View style={{ height: 4 }} />
        <Typography
          variant="subtitle-16"
          color={isSelected ? 'white' : 'primary'}
        >
          {formatDayNumber(date)}
        </Typography>
      </AnimatedPressable>
    );
  };

  return (
    <View className="py-4 bg-dark-bg">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingHorizontal: 20,
          alignItems: 'center',
        }}
        style={{ flexGrow: 0 }}
      >
        {weekDates.map((date, index) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          return (
            <DateItem
              key={`${date.toISOString()}-${index}`}
              date={date}
              isSelected={isSelected}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};