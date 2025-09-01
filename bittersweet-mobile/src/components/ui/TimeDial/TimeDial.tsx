import { FC, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Typography } from '../Typography';

interface TimeDialProps {
  value: Date;
  onChange: (time: Date) => void;
  onDone?: () => void;
  minTime?: Date;
  maxTime?: Date;
  height?: number;
}

const ITEM_HEIGHT = 40;

export const TimeDial: FC<TimeDialProps> = ({
  value,
  onChange,
  onDone,
  height = 200,
}) => {
  const dateScrollRef = useRef<ScrollView>(null);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  // Generate date options (next 30 days)
  const generateDateOptions = () => {
    const options = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      options.push(date);
    }
    return options;
  };

  // Generate hour options (0-23)
  const generateHourOptions = () => {
    return Array.from({ length: 24 }, (_, i) => i);
  };

  // Generate minute options (0-59)
  const generateMinuteOptions = () => {
    return Array.from({ length: 60 }, (_, i) => i);
  };

  const dateOptions = generateDateOptions();
  const hourOptions = generateHourOptions();
  const minuteOptions = generateMinuteOptions();

  // Get current selected indices
  const getSelectedDateIndex = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(value);
    selectedDate.setHours(0, 0, 0, 0);
    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(29, diffDays));
  };

  const selectedDateIndex = getSelectedDateIndex();
  const selectedHourIndex = value.getHours();
  const selectedMinuteIndex = value.getMinutes();

  // Format date display
  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Handle scroll events with bounds checking
  const handleDateScroll = (event: any) => {
    if (!event?.nativeEvent?.contentOffset) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(dateOptions.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
    const newDate = new Date(dateOptions[index]);
    newDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(newDate);
  };

  const handleHourScroll = (event: any) => {
    if (!event?.nativeEvent?.contentOffset) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(hourOptions.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
    const newDate = new Date(value);
    newDate.setHours(hourOptions[index], newDate.getMinutes(), 0, 0);
    onChange(newDate);
  };

  const handleMinuteScroll = (event: any) => {
    if (!event?.nativeEvent?.contentOffset) return;
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.max(0, Math.min(minuteOptions.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
    const newDate = new Date(value);
    newDate.setMinutes(minuteOptions[index], 0, 0);
    onChange(newDate);
  };

  // Helper functions for swipe-based scrolling
  const scrollToIndex = (ref: React.RefObject<ScrollView | null>, index: number) => {
    try {
      if (ref.current && typeof index === 'number' && index >= 0) {
        ref.current.scrollTo({
          y: index * ITEM_HEIGHT,
          animated: true,
        });
      }
    } catch (error) {
      console.warn('Scroll error:', error);
    }
  };

  const handleDateChange = (direction: 'up' | 'down') => {
    const currentIndex = selectedDateIndex;
    let newIndex: number;
    
    if (direction === 'up') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(dateOptions.length - 1, currentIndex + 1);
    }
    
    if (newIndex !== currentIndex) {
      const newDate = new Date(dateOptions[newIndex]);
      newDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
      onChange(newDate);
      scrollToIndex(dateScrollRef, newIndex);
    }
  };

  const handleHourChange = (direction: 'up' | 'down') => {
    const currentIndex = selectedHourIndex;
    let newIndex: number;
    
    if (direction === 'up') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(hourOptions.length - 1, currentIndex + 1);
    }
    
    if (newIndex !== currentIndex) {
      const newDate = new Date(value);
      newDate.setHours(hourOptions[newIndex], newDate.getMinutes(), 0, 0);
      onChange(newDate);
      scrollToIndex(hourScrollRef, newIndex);
    }
  };

  const handleMinuteChange = (direction: 'up' | 'down') => {
    const currentIndex = selectedMinuteIndex;
    let newIndex: number;
    
    if (direction === 'up') {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(minuteOptions.length - 1, currentIndex + 1);
    }
    
    if (newIndex !== currentIndex) {
      const newDate = new Date(value);
      newDate.setMinutes(minuteOptions[newIndex], 0, 0);
      onChange(newDate);
      scrollToIndex(minuteScrollRef, newIndex);
    }
  };

  // Snap to nearest 5-minute interval
  const snapToFiveMinutes = (direction: 'prev' | 'next') => {
    const newDate = new Date(value);
    const currentMinutes = newDate.getMinutes();
    let targetMinutes: number;
    
    if (direction === 'prev') {
      // Find previous 5-minute mark
      targetMinutes = Math.floor(currentMinutes / 5) * 5;
      if (targetMinutes === currentMinutes && currentMinutes > 0) {
        targetMinutes -= 5;
      }
    } else {
      // Find next 5-minute mark
      targetMinutes = Math.ceil(currentMinutes / 5) * 5;
      if (targetMinutes === currentMinutes && currentMinutes < 55) {
        targetMinutes += 5;
      }
    }
    
    // Handle hour overflow/underflow
    if (targetMinutes >= 60) {
      targetMinutes = 0;
      newDate.setHours(newDate.getHours() + 1);
    } else if (targetMinutes < 0) {
      targetMinutes = 55;
      newDate.setHours(newDate.getHours() - 1);
    }
    
    newDate.setMinutes(targetMinutes, 0, 0);
    onChange(newDate);
    
    // Animate scroll to new position
    setTimeout(() => {
      minuteScrollRef.current?.scrollTo({
        y: targetMinutes * ITEM_HEIGHT,
        animated: true,
      });
    }, 50);
  };

  // Initialize scroll positions
  useEffect(() => {
    const timer = setTimeout(() => {
      dateScrollRef.current?.scrollTo({
        y: selectedDateIndex * ITEM_HEIGHT,
        animated: false,
      });
      hourScrollRef.current?.scrollTo({
        y: selectedHourIndex * ITEM_HEIGHT,
        animated: false,
      });
      minuteScrollRef.current?.scrollTo({
        y: selectedMinuteIndex * ITEM_HEIGHT,
        animated: false,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const renderPickerColumn = (
    items: any[],
    selectedIndex: number,
    onScroll: (event: any) => void,
    ref: React.RefObject<ScrollView | null>,
    renderItem: (item: any, index: number) => string,
    onUp: () => void,
    onDown: () => void
  ) => {
    return (
      <View style={{ flex: 1, height, position: 'relative' }}>
        {/* Up Button */}
        <TouchableOpacity
          onPress={onUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: height / 2 - ITEM_HEIGHT / 2,
            zIndex: 2,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{
            width: 20,
            height: 20,
            backgroundColor: 'rgba(101, 146, 233, 0.3)',
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Typography variant="body-12" className="text-white">▲</Typography>
          </View>
        </TouchableOpacity>

        {/* ScrollView */}
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="center"
          decelerationRate="fast"
          onMomentumScrollEnd={onScroll}
          onScrollEndDrag={onScroll}
          scrollEventThrottle={16}
          bounces={true}
          scrollEnabled={true}
          contentContainerStyle={{
            paddingVertical: height / 2 - ITEM_HEIGHT / 2,
          }}
        >
          {items.map((item, index) => (
            <View
              key={index}
              style={{
                height: ITEM_HEIGHT,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Typography
                variant="body-14"
                className={
                  index === selectedIndex
                    ? 'text-white font-semibold'
                    : 'text-gray-400'
                }
              >
                {renderItem(item, index)}
              </Typography>
            </View>
          ))}
        </ScrollView>

        {/* Down Button */}
        <TouchableOpacity
          onPress={onDown}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: height / 2 - ITEM_HEIGHT / 2,
            zIndex: 2,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View style={{
            width: 20,
            height: 20,
            backgroundColor: 'rgba(101, 146, 233, 0.3)',
            borderRadius: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Typography variant="body-12" className="text-white">▼</Typography>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Main Picker Container */}
      <View
        style={{
          flexDirection: 'row',
          height,
          width: 320,
          backgroundColor: '#2A2A2A',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Selection Indicator */}
        <View
          style={{
            position: 'absolute',
            top: height / 2 - ITEM_HEIGHT / 2,
            left: 0,
            right: 0,
            height: ITEM_HEIGHT,
            backgroundColor: 'rgba(101, 146, 233, 0.2)',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#6592E9',
            zIndex: 1,
          }}
        />

        {/* Date Column */}
        {renderPickerColumn(
          dateOptions,
          selectedDateIndex,
          handleDateScroll,
          dateScrollRef,
          (date) => formatDate(date),
          () => handleDateChange('up'),
          () => handleDateChange('down')
        )}

        {/* Separator */}
        <View style={{ width: 1, backgroundColor: '#444' }} />

        {/* Hour Column */}
        {renderPickerColumn(
          hourOptions,
          selectedHourIndex,
          handleHourScroll,
          hourScrollRef,
          (hour) => hour.toString().padStart(2, '0'),
          () => handleHourChange('up'),
          () => handleHourChange('down')
        )}

        {/* Separator */}
        <View style={{ width: 1, backgroundColor: '#444' }} />

        {/* Minute Column */}
        {renderPickerColumn(
          minuteOptions,
          selectedMinuteIndex,
          handleMinuteScroll,
          minuteScrollRef,
          (minute) => minute.toString().padStart(2, '0'),
          () => handleMinuteChange('up'),
          () => handleMinuteChange('down')
        )}
      </View>

      {/* Quick Minute Adjustment Controls */}
      <View
        style={{
          flexDirection: 'row',
          marginTop: 16,
          alignItems: 'center',
          gap: 16,
        }}
      >
        <TouchableOpacity
          onPress={() => snapToFiveMinutes('prev')}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: '#444',
            borderRadius: 8,
          }}
        >
          <Typography variant="body-14" className="text-white font-medium">
            -5 minutes
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => snapToFiveMinutes('next')}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: '#444',
            borderRadius: 8,
          }}
        >
          <Typography variant="body-14" className="text-white font-medium">
            +5 minutes
          </Typography>
        </TouchableOpacity>
      </View>

      {/* Done Button */}
      {onDone && (
        <TouchableOpacity
          onPress={onDone}
          style={{
            marginTop: 20,
            paddingHorizontal: 40,
            paddingVertical: 12,
            backgroundColor: '#6592E9',
            borderRadius: 25,
          }}
        >
          <Typography variant="subtitle-16" className="text-white font-semibold">
            Done
          </Typography>
        </TouchableOpacity>
      )}
    </View>
  );
};