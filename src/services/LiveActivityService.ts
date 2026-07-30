import * as LiveActivity from 'expo-live-activity';
import { Appearance, Platform } from 'react-native';
import * as Device from 'expo-device';
import i18n from '../i18n';

// Localized labels for the natively-rendered Live Activity buttons/statuses.
// Sent with every state update so reused (long-lived) activities pick up
// language changes; the widget falls back to English when absent.
const laLabels = () => ({
  startLabel: i18n.t('liveActivity.start'),
  endLabel: i18n.t('liveActivity.end'),
  unlockedLabel: i18n.t('liveActivity.unlocked'),
  unblockExpiredLabel: i18n.t('liveActivity.unblockExpired'),
});

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
  // Unlock countdown activity tracking. Focus activities are deliberately NOT
  // tracked by ID: the widget extension and app intents mutate them outside
  // this process, so any JS-side ID goes stale. Focus paths instead use the
  // ID-free native primitives (startOrUpdateActivity / updateAllActivities),
  // which query ActivityKit directly.
  private static lastUnlockActivityId: string | undefined;
  private static unlockEndTimestamp: number | undefined;

  // Track last tag info for idle state after session ends
  private static lastTagName: string | undefined;
  private static lastTagId: string | undefined;
  private static lastDurationMinutes: number | undefined;

  /**
   * Whether we have a real tag to show on an idle "Start" card. Without a
   * resolvable tag name the card degrades to a bare "Focus" label with no
   * duration — the blank state we never want to render. When this is false the
   * idle-producing paths dismiss the activity instead of reloading a blank one.
   */
  private static hasResolvableTag(tagName: string | undefined): boolean {
    const name = tagName?.trim();
    // 'Focus' is the generic fallback used everywhere a tag lookup fails; a real
    // tag label is always prefixed with its icon (e.g. "🎯 Focus").
    return !!name && name !== 'Focus';
  }

  /**
   * Dismiss every focus Live Activity (ID-free). Used when there is no
   * resolvable tag, so a blank idle card is removed rather than left/reloaded.
   */
  private static async dismissBlankIdle(context: string): Promise<void> {
    if (!LiveActivity?.endAllFocusActivities) return;
    try {
      await LiveActivity.endAllFocusActivities();
      console.log(`🧹 Dismissed blank idle focus LA (no resolvable tag) [${context}]`);
    } catch (error) {
      console.error('❌ Error dismissing blank idle focus LA:', error);
    }
  }

  /**
   * Start a new Live Activity for unlock countdown
   * @param endTime - When the unlock expires
   * @param durationMinutes - Total unlock duration in minutes
   * @param reason - The reason for unlocking (user-provided text)
   * @returns Activity ID if started successfully, undefined otherwise
   */
  static async startUnlockCountdown(
    endTime: Date,
    durationMinutes: number,
    reason?: string
  ): Promise<string | undefined> {
    // Check if Live Activities are available
    if (!this.isAvailable()) {
      console.log('Live Activities not available:', {
        platform: Platform.OS,
        osVersion: Device.osVersion,
        moduleAvailable: !!LiveActivity?.startActivity,
        requiresIOS162: 'iOS 16.2+',
      });
      return undefined;
    }

    try {
      // Stop any stale unlock activity before starting a new one
      if (this.lastUnlockActivityId) {
        console.log('🧹 Cleaning up stale unlock activity:', this.lastUnlockActivityId);
        try {
          await LiveActivity.stopActivity(this.lastUnlockActivityId, {
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
        ...laLabels(),
      };

      // Configuration for Live Activity — pick colors based on current system appearance
      const palette = Appearance.getColorScheme() === 'dark' ? LA_COLORS.dark : LA_COLORS.light;
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: palette.backgroundColor,
        titleColor: palette.titleColor,
        subtitleColor: palette.subtitleColor,
        progressViewTint: '#FF6347',
        progressViewLabelColor: palette.progressViewLabelColor,
        // Empty path → bare scheme "bittersweet-mobile://" → Focus tab (root index),
        // matching the Home Screen widget. A non-root path like "focus" would 404 in
        // Expo Router since the Focus tab has no named route.
        deepLinkUrl: '',
        timerType: 'digital',
        sessionType: 'unlock',
      };

      console.log('🎬 Starting Live Activity for unlock countdown:', {
        duration: durationMinutes,
        endsAt: endTime.toLocaleTimeString(),
        endTimestamp: endTimestamp,
        currentTime: now,
        timeUntilEnd: Math.round((endTimestamp - now) / 1000),
        LiveActivityAvailable: !!LiveActivity?.startActivity,
      });

      if (!LiveActivity?.startActivity) {
        console.log(
          '❌ LiveActivity.startActivity is not available - app may need rebuild after adding plugin'
        );
        return undefined;
      }

      const activityId = await LiveActivity.startActivity(state, config);

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
  static async stopUnlockCountdown(
    activityId: string,
    reason: 'expired' | 'manual' = 'expired'
  ): Promise<void> {
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
        title: reason === 'expired' ? 'Focus Session Complete' : 'Focus Session Ended',
        subtitle: 'Apps are now unblocked',
        progressBar: {
          date: Date.now(), // Set to now to show 00:00
        },
        ...laLabels(),
      };

      await LiveActivity.stopActivity(activityId, finalState);
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
  static async startFocusTimer(
    endTime: Date,
    durationMinutes: number,
    labelName: string
  ): Promise<string | undefined> {
    // Check if Live Activities are available
    if (!this.isAvailable()) {
      console.log('Live Activities not available:', {
        platform: Platform.OS,
        osVersion: Device.osVersion,
        moduleAvailable: !!LiveActivity?.startActivity,
        requiresIOS162: 'iOS 16.2+',
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
        ...laLabels(),
      };

      console.log('🎬 Starting Live Activity for focus timer:', {
        label: labelName,
        duration: durationMinutes,
        endsAt: endTime.toLocaleTimeString(),
        endTimestamp: endTimestamp,
        currentTime: now,
        timeUntilEnd: Math.round((endTimestamp - now) / 1000),
      });

      if (!LiveActivity?.startOrUpdateActivity) {
        console.log(
          '❌ LiveActivity.startOrUpdateActivity is not available - app may need rebuild after patching'
        );
        return undefined;
      }

      // Configuration for Live Activity — pick colors based on current system appearance
      const palette = Appearance.getColorScheme() === 'dark' ? LA_COLORS.dark : LA_COLORS.light;
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: palette.backgroundColor,
        titleColor: palette.titleColor,
        subtitleColor: palette.subtitleColor,
        progressViewTint: '#FF6347',
        progressViewLabelColor: palette.progressViewLabelColor,
        // Empty path → bare scheme "bittersweet-mobile://" → Focus tab (root index).
        deepLinkUrl: '',
        timerType: 'digital',
      };

      // Atomic native update-or-create: reuses the on-screen idle activity if
      // it is still updatable, dismisses ended/duplicate leftovers, and creates
      // a fresh activity otherwise. No JS-side activity ID bookkeeping.
      const activityId = await LiveActivity.startOrUpdateActivity(state, config);

      if (activityId) {
        console.log('✅ Live Activity started/reused with ID:', activityId);
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
  static async startFocusTimerInfinite(
    startTime: Date,
    labelName: string
  ): Promise<string | undefined> {
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
        ...laLabels(),
      };

      if (!LiveActivity?.startOrUpdateActivity) {
        return undefined;
      }

      const palette = Appearance.getColorScheme() === 'dark' ? LA_COLORS.dark : LA_COLORS.light;
      const config: LiveActivity.LiveActivityConfig = {
        backgroundColor: palette.backgroundColor,
        titleColor: palette.titleColor,
        subtitleColor: palette.subtitleColor,
        progressViewTint: '#FF6347',
        progressViewLabelColor: palette.progressViewLabelColor,
        // Empty path → bare scheme "bittersweet-mobile://" → Focus tab (root index).
        deepLinkUrl: '',
        timerType: 'digital',
      };

      // Atomic native update-or-create — see startFocusTimer.
      const activityId = await LiveActivity.startOrUpdateActivity(state, config);
      return activityId || undefined;
    } catch (error) {
      console.error('Error starting infinite focus Live Activity:', error);
      return undefined;
    }
  }

  /**
   * Transition the focus Live Activity to its idle state (shows a "Start"
   * button). ID-free: updates whatever updatable focus activity is on screen
   * via ActivityKit, so it works no matter which process (app or widget
   * intent) created the activity. No-op when nothing updatable is on screen.
   * @param reason - Why the session stopped (logging only)
   */
  static async stopFocusTimer(reason: 'completed' | 'cancelled' = 'completed'): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      // No resolvable tag → dismiss instead of transitioning to a blank
      // "Focus" idle card (statics can be lost across a JS process restart).
      if (!this.hasResolvableTag(this.lastTagName)) {
        await this.dismissBlankIdle('stopFocusTimer');
        return;
      }

      // Build idle state with tag info so the LA shows a "Start" button
      const durationLabel =
        this.lastDurationMinutes != null
          ? this.lastDurationMinutes > 0
            ? `${this.lastDurationMinutes} min`
            : '∞'
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
        ...laLabels(),
      };

      // EXPERIMENT (Dynamic Island suppression) — see endAllFocusActivitiesWithState.
      // Previously this transitioned to idle via update, keeping the activity
      // alive; an alive activity is unavoidably shown in the Dynamic Island,
      // which users report as annoying once the session is over. Ending the
      // activity with the idle card as its FINAL content removes it from the
      // Dynamic Island immediately while the Lock Screen banner survives (up to
      // 4h, ActivityKit's cap).
      //
      // Two known consequences, both being validated on-device:
      //   1. The banner is frozen — update() on an ended activity is a no-op, so
      //      later tag/duration changes won't be reflected.
      //   2. UNVERIFIED: whether Button(intent:) still fires on an ended banner.
      //      If the Start button is dead, this approach is not viable.
      // Revert to `updateAllActivities(idleState)` to restore the old behavior.
      console.log('🛑 Ending focus Live Activity with idle final state, reason:', reason);
      await LiveActivity.endAllFocusActivitiesWithState(idleState);
      console.log('✅ Focus Live Activity ended with idle card (Lock Screen only)');
    } catch (error: any) {
      console.error('❌ Error stopping Focus Timer Live Activity:', error);
    }
  }

  /**
   * Check if Live Activities are available on this device
   */
  static isAvailable(): boolean {
    // Live Activities require iOS 16.2+
    const isIOSVersionSupported =
      Platform.OS === 'ios' && Device.osVersion != null && parseFloat(Device.osVersion) >= 16.2;

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
  static async showIdleFocusActivity(
    tagName: string,
    tagId?: string,
    durationMinutes?: number
  ): Promise<void> {
    if (!this.isAvailable()) return;

    // No resolvable tag → dismiss any idle card rather than reload a blank one.
    if (!this.hasResolvableTag(tagName)) {
      await this.dismissBlankIdle('showIdleFocusActivity');
      return;
    }

    const durationLabel =
      durationMinutes != null ? (durationMinutes > 0 ? `${durationMinutes} min` : '∞') : undefined;

    const idleState: LiveActivity.LiveActivityState = {
      title: tagName,
      subtitle: durationLabel,
      imageName: 'app_icon',
      dynamicIslandImageName: 'app_icon',
      dynamicIslandText: tagName,
      isIdle: true,
      tagId,
      durationMinutes,
      ...laLabels(),
    };

    try {
      await LiveActivity.updateAllActivities(idleState);
      this.lastTagName = tagName;
      this.lastTagId = tagId;
      this.lastDurationMinutes = durationMinutes;
      console.log('✅ Updated all idle focus LAs with tag:', tagName, 'duration:', durationMinutes);
    } catch (error: any) {
      console.error('❌ Error updating all idle focus LAs:', error);
    }
  }

  /**
   * End an unlock countdown by turning it INTO the idle focus card, using the
   * activity that is already on screen as its own replacement.
   *
   * Why not stopUnlockCountdown() + ensureIdleFocusActivity(): that pair
   * dismisses the unlock activity and CREATES a new one, and Activity.request()
   * only ever yields an *active* activity — which always occupies the Dynamic
   * Island. Ending an already-alive activity is the only operation that drops
   * it from the island immediately while leaving the Lock Screen banner up (4h
   * cap). Same mechanism as stopFocusTimer, and what the native StopUnlockIntent
   * path already does via WidgetActivityKit.stopHandler.
   *
   * Rendering is safe even though the activity's immutable attributes still say
   * sessionType "unlock": LiveActivityView checks contentState.isIdle first
   * (LiveActivityView.swift:44), and staleDate nil keeps isStale false so the
   * unlock-specific stale branch in LiveActivityContentRouter never runs.
   */
  static async endUnlockToIdleCard(
    activityId: string,
    tagName: string,
    tagId?: string,
    durationMinutes?: number
  ): Promise<void> {
    if (!this.isAvailable()) return;

    // No resolvable tag → don't leave a blank "Focus" card behind; just dismiss.
    if (!this.hasResolvableTag(tagName)) {
      await this.stopUnlockCountdown(activityId, 'expired');
      return;
    }

    const durationLabel =
      durationMinutes != null ? (durationMinutes > 0 ? `${durationMinutes} min` : '∞') : undefined;

    const idleState: LiveActivity.LiveActivityState = {
      title: tagName,
      subtitle: durationLabel,
      imageName: 'app_icon',
      dynamicIslandImageName: 'app_icon',
      dynamicIslandText: tagName,
      isIdle: true,
      tagId,
      durationMinutes,
      ...laLabels(),
    };

    try {
      // dismissImmediately=false selects ActivityKit's .default policy.
      await LiveActivity.stopActivity(activityId, idleState, false);
      if (this.lastUnlockActivityId === activityId) {
        this.lastUnlockActivityId = undefined;
        this.unlockEndTimestamp = undefined;
      }
      this.lastTagName = tagName;
      this.lastTagId = tagId;
      this.lastDurationMinutes = durationMinutes;
      console.log('✅ Unlock LA ended as idle card (Lock Screen only), tag:', tagName);
    } catch (error: any) {
      if (error?.code === 'ERR_ACTIVITY_NOT_FOUND') {
        // Already gone (expired naturally, or ended by the native intent). Fall
        // back to creating the card — the island will briefly show in this case,
        // which beats leaving the user with no way to start from the lock screen.
        console.log('ℹ️ Unlock LA already ended — creating idle card instead');
        await this.ensureIdleFocusActivity(tagName, tagId, durationMinutes);
      } else {
        console.error('❌ Error ending unlock LA as idle card:', error);
      }
    }
  }

  /**
   * Show an idle focus Live Activity, CREATING one if none is on screen.
   *
   * Used after an unlock countdown ends. Unlike showIdleFocusActivity (which
   * uses updateAllActivities and only transitions an already-alive focus LA),
   * this uses startOrUpdateActivity so a fresh idle activity is created when
   * none exists. That is exactly the unlock-end situation: stopUnlockCountdown
   * has just dismissed the unlock LA (and updateAllActivities deliberately skips
   * unlock-type activities anyway), so there is nothing left to update. The
   * result matches the post-focus-session idle LA — last-used tag + duration +
   * Start button — letting the user relaunch a session from the lock screen.
   */
  static async ensureIdleFocusActivity(
    tagName: string,
    tagId?: string,
    durationMinutes?: number
  ): Promise<void> {
    if (!this.isAvailable()) return;

    // No resolvable tag → don't create a blank idle card; dismiss any leftover.
    if (!this.hasResolvableTag(tagName)) {
      await this.dismissBlankIdle('ensureIdleFocusActivity');
      return;
    }

    const durationLabel =
      durationMinutes != null ? (durationMinutes > 0 ? `${durationMinutes} min` : '∞') : undefined;

    const idleState: LiveActivity.LiveActivityState = {
      title: tagName,
      subtitle: durationLabel,
      imageName: 'app_icon',
      dynamicIslandImageName: 'app_icon',
      dynamicIslandText: tagName,
      isIdle: true,
      tagId,
      durationMinutes,
      ...laLabels(),
    };

    if (!LiveActivity?.startOrUpdateActivity) return;

    // Config is only used when creating a fresh activity; pick colors for the
    // current appearance so the created idle LA matches the focus-timer LA.
    const palette = Appearance.getColorScheme() === 'dark' ? LA_COLORS.dark : LA_COLORS.light;
    const config: LiveActivity.LiveActivityConfig = {
      backgroundColor: palette.backgroundColor,
      titleColor: palette.titleColor,
      subtitleColor: palette.subtitleColor,
      progressViewTint: '#FF6347',
      progressViewLabelColor: palette.progressViewLabelColor,
      // Empty path → bare scheme → Focus tab (root index), matching focus LAs.
      deepLinkUrl: '',
      timerType: 'digital',
    };

    try {
      // NOTE (Dynamic Island suppression): this path deliberately does NOT end
      // the activity the way stopFocusTimer does. There is nothing on screen to
      // end here — stopUnlockCountdown already dismissed the unlock LA — so the
      // idle card must be CREATED, and Activity.request() always yields an
      // active activity, which always occupies the Dynamic Island. Creating and
      // then immediately ending it was tried and reverted: the pod's own
      // detached "request → updateImages → update" Task races the end, leaving
      // the activity in an inconsistent state.
      await LiveActivity.startOrUpdateActivity(idleState, config);

      this.lastTagName = tagName;
      this.lastTagId = tagId;
      this.lastDurationMinutes = durationMinutes;
      console.log('✅ Ensured idle focus LA (create-if-missing) with tag:', tagName);
    } catch (error: any) {
      console.error('❌ Error ensuring idle focus LA:', error);
    }
  }
}
