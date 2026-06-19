import { requireOptionalNativeModule } from 'expo-modules-core';

interface WidgetInfoNativeModule {
  getInstalledWidgetFamilies(): Promise<string[]>;
}

// Optional: returns null if the native module isn't present (e.g. a build made
// before this module was autolinked), so JS never throws.
const nativeModule = requireOptionalNativeModule<WidgetInfoNativeModule>('WidgetInfo');

/**
 * Returns the families of home-screen widgets the user currently has installed
 * (e.g. ["systemSmall", "systemMedium"]). Empty array when none are installed or
 * the native module is unavailable. Authoritative — backed by WidgetCenter.
 */
export async function getInstalledWidgetFamilies(): Promise<string[]> {
  if (!nativeModule) return [];
  try {
    return await nativeModule.getInstalledWidgetFamilies();
  } catch {
    return [];
  }
}
