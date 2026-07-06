import { useUnifiedStore } from '../store/unified-store';
import { getSliderTheme, SliderTheme } from '../config/sliderThemes';

/**
 * The currently applied fruit-store slider theme, or null for the classic look.
 * Narrow primitive selector so consumers only re-render when the theme changes.
 */
export function useSliderTheme(): SliderTheme | null {
  const sliderThemeId = useUnifiedStore((s) => s.preferences.sliderThemeId);
  return getSliderTheme(sliderThemeId);
}
