import { FC, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Pressable, FlatList, useWindowDimensions, useColorScheme } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography';

interface DateSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Number of weeks to generate in each direction from today
const WEEKS_RANGE = 260; // ~5 years each direction
const TOTAL_WEEKS = WEEKS_RANGE * 2 + 1;
const CENTER_INDEX = WEEKS_RANGE;

/**
 * Get the Monday of the week containing the given date
 */
const getMonday = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

/**
 * Get the week index offset from today's week
 */
const getWeekOffset = (date: Date): number => {
  const todayMonday = getMonday(new Date());
  const targetMonday = getMonday(date);
  const diffMs = targetMonday.getTime() - todayMonday.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
};

/**
 * Get the Monday for a given week index
 */
const getMondayForIndex = (weekIndex: number): Date => {
  const todayMonday = getMonday(new Date());
  const monday = new Date(todayMonday);
  const offset = weekIndex - CENTER_INDEX;
  monday.setDate(monday.getDate() + offset * 7);
  return monday;
};

const DateItem: FC<{
  date: Date;
  isSelected: boolean;
  isToday: boolean;
  onPress: (date: Date) => void;
  itemWidth: number;
}> = ({ date, isSelected, isToday, onPress, itemWidth }) => {
  const scale = useSharedValue(1);
  const backgroundColor = useSharedValue(isSelected ? 1 : 0);
  const colorScheme = useColorScheme();
  const unselectedBg = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
    backgroundColor: withTiming(
      backgroundColor.value === 1 ? '#6592E9' : unselectedBg,
      { duration: 200 }
    ),
  }));

  useEffect(() => {
    backgroundColor.value = isSelected ? 1 : 0;
  }, [isSelected, backgroundColor]);

  return (
    <AnimatedPressable
      style={[
        animatedStyle,
        {
          width: itemWidth - 8,
          aspectRatio: 0.85,
          marginHorizontal: 4,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
      onPressIn={() => { scale.value = 0.95; }}
      onPressOut={() => { scale.value = 1; }}
      onPress={() => onPress(date)}
    >
      <Typography
        variant="body-12"
        color={isSelected ? 'white' : 'secondary'}
      >
        {DAY_LETTERS[(date.getDay() + 6) % 7]}
      </Typography>
      <View style={{ height: 4 }} />
      <Typography
        variant="subtitle-16"
        color={isSelected ? 'white' : 'primary'}
        style={{ fontWeight: isSelected || isToday ? '700' : '600' }}
      >
        {date.getDate()}
      </Typography>
    </AnimatedPressable>
  );
};

const WeekPage: FC<{
  weekIndex: number;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  pageWidth: number;
}> = ({ weekIndex, selectedDate, onDateSelect, pageWidth }) => {
  const today = new Date();
  const itemWidth = (pageWidth - 24) / 7; // 12px padding each side

  const monday = useMemo(() => getMondayForIndex(weekIndex), [weekIndex]);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      result.push(d);
    }
    return result;
  }, [monday]);

  return (
    <View style={{ width: pageWidth, flexDirection: 'row', paddingHorizontal: 12 }}>
      {days.map((date, i) => {
        const isSelected = date.toDateString() === selectedDate.toDateString();
        const isToday = date.toDateString() === today.toDateString();
        return (
          <DateItem
            key={i}
            date={date}
            isSelected={isSelected}
            isToday={isToday}
            onPress={onDateSelect}
            itemWidth={itemWidth}
          />
        );
      })}
    </View>
  );
};

export const DateSelector: FC<DateSelectorProps> = ({
  selectedDate,
  onDateSelect,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const flatListRef = useRef<FlatList>(null);
  const lastScrolledIndex = useRef(CENTER_INDEX);
  const isUserScrolling = useRef(false);

  // Calculate which week index the selected date falls on
  const selectedWeekIndex = CENTER_INDEX + getWeekOffset(selectedDate);

  // Scroll to the correct week when selectedDate changes (e.g. from timeline swipe or "Today" button)
  useEffect(() => {
    if (selectedWeekIndex !== lastScrolledIndex.current) {
      lastScrolledIndex.current = selectedWeekIndex;
      flatListRef.current?.scrollToIndex({
        index: selectedWeekIndex,
        animated: true,
      });
    }
  }, [selectedWeekIndex]);

  const handleMomentumScrollEnd = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / screenWidth);

    if (newIndex !== lastScrolledIndex.current) {
      lastScrolledIndex.current = newIndex;
      // When swiping weeks, select the same weekday in the new week
      const dayOffset = (selectedDate.getDay() + 6) % 7; // Mon=0 ... Sun=6
      const newMonday = getMondayForIndex(newIndex);
      const newDate = new Date(newMonday);
      newDate.setDate(newMonday.getDate() + dayOffset);
      onDateSelect(newDate);
    }
  }, [screenWidth, selectedDate, onDateSelect]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: screenWidth,
    offset: screenWidth * index,
    index,
  }), [screenWidth]);

  const renderItem = useCallback(({ item: weekIndex }: { item: number }) => (
    <WeekPage
      weekIndex={weekIndex}
      selectedDate={selectedDate}
      onDateSelect={onDateSelect}
      pageWidth={screenWidth}
    />
  ), [selectedDate, onDateSelect, screenWidth]);

  const weekIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < TOTAL_WEEKS; i++) {
      indices.push(i);
    }
    return indices;
  }, []);

  const keyExtractor = useCallback((item: number) => item.toString(), []);

  return (
    <View style={{ paddingVertical: 12 }}>
      <FlatList
        ref={flatListRef}
        data={weekIndices}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={getItemLayout}
        initialScrollIndex={CENTER_INDEX}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        windowSize={3}
        maxToRenderPerBatch={3}
        removeClippedSubviews
      />
    </View>
  );
};
