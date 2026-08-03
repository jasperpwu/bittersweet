/**
 * Mirror a left/right-pointing icon for right-to-left layouts.
 *
 * React Native flips `left`/`right` style properties itself when the app is in
 * RTL, but an icon is just a glyph — a chevron pointing right keeps pointing
 * right, so in Arabic or Urdu a "back" button ends up aiming the wrong way and
 * a disclosure chevron points away from the content it opens.
 *
 * `I18nManager.isRTL` is fixed for the lifetime of the process (changing it
 * restarts the app — see `src/i18n/rtl.ts`), so this reads it once at module
 * load instead of forcing every call site to become a hook.
 *
 *   <Ionicons name={directionalIcon('chevron-forward')} />
 *
 * Icons with no left/right meaning pass through unchanged, so it is safe to
 * wrap any name.
 */
import { I18nManager } from 'react-native';

/** Ionicons names that read as "towards the end of the line" and their mirrors. */
const MIRRORED: Record<string, string> = {
  'chevron-forward': 'chevron-back',
  'chevron-back': 'chevron-forward',
  'chevron-forward-outline': 'chevron-back-outline',
  'chevron-back-outline': 'chevron-forward-outline',
  'chevron-forward-circle': 'chevron-back-circle',
  'chevron-back-circle': 'chevron-forward-circle',
  'arrow-forward': 'arrow-back',
  'arrow-back': 'arrow-forward',
  'arrow-forward-outline': 'arrow-back-outline',
  'arrow-back-outline': 'arrow-forward-outline',
  'arrow-forward-circle': 'arrow-back-circle',
  'arrow-back-circle': 'arrow-forward-circle',
  'caret-forward': 'caret-back',
  'caret-back': 'caret-forward',
  'play-forward': 'play-back',
  'play-back': 'play-forward',
};

const isRTL = I18nManager.isRTL;

export function directionalIcon<T extends string>(name: T): T {
  if (!isRTL) return name;
  return (MIRRORED[name] as T | undefined) ?? name;
}
