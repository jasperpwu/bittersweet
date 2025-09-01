import React, { FC, ReactNode, useEffect } from 'react';
import { Modal, View, Pressable, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: number;
}

const { height: screenHeight } = Dimensions.get('window');

export const BottomSheet: FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  children,
  height = screenHeight * 0.8,
}) => {
  const insets = useSafeAreaInsets();
  const slideAnim = React.useRef(new Animated.Value(height)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, slideAnim, opacityAnim, height]);

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View 
        className="flex-1 bg-black/50"
        style={{ opacity: opacityAnim }}
      >
        <Pressable 
          className="flex-1" 
          onPress={onClose}
        />
        
        {/* Bottom Sheet */}
        <Animated.View
          className="bg-dark-bg rounded-t-3xl"
          style={{
            height: height + insets.bottom,
            transform: [{ translateY: slideAnim }],
            paddingBottom: insets.bottom,
          }}
        >
          {/* Handle */}
          <View className="items-center py-3">
            <View className="w-12 h-1 bg-gray-400 rounded-full" />
          </View>
          
          {/* Content */}
          <View className="flex-1 px-6">
            {children}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};