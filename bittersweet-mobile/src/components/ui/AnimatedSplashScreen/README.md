# AnimatedSplashScreen Component

This component provides an animated splash screen using Lottie animations for the bittersweet mobile app.

## Features

- Uses the Cloudgenia.json Lottie animation
- Smooth transition from splash to app content
- Proper integration with Expo's splash screen system
- Follows the design system color palette

## Usage

The component is automatically used in the root layout (`app/_layout.tsx`) and wraps the entire app.

## Animation Flow

1. Native splash screen shows initially
2. Lottie animation plays automatically
3. When animation completes, it triggers the transition
4. App content fades in with smooth scaling animation
5. Splash screen fades out and is removed

## Customization

- Background color: `#f1f1f1` (matches design system)
- Animation duration: 1000ms for the transition
- Lottie animation size: 300x300px

## Dependencies

- `lottie-react-native`: For Lottie animation playback
- `expo-splash-screen`: For native splash screen control
- `react-native-reanimated`: For smooth transitions