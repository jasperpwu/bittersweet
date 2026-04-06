import * as LiveActivity from 'expo-live-activity';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

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
  // Track the last unlock activity ID so we can clean up stale ones
  private static lastUnlockActivityId: string | undefined;

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
          });
        } catch (e) {
          // Already ended — ignore
        }
        this.lastUnlockActivityId = undefined;
      }

      const now = Date.now();
      const endTimestamp = endTime.getTime();

      // State for Live Activity (using correct expo-live-activity API)
      const state: LiveActivity.LiveActivityState = {
        title: reason || 'Unlocked',
        subtitle: `${durationMinutes}m unlock`,
        progressBar: {
          date: endTimestamp,
        },
        imageName: 'app_icon',
        dynamicIslandImageName: 'app_icon',
        dynamicIslandText: reason || 'Unlocked'
      };

      // Configuration for Live Activity
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: '#D2B48C',
        titleColor: '#8B4513',
        subtitleColor: '#8B4513',
        progressViewTint: '#FF6347',
        progressViewLabelColor: '#8B4513',
        deepLinkUrl: '/dashboard',
        timerType: 'digital',
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
      const finalState: LiveActivity.LiveActivityState = {
        title: reason === 'expired' ? "Focus Session Complete" : "Focus Session Ended",
        subtitle: "Apps are now unblocked",
        progressBar: {
          date: Date.now(), // Set to now to show 00:00
        },
        imageName: "app_icon"
      };

      LiveActivity.stopActivity(activityId, finalState);
      if (this.lastUnlockActivityId === activityId) {
        this.lastUnlockActivityId = undefined;
      }
      console.log('✅ Live Activity stopped');
    } catch (error: any) {
      // Activity might have already expired/ended naturally, which is fine
      if (error?.code === 'ERR_ACTIVITY_NOT_FOUND') {
        console.log('ℹ️ Live Activity already ended (likely expired naturally)');
        if (this.lastUnlockActivityId === activityId) {
          this.lastUnlockActivityId = undefined;
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
      const now = Date.now();
      const endTimestamp = endTime.getTime();

      // State for Live Activity
      const state: LiveActivity.LiveActivityState = {
        title: labelName,
        subtitle: `${durationMinutes}m focus session`,
        progressBar: {
          date: endTimestamp,
        },
        imageName: 'app_icon',
        dynamicIslandImageName: 'app_icon',
        dynamicIslandText: labelName
      };

      // Configuration for Live Activity
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: '#D2B48C',
        titleColor: '#8B4513',
        subtitleColor: '#8B4513',
        progressViewTint: '#FF6347',
        progressViewLabelColor: '#8B4513',
        deepLinkUrl: '/dashboard',
        timerType: 'digital',
      };

      console.log('🎬 Starting Live Activity for focus timer:', {
        label: labelName,
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
   * Stop a focus timer Live Activity
   * @param activityId - The ID of the activity to stop
   * @param reason - Optional reason for stopping (for final state)
   */
  static stopFocusTimer(activityId: string, reason: 'completed' | 'cancelled' = 'completed'): void {
    if (!this.isAvailable()) {
      return;
    }

    try {
      console.log('🛑 Stopping Focus Timer Live Activity:', activityId, 'Reason:', reason);

      // Final state showing the session has ended
      const finalState: LiveActivity.LiveActivityState = {
        title: reason === 'completed' ? "Focus Session Complete" : "Focus Session Cancelled",
        subtitle: "Great work!",
        progressBar: {
          date: Date.now(), // Set to now to show 00:00
        },
        imageName: "app_icon"
      };

      LiveActivity.stopActivity(activityId, finalState);
      console.log('✅ Focus Timer Live Activity stopped');
    } catch (error: any) {
      // Activity might have already expired/ended naturally, which is fine
      const errorCode = error?.code || error?.cause?.code;
      if (errorCode === 'ERR_ACTIVITY_NOT_FOUND') {
        console.log('ℹ️ Focus Timer Live Activity already ended (likely expired naturally)');
      } else {
        console.error('❌ Error stopping Focus Timer Live Activity:', error);
      }
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
}