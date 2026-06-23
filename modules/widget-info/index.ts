import { requireOptionalNativeModule } from 'expo-modules-core';

interface WidgetInfoNativeModule {
  getInstalledWidgetFamilies(): Promise<string[]>;
  // Optional: only present on builds made after this method was added.
  getInstalledWidgetKinds?(): Promise<string[]>;
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

/**
 * Returns the kind identifiers of installed widgets (e.g.
 * ["com.path2us.bittersweet.GoalWidget"]) so callers can tell *which* widget the user
 * has. Resolves `null` when the answer is unknown (native module/method unavailable —
 * e.g. before the next prebuild — or the query failed); `[]` means none installed.
 */
export async function getInstalledWidgetKinds(): Promise<string[] | null> {
  if (!nativeModule?.getInstalledWidgetKinds) return null;
  try {
    return await nativeModule.getInstalledWidgetKinds();
  } catch {
    return null;
  }
}
