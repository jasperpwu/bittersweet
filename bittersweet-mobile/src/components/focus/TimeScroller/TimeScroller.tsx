import { FC, useRef, useEffect } from 'react';
import { View, ScrollView, Dimensions, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TimeScrollerProps {
  selectedTime: number;
  onTimeChange: (time: number) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const TICK_SPACING = 100;

// Optional font family names assuming they are loaded in the app
const FONT_REGULAR = 'Poppins-Regular';
const FONT_MEDIUM = 'Poppins-Medium';
const FONT_BOLD = 'Poppins-Bold';

export const TimeScroller: FC<TimeScrollerProps> = ({
  selectedTime,
  onTimeChange,
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const isUserScrollingRef = useRef(false);
  
  // Define the exact center position for both center line and triangle
  const centerPosition = screenWidth / 2;
  const centerOffset = (screenWidth - TICK_SPACING) / 2;

  useEffect(() => {
    if (isUserScrollingRef.current) return;
    if (scrollViewRef.current) {
      const tickIndex = selectedTime / 5;
      const scrollPosition = tickIndex * TICK_SPACING;
      scrollViewRef.current.scrollTo({ x: scrollPosition, animated: false });
    }
  }, [selectedTime]);

  const handleMomentumBegin = () => {
    isUserScrollingRef.current = true;
  };

  const handleScrollEnd = (event: any) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const rawIndex = scrollX / TICK_SPACING;
    const snappedIndex = Math.round(rawIndex);
    const snappedTime = Math.max(0, Math.min(60, snappedIndex * 5));
    
    const targetScrollX = snappedIndex * TICK_SPACING;
    scrollViewRef.current?.scrollTo({ x: targetScrollX, animated: true });
    
    if (snappedTime !== selectedTime) {
      onTimeChange(snappedTime);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Allow programmatic updates again after snap
    isUserScrollingRef.current = false;
  };

  return (
    <View style={{ height: 140 }}>
      <View style={{ height: 110, position: 'relative' }}>
        {/* Fixed center indicator line */}
        <View
          style={{
            position: 'absolute',
            left: centerPosition - 3, // Center the 6px line at exact center
            top: 58,
            width: 6,
            height: 40,
            backgroundColor: '#FFFFFF',
            borderRadius: 3,
            zIndex: 10,
          }}
        />
        
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onMomentumScrollBegin={handleMomentumBegin}
          onScrollBeginDrag={handleMomentumBegin}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={TICK_SPACING}
          snapToAlignment="center"
          contentContainerStyle={{
            paddingHorizontal: centerOffset,
          }}
        >
          {Array.from({ length: 13 }, (_, i) => i * 5).map((time, idx) => {
            const isSelected = time === selectedTime;
            const distance = Math.abs(time - selectedTime);
            
            let opacity = 1;
            let fontSize = 26;
            let fontFamily = FONT_REGULAR;
            
            if (isSelected) {
              opacity = 1;
              fontSize = 56;
              fontFamily = FONT_BOLD;
            } else if (distance <= 10) {
              opacity = 0.7;
              fontSize = 34;
              fontFamily = FONT_MEDIUM;
            } else if (distance <= 20) {
              opacity = 0.5;
              fontSize = 28;
              fontFamily = FONT_MEDIUM;
            } else {
              opacity = 0.25;
              fontSize = 24;
              fontFamily = FONT_REGULAR;
            }
            
            return (
              <View
                key={time}
                style={{
                  width: TICK_SPACING,
                  height: 110,
                  alignItems: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <View style={{ height: 66, justifyContent: 'center', width: TICK_SPACING }}>
                  <Text
                    style={{
                      color: `rgba(255, 255, 255, ${opacity})`,
                      fontSize: fontSize,
                      fontFamily: fontFamily,
                      textAlign: 'center',
                    }}
                  >
                    {time === 0 ? '∞' : time}
                  </Text>
                </View>
                
                {/* Minor ticks inside the segment (4 between major ticks) */}
                <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, height: 20 }} pointerEvents="none">
                  {Array.from({ length: 4 }, (_, j) => j + 1).map((j) => {
                    const left = (TICK_SPACING / 5) * j;
                    return (
                      <View
                        key={`minor-${idx}-${j}`}
                        style={{
                          position: 'absolute',
                          left: left - 1,
                          width: 2,
                          height: 10,
                          backgroundColor: 'rgba(255,255,255,0.25)',
                          borderRadius: 1,
                        }}
                      />
                    );
                  })}
                </View>

                {/* Major tick */}
                <View
                  style={{
                    width: 3,
                    height: isSelected ? 0 : 24,
                    backgroundColor: `rgba(255, 255, 255, ${opacity * 0.6})`,
                    borderRadius: 1.5,
                  }}
                />
              </View>
            );
          })}
        </ScrollView>
      </View>
      
      {/* Triangle pointer - positioned to align exactly with center line */}
      <View style={{ position: 'relative', height: 24, marginTop: 6 }}>
        <View
          style={{
            position: 'absolute',
            left: centerPosition - 8, // Center the 16px triangle at exact center
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderBottomWidth: 12,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
};