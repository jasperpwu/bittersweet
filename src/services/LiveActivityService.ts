import * as LiveActivity from 'expo-live-activity';
import { Appearance, Platform } from 'react-native';
import * as Device from 'expo-device';

// Color palettes for Live Activity based on system appearance
const LA_COLORS = {
  light: {
    backgroundColor: '#F5E6D3',
    titleColor: '#8B4513',
    subtitleColor: '#8B4513',
    progressViewLabelColor: '#8B4513',
  },
  dark: {
    backgroundColor: '#1B1C30',
    titleColor: '#FFFFFF',
    subtitleColor: '#CACACA',
    progressViewLabelColor: '#FFFFFF',
  },
} as const;

// Keep original interface for internal tracking
export interface UnlockCountdownState {
  endTimestamp: number; // Unix timestamp when unlock expires
  totalDurationMinutes: number; // Total unlock duration in minutes
  startedAt: number; // Unix timestamp when unlock started
}

/**
 * Service for managing iOS Live Activities for unlock countdown
 */
export class LiveActivityService {
  // Track activity IDs and end times so we can clean up expired ones from
  // _layout.tsx on app foreground (JS timers don't run in background).
  private static lastUnlockActivityId: string | undefined;
  private static lastFocusActivityId: string | undefined;
  private static focusEndTimestamp: number | undefined;
  private static unlockEndTimestamp: number | undefined;

  // Track last tag info for idle state after session ends
  private static lastTagName: string | undefined;
  private static lastTagId: string | undefined;
  private static lastDurationMinutes: number | undefined;

