import { FC, useRef, useEffect } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography/Typography';

interface DateSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  weekDates: Date[];
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  currentWeekStart?: Date;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const formatDate = (date: Date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
};

const formatDayNumber = (date: Date) => {
  return date.getDate().toString();
};

const formatDayName = (date: Date) => {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    backgroundColor: '#1B1C30',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dateItem: {
    width: 60,
    height: 80,
    marginHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateItemUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#575757',
  },
  dateItemSelected: {
    backgroundColor: '#6592E9',
    borderWidth: 0,
  },
  dayNumber: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 20,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberUnselected: {
    color: '#FFFFFF',
  },
  dayName: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 14,
  },
  dayNameSelected: {
    color: '#FFFFFF',
  },
  dayNameUnselected: {
    color: '#CACACA',
  },
  spacer: {
    height: 4,
  },
});

export const DateSelector: FC<DateSelectorProps> = ({
  selectedDate,
  onDateSelect,
  weekDates,
  onPreviousWeek,
  onNextWeek,
  currentWeekStart,
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
        const itemWidth = 60 + 12; // width + margin (matching Figma design)
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

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
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

    return (
      <AnimatedPressable
        style={[
          animatedStyle,
          styles.dateItem,
          isSelected ? styles.dateItemSelected : styles.dateItemUnselected,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
      >
        <Typography
          variant="headline-20"
          style={[
            styles.dayNumber,
            isSelected ? styles.dayNumberSelected : styles.dayNumberUnselected,
          ]}
        >
          {formatDayNumber(date)}
        </Typography>
        <View style={styles.spacer} />
        <Typography
          variant="body-14"
          style={[
            styles.dayName,
            isSelected ? styles.dayNameSelected : styles.dayNameUnselected,
          ]}
        >
          {formatDayName(date)}
        </Typography>
      </AnimatedPressable>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
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