import { FC } from 'react';
import { View, Pressable } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { SessionItem, SessionItemProps } from '../SessionItem';
import { Typography } from '../../ui/Typography';

interface SwipeableSessionItemProps extends SessionItemProps {
  onDelete: (sessionId: string) => void;
}

const SWIPE_THRESHOLD = 60;
const DELETE_BUTTON_WIDTH = 80;

export const SwipeableSessionItem: FC<SwipeableSessionItemProps> = ({
  session,
  onDelete,
  ...sessionItemProps
}) => {
  const translateX = useSharedValue(0);
  const showDelete = useSharedValue(false);

  const handleDelete = () => {
    onDelete(session.id);
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      // Reset any existing animation
    },
    onActive: (event) => {
      // Only allow left swipe (negative translation)
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -DELETE_BUTTON_WIDTH);
      }
    },
    onEnd: (event) => {
      const shouldShowDelete = event.translationX < -SWIPE_THRESHOLD;
      
      if (shouldShowDelete) {
        translateX.value = withSpring(-DELETE_BUTTON_WIDTH);
        showDelete.value = true;
      } else {
        translateX.value = withSpring(0);
        showDelete.value = false;
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: showDelete.value ? 1 : 0,
  }));

  return (
    <View className="relative">
      {/* Delete button background */}
      <Animated.View 
        style={[deleteButtonStyle, { width: DELETE_BUTTON_WIDTH, backgroundColor: '#EF786C33' }]}
        className="absolute right-0 top-0 bottom-0 justify-center items-center rounded-r-xl"
      >
        <Pressable
          onPress={handleDelete}
          className="w-full h-full justify-center items-center active:opacity-70"
        >
          <Typography variant="subtitle-16" color="white">
            🗑️
          </Typography>
        </Pressable>
      </Animated.View>

      {/* Swipeable session item */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={animatedStyle}>
          <SessionItem session={session} {...sessionItemProps} />
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};