  /**
   * Start a new Live Activity for unlock countdown
   * @param endTime - When the unlock expires
   * @param durationMinutes - Total unlock duration in minutes
   * @param reason - The reason for unlocking (user-provided text)
   * @returns Activity ID if started successfully, undefined otherwise
   */
  static startUnlockCountdown(endTime: Date, durationMinutes: number, reason?: string): string | undefined {
    // Check if Live Activities are available
    if (!this.isAvailable()) {
      console.log('Live Activities not available:', {
        platform: Platform.OS,
        osVersion: Device.osVersion,
        moduleAvailable: !!LiveActivity?.startActivity,
        requiresIOS162: 'iOS 16.2+'
      });
      return undefined;
    }

    try {
      // Stop any stale unlock activity before starting a new one
      if (this.lastUnlockActivityId) {
        console.log('🧹 Cleaning up stale unlock activity:', this.lastUnlockActivityId);
        try {
          LiveActivity.stopActivity(this.lastUnlockActivityId, {
            title: 'Unlock Ended',
            progressBar: { date: Date.now() },
          } as LiveActivity.LiveActivityState);
        } catch (e) {
          // Already ended — ignore
        }
        this.lastUnlockActivityId = undefined;
      }

      const now = Date.now();
      const endTimestamp = endTime.getTime();
      const startTimestamp = endTimestamp - durationMinutes * 60 * 1000;

      // State for Live Activity (using correct expo-live-activity API)
      const state: LiveActivity.LiveActivityState = {
        title: reason || 'Unlocked',
        subtitle: `${durationMinutes}m unlock`,
        progressBar: {
          date: endTimestamp,
        },
        imageName: 'app_icon',
        dynamicIslandImageName: 'app_icon',
        dynamicIslandText: reason || 'Unlocked',
        timerStartDateInMilliseconds: startTimestamp,
      };

      // Configuration for Live Activity — pick colors based on current system appearance
      const palette = Appearance.getColorScheme() === 'dark' ? LA_COLORS.dark : LA_COLORS.light;
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: palette.backgroundColor,
        titleColor: palette.titleColor,
        subtitleColor: palette.subtitleColor,
        progressViewTint: '#FF6347',
        progressViewLabelColor: palette.progressViewLabelColor,
        // No deepLinkUrl — tapping the live activity opens the app via default iOS
        // behavior without triggering Expo Router navigation to a nonexistent route.
        timerType: 'digital',
        sessionType: 'unlock',
      };

      console.log('🎬 Starting Live Activity for unlock countdown:', {
        duration: durationMinutes,
        endsAt: endTime.toLocaleTimeString(),
        endTimestamp: endTimestamp,
        currentTime: now,
        timeUntilEnd: Math.round((endTimestamp - now) / 1000),
        LiveActivityAvailable: !!LiveActivity?.startActivity
      });

      if (!LiveActivity?.startActivity) {
        console.log('❌ LiveActivity.startActivity is not available - app may need rebuild after adding plugin');
        return undefined;
      }

      const activityId = LiveActivity.startActivity(state, config);

      if (activityId) {
        this.lastUnlockActivityId = activityId;
        this.unlockEndTimestamp = endTimestamp;
        console.log('✅ Live Activity started with ID:', activityId);
        return activityId;
      } else {
        console.log('❌ Failed to start Live Activity - returned undefined');
        return undefined;
      }
    } catch (error) {
      console.error('❌ Error starting Live Activity:', error);
      console.error('💡 Hint: Make sure to rebuild the app after adding expo-live-activity plugin');
      return undefined;
    }
  }

  /**
   * Stop an active Live Activity
   * @param activityId - The ID of the activity to stop
   * @param reason - Optional reason for stopping (for final state)
   */
  static stopUnlockCountdown(activityId: string, reason: 'expired' | 'manual' = 'expired'): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      console.log('🛑 Stopping Live Activity:', activityId, 'Reason:', reason);

      // Final state showing the countdown has ended
      // Note: Do NOT pass imageName here — the native stopActivity runs
      // updateImages() before activity.end(), and if image resolution fails
      // the Task throws silently and the activity is never dismissed.
      const finalState: LiveActivity.LiveActivityState = {
        title: reason === 'expired' ? "Focus Session Complete" : "Focus Session Ended",
        subtitle: "Apps are now unblocked",
        progressBar: {
          date: Date.now(), // Set to now to show 00:00
        },
      };

      LiveActivity.stopActivity(activityId, finalState);
      if (this.lastUnlockActivityId === activityId) {
        this.lastUnlockActivityId = undefined;
        this.unlockEndTimestamp = undefined;
      }
      console.log('✅ Live Activity stopped');
    } catch (error: any) {
      // Activity might have already expired/ended naturally, which is fine
      if (error?.code === 'ERR_ACTIVITY_NOT_FOUND') {
        console.log('ℹ️ Live Activity already ended (likely expired naturally)');
        if (this.lastUnlockActivityId === activityId) {
          this.lastUnlockActivityId = undefined;
          this.unlockEndTimestamp = undefined;
        }
      } else {
        console.error('❌ Error stopping Live Activity:', error);
      }
    }
  }

  /**
   * Start a new Live Activity for focus session timer
   * @param endTime - When the focus session ends
   * @param durationMinutes - Total focus session duration in minutes
   * @param labelName - The focus label/tag name
   * @returns Activity ID if started successfully, undefined otherwise
   */
  static startFocusTimer(endTime: Date, durationMinutes: number, labelName: string): string | undefined {
    // Check if Live Activities are available
    if (!this.isAvailable()) {
      console.log('Live Activities not available:', {
        platform: Platform.OS,
        osVersion: Device.osVersion,
        moduleAvailable: !!LiveActivity?.startActivity,
        requiresIOS162: 'iOS 16.2+'
      });
      return undefined;
    }

    try {
      // Store tag info for later idle state
      this.lastTagName = labelName;
      this.lastDurationMinutes = durationMinutes;

      const now = Date.now();
      const endTimestamp = endTime.getTime();
      const startTimestamp = endTimestamp - durationMinutes * 60 * 1000;

      // State for Live Activity
      const state: LiveActivity.LiveActivityState = {
        title: labelName,
        subtitle: `${durationMinutes}m focus session`,
        progressBar: {
          date: endTimestamp,
        },
        imageName: 'app_icon',
        dynamicIslandImageName: 'app_icon',
        dynamicIslandText: labelName,
        timerStartDateInMilliseconds: startTimestamp,
      };

      console.log('🎬 Starting Live Activity for focus timer:', {
        label: labelName,
        duration: durationMinutes,
        endsAt: endTime.toLocaleTimeString(),
        endTimestamp: endTimestamp,
        currentTime: now,
        timeUntilEnd: Math.round((endTimestamp - now) / 1000),
        existingActivityId: this.lastFocusActivityId,
      });

      if (!LiveActivity?.startActivity) {
        console.log('❌ LiveActivity.startActivity is not available - app may need rebuild after adding plugin');
        return undefined;
      }

      // Reuse existing live activity if one is still around (e.g. previous
      // session completed but iOS hasn't dismissed it yet). This ensures at
      // most one focus live activity is shown at any time.
      if (this.lastFocusActivityId) {
        try {
          LiveActivity.updateActivity(this.lastFocusActivityId, state);
          this.focusEndTimestamp = endTimestamp;
          console.log('♻️ Reused existing Live Activity:', this.lastFocusActivityId);
          return this.lastFocusActivityId;
        } catch (e: any) {
          // Activity was already dismissed by iOS — fall through to create a new one
          console.log('ℹ️ Could not reuse existing activity, creating new one:', e?.message);
          this.lastFocusActivityId = undefined;
          this.focusEndTimestamp = undefined;
        }
      }

      // Configuration for Live Activity — pick colors based on current system appearance
      const palette = Appearance.getColorScheme() === 'dark' ? LA_COLORS.dark : LA_COLORS.light;
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: palette.backgroundColor,
        titleColor: palette.titleColor,
        subtitleColor: palette.subtitleColor,
        progressViewTint: '#FF6347',
        progressViewLabelColor: palette.progressViewLabelColor,
        // No deepLinkUrl — tapping the live activity opens the app via default iOS
        // behavior without triggering Expo Router navigation to a nonexistent route.
        timerType: 'digital',
      };

      const activityId = LiveActivity.startActivity(state, config);

      if (activityId) {
        this.lastFocusActivityId = activityId;
        this.focusEndTimestamp = endTimestamp;
        console.log('✅ Live Activity started with ID:', activityId);
        return activityId;
      } else {
        console.log('❌ Failed to start Live Activity - returned undefined');
        return undefined;
      }
    } catch (error) {
      console.error('❌ Error starting Live Activity:', error);
      console.error('💡 Hint: Make sure to rebuild the app after adding expo-live-activity plugin');
      return undefined;
    }
  }

  /**
   * Start a Live Activity for an infinite (no end time) focus session.
   * Uses the start time so iOS shows an elapsed count-up timer.
   * @param startTime - When the focus session started
   * @param labelName - The focus label/tag name
   * @returns Activity ID if started successfully, undefined otherwise
   */
  static startFocusTimerInfinite(startTime: Date, labelName: string): string | undefined {
    if (!this.isAvailable()) {
      return undefined;
    }

    try {
      // Store tag info for later idle state
      this.lastTagName = labelName;
      this.lastDurationMinutes = 0; // 0 = infinite

      const state: LiveActivity.LiveActivityState = {
        title: labelName,
        subtitle: '∞ focus session',
        progressBar: {
          date: startTime.getTime(), // Past date → iOS timer widget counts UP
        },
        imageName: 'app_icon',
        dynamicIslandImageName: 'app_icon',
        dynamicIslandText: labelName,
      };

      if (!LiveActivity?.startActivity) {
        return undefined;
      }

      // Reuse existing live activity if one is still around
      if (this.lastFocusActivityId) {
        try {
          LiveActivity.updateActivity(this.lastFocusActivityId, state);
          this.focusEndTimestamp = undefined;
          return this.lastFocusActivityId;
        } catch (e) {
          this.lastFocusActivityId = undefined;
          this.focusEndTimestamp = undefined;
        }
      }

      const palette = Appearance.getColorScheme() === 'dark' ? LA_COLORS.dark : LA_COLORS.light;
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: palette.backgroundColor,
        titleColor: palette.titleColor,
        subtitleColor: palette.subtitleColor,
        progressViewTint: '#FF6347',
        progressViewLabelColor: palette.progressViewLabelColor,
        timerType: 'digital',
      };

      const activityId = LiveActivity.startActivity(state, config);

      if (activityId) {
        this.lastFocusActivityId = activityId;
        this.focusEndTimestamp = undefined; // No end time for infinite
        return activityId;
      }
      return undefined;
    } catch (error) {
      console.error('Error starting infinite focus Live Activity:', error);
      return undefined;
    }
  }

  /**
   * Stop a focus timer Live Activity
   * @param activityId - The ID of the activity to stop
   * @param reason - Optional reason for stopping (for final state)
   */
  static stopFocusTimer(activityId: string, reason: 'completed' | 'cancelled' = 'completed'): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      // Build idle state with tag info so the LA shows a "Start" button
      const durationLabel = this.lastDurationMinutes != null
        ? (this.lastDurationMinutes > 0 ? `${this.lastDurationMinutes} min` : '∞')
        : undefined;

      const idleState: LiveActivity.LiveActivityState = {
        title: this.lastTagName || 'Focus',
        subtitle: durationLabel,
        imageName: 'app_icon',
        dynamicIslandImageName: 'app_icon',
        dynamicIslandText: this.lastTagName || 'Focus',
        isIdle: true,
        tagId: this.lastTagId,
        durationMinutes: this.lastDurationMinutes,
      };

      // Transition to idle via updateActivity so the activity stays alive
      // and can be updated when the user changes tag/duration.
      console.log('🛑 Transitioning Focus Timer Live Activity to idle:', activityId, 'Reason:', reason);
      LiveActivity.updateActivity(activityId, idleState);
      // Keep lastFocusActivityId so subsequent tag/duration changes can
      // update this activity via showIdleFocusActivity / hasFocusActivity.
      this.focusEndTimestamp = undefined;
      console.log('✅ Focus Timer Live Activity transitioned to idle');
    } catch (error: any) {
      const errorCode = error?.code || error?.cause?.code;
      if (errorCode === 'ERR_ACTIVITY_NOT_FOUND') {
        console.log('ℹ️ Focus Timer Live Activity already ended (likely expired naturally)');
      } else {
        console.error('❌ Error stopping Focus Timer Live Activity:', error);
      }
      if (this.lastFocusActivityId === activityId) {
        this.lastFocusActivityId = undefined;
      }
      this.focusEndTimestamp = undefined;
    }
  }

  /**
   * Check if Live Activities are available on this device
   */
  static isAvailable(): boolean {
    // Live Activities require iOS 16.2+
    const isIOSVersionSupported = Platform.OS === 'ios' &&
      Device.osVersion != null &&
      parseFloat(Device.osVersion) >= 16.2;

    const isModuleAvailable = LiveActivity && typeof LiveActivity.startActivity === 'function';

    return isIOSVersionSupported && isModuleAvailable;
  }

  /**
   * End any tracked live activities whose timer has expired. Called from
   * _layout.tsx on app foreground as a safety net — JS timers are suspended
   * while the app is in the background, so stopActivity can't be called until
   * the user opens the app again. Only cleans up expired activities; running
   * sessions are left alone.
   */
  static cleanupExpired(): void {
    if (!this.isAvailable()) return;

    // No-op: expired activities (both unlock and focus) stay alive so iOS
    // continues to render their stale state (e.g. "Unblock Expired" or
    // "Bonus Time") until the user manually dismisses them.
  }

  /**
   * Check if a focus session is currently tracked (activity ID exists).
   * Used by the focus screen to avoid double-stopping.
   */
  static get hasFocusActivity(): boolean {
    return !!this.lastFocusActivityId;
  }

  /**
   * Adopt a Live Activity that was started by the widget extension.
   * Sets the internal tracking state so stopFocusTimer() works correctly
   * when the app eventually stops the session.
   */
  static adoptWidgetActivity(activityId: string, endTimestamp?: number): void {
    this.lastFocusActivityId = activityId;
    this.focusEndTimestamp = endTimestamp;
    console.log('📱 [LiveActivity] Adopted widget activity:', activityId);
  }

  /**
   * Store tag info for later use in idle state transitions.
   * Called before starting a focus session so that stopFocusTimer and
   * showIdleFocusActivity know what tag/duration to display.
   */
  static setLastTag(tagId: string | undefined, tagName: string, durationMinutes: number): void {
    this.lastTagId = tagId;
    this.lastTagName = tagName;
    this.lastDurationMinutes = durationMinutes;
  }

  /**
   * Update all active Live Activities with idle state showing the given
   * tag/duration. Uses updateAllActivities so it works regardless of
   * whether we still have the activity ID tracked in memory.
   */
  static showIdleFocusActivity(tagName: string, tagId?: string, durationMinutes?: number): void {
    if (!this.isAvailable()) return;

    const durationLabel = durationMinutes != null
      ? (durationMinutes > 0 ? `${durationMinutes} min` : '∞')
      : undefined;

    const idleState: LiveActivity.LiveActivityState = {
      title: tagName,
      subtitle: durationLabel,
      imageName: 'app_icon',
      dynamicIslandImageName: 'app_icon',
      dynamicIslandText: tagName,
      isIdle: true,
      tagId,
      durationMinutes,
    };

    LiveActivity.updateAllActivities(idleState);
    this.focusEndTimestamp = undefined;
    console.log('✅ Updated all idle focus LAs with tag:', tagName, 'duration:', durationMinutes);
  }

  /**
   * Truly end the focus Live Activity (dismiss it completely).
   * Used when the user explicitly dismisses or in rare cleanup cases.
   */
  static endFocusActivity(activityId?: string): void {
    if (!this.isAvailable()) return;

    const id = activityId || this.lastFocusActivityId;
    if (!id) return;

    try {
      const finalState: LiveActivity.LiveActivityState = {
        title: 'Session Ended',
      };
      LiveActivity.stopActivity(id, finalState);
      if (this.lastFocusActivityId === id) {
        this.lastFocusActivityId = undefined;
      }
      this.focusEndTimestamp = undefined;
      console.log('✅ Ended focus Live Activity:', id);
    } catch (error: any) {
      const errorCode = error?.code || error?.cause?.code;
      if (errorCode === 'ERR_ACTIVITY_NOT_FOUND') {
        if (this.lastFocusActivityId === id) {
          this.lastFocusActivityId = undefined;
        }
      }
      this.focusEndTimestamp = undefined;
    }
  }

}