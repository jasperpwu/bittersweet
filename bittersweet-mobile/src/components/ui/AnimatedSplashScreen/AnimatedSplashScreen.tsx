import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  interpolate,
  runOnJS,
  withDelay,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import * as SplashScreen from 'expo-splash-screen';

interface AnimatedSplashScreenProps {
  children: React.ReactNode;
}

const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  children
}) => {
  const animation = useSharedValue(0);
  const [isAppReady, setAppReady] = useState(false);
  const [isSplashAnimationComplete, setAnimationComplete] = useState(false);

  useEffect(() => {
    // Hide the native splash screen immediately and start our custom animation
    const initializeApp = async () => {
      try {
        // Hide native splash immediately
        await SplashScreen.hideAsync();
        setAppReady(true);
      } catch (e) {
        // Handle errors silently
        setAppReady(true);
      }
    };

    initializeApp();
  }, []);

  const onLottieAnimationFinish = useCallback(() => {
    // Start the exit animation after Lottie finishes with a shorter delay
    animation.value = withDelay(200, withTiming(1, { duration: 600 }, (isFinished) => {
      if (isFinished) {
        runOnJS(setAnimationComplete)(true);
      }
    }));
  }, []);

  const splashAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        animation.value,
        [0, 1],
        [1, 0],
        'clamp',
      ),
      transform: [
        {
          scale: interpolate(
            animation.value,
            [0, 1],
            [1, 1.1],
            'clamp',
          ),
        },
      ],
    };
  });

  return (
    <View style={{ flex: 1 }}>
      {isAppReady && children}

      {!isSplashAnimationComplete && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#f1f1f1',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            },
            splashAnimatedStyle,
          ]}
        >
          <LottieView
            autoPlay
            loop={false}
            onAnimationFinish={onLottieAnimationFinish}
            style={{
              width: 300,
              height: 300,
            }}
            source={require('../../../../assets/Cloudgenia.json')}
          />
        </Animated.View>
      )}
    </View>
  );
};

export default AnimatedSplashScreen;