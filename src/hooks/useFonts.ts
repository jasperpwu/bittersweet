import { useFonts as useExpoFonts } from 'expo-font';
import { FONT_FAMILIES } from '../config/fonts';

/**
 * Custom hook to load Poppins fonts
 * This ensures all fonts are loaded before the app renders
 */
export const useFonts = () => {
  const [fontsLoaded] = useExpoFonts({
    [FONT_FAMILIES.regular]: require('../../assets/fonts/Poppins-Regular.ttf'),
    [FONT_FAMILIES.medium]: require('../../assets/fonts/Poppins-Medium.ttf'),
    [FONT_FAMILIES.semibold]: require('../../assets/fonts/Poppins-SemiBold.ttf'),
    [FONT_FAMILIES.bold]: require('../../assets/fonts/Poppins-Bold.ttf'),
  });

  return { fontsLoaded };
};