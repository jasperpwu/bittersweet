import { EventEmitter } from 'expo-modules-core';
import { router } from 'expo-router';
import { useAppStore } from '../../store';

/**
 * Device Activity Listener Service
 *
 * This service listens for notifications from the Device Activity Monitor Extension
 * and handles them appropriately in the main app.
 */

class DeviceActivityListenerService {
  private isListening = false;
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter({});
  }

  /**
   * Start listening for Device Activity notifications
   */
  startListening(): void {
    if (this.isListening) {
      console.log('⚠️ Device Activity Listener already running');
      return;
    }

    this.isListening = true;
    console.log('🔍 Starting Device Activity Listener...');

    // Listen for app blocked notifications
    this.listenForAppBlockedNotifications();

    // Listen for unlock expired notifications
    this.listenForUnlockExpiredNotifications();

    // Start polling for shared data (fallback mechanism)
    this.startSharedDataPolling();

    console.log('✅ Device Activity Listener started');
  }

  /**
   * Stop listening for Device Activity notifications
   */
  stopListening(): void {
    if (!this.isListening) {
      return;
    }

    this.isListening = false;
    console.log('⏹️ Device Activity Listener stopped');
  }

  /**
   * Listen for app blocked notifications from the extension
   */
  private listenForAppBlockedNotifications(): void {
    // In a real implementation, this would listen for Darwin notifications
    // For now, we'll simulate with a polling mechanism

    console.log('📡 Listening for app blocked notifications...');

    // TODO: Implement actual Darwin notification listening
    // CFNotificationCenterAddObserver for "com.path2us.bittersweet.appBlocked"
  }

  /**
   * Listen for unlock expired notifications from the extension
   */
  private listenForUnlockExpiredNotifications(): void {
    console.log('📡 Listening for unlock expired notifications...');

    // TODO: Implement actual Darwin notification listening
    // CFNotificationCenterAddObserver for "com.path2us.bittersweet.unlockExpired"
  }

  /**
   * Poll shared UserDefaults for pending events (fallback mechanism)
   */
  private startSharedDataPolling(): void {
    const pollInterval = 2000; // 2 seconds

    const poll = () => {
      if (!this.isListening) return;

      this.checkForPendingBlockingEvents();
      this.checkForUnlockExpirationEvents();
      this.updateActiveSessionsFromSharedData();

      setTimeout(poll, pollInterval);
    };

    poll();
  }

  /**
   * Check for pending blocking events in shared storage
   */
  private async checkForPendingBlockingEvents(): Promise<void> {
    try {
      // TODO: Read from shared UserDefaults
      // const pendingEvent = await this.readFromSharedDefaults('pendingBlockingEvent');

      // For now, simulate checking
      const hasPendingEvent = false;

      if (hasPendingEvent) {
        // Handle the blocking event
        this.handleAppBlockedEvent({
          bundleIdentifier: 'com.example.app',
          timestamp: Date.now(),
          eventId: 'mock-event-id'
        });
      }
    } catch (error) {
      console.error('❌ Failed to check for pending blocking events:', error);
    }
  }

  /**
   * Check for unlock expiration events in shared storage
   */
  private async checkForUnlockExpirationEvents(): Promise<void> {
    try {
      // TODO: Read from shared UserDefaults
      // const expirationEvent = await this.readFromSharedDefaults('unlockExpirationEvent');

      // For now, simulate checking
      const hasExpirationEvent = false;

      if (hasExpirationEvent) {
        this.handleUnlockExpiredEvent({
          eventName: 'mock-unlock-expired',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('❌ Failed to check for unlock expiration events:', error);
    }
  }

  /**
   * Update active sessions from shared data
   */
  private async updateActiveSessionsFromSharedData(): Promise<void> {
    try {
      // TODO: Read active sessions from shared UserDefaults
      // const activeSessions = await this.readFromSharedDefaults('activeSessions');

      // Sync with store if needed
    } catch (error) {
      console.error('❌ Failed to update active sessions:', error);
    }
  }

  /**
   * Handle app blocked event from extension
   */
  private handleAppBlockedEvent(event: AppBlockedEvent): void {
    console.log('🚫 App blocked event received:', event);

    try {
      // Get app info for the blocking screen
      const appInfo = this.getAppInfoForBundleId(event.bundleIdentifier);

      // Navigate to blocking screen
      router.push({
        pathname: '/(modals)/blocking-screen',
        params: {
          appName: appInfo.name,
          appBundleId: event.bundleIdentifier,
          appTokens: JSON.stringify(appInfo.tokens)
        }
      });

      // Clear the pending event from shared storage
      this.clearPendingEvent('pendingBlockingEvent');

      console.log('✅ Blocking screen presented for:', event.bundleIdentifier);
    } catch (error) {
      console.error('❌ Failed to handle app blocked event:', error);
    }
  }

  /**
   * Handle unlock expired event from extension
   */
  private handleUnlockExpiredEvent(event: UnlockExpiredEvent): void {
    console.log('⏰ Unlock expired event received:', event);

    try {
      // Update store to reflect expired session
      const store = useAppStore.getState();
      store.blocklist.checkActiveUnlocks();

      // Show notification to user
      this.showUnlockExpiredNotification();

      // Clear the event from shared storage
      this.clearPendingEvent('unlockExpirationEvent');

      console.log('✅ Unlock expiration handled');
    } catch (error) {
      console.error('❌ Failed to handle unlock expired event:', error);
    }
  }

  /**
   * Get app information for a bundle identifier
   */
  private getAppInfoForBundleId(bundleIdentifier: string): AppInfo {
    // TODO: Look up app info from the current blocked apps selection
    const store = useAppStore.getState();
    const blockedApps = store.blocklist.settings.blockedApps;

    const appToken = blockedApps.applicationTokens.find(
      token => token.bundleIdentifier === bundleIdentifier
    );

    if (appToken) {
      return {
        name: appToken.displayName,
        bundleId: bundleIdentifier,
        tokens: [appToken]
      };
    }

    // Fallback if app not found in blocked list
    return {
      name: 'Unknown App',
      bundleId: bundleIdentifier,
      tokens: []
    };
  }

  /**
   * Show notification about unlock session expiration
   */
  private showUnlockExpiredNotification(): void {
    // TODO: Show local notification or in-app alert
    console.log('📱 Showing unlock expired notification');
  }

  /**
   * Clear a pending event from shared storage
   */
  private async clearPendingEvent(eventKey: string): Promise<void> {
    try {
      // TODO: Clear from shared UserDefaults
      console.log(`🧹 Clearing pending event: ${eventKey}`);
    } catch (error) {
      console.error(`❌ Failed to clear pending event ${eventKey}:`, error);
    }
  }

  /**
   * Read data from shared UserDefaults
   */
  private async readFromSharedDefaults(key: string): Promise<any> {
    // TODO: Implement reading from shared UserDefaults
    // This would require a native module method or bridge
    return null;
  }
}

// MARK: - Types

interface AppBlockedEvent {
  bundleIdentifier: string;
  timestamp: number;
  eventId: string;
}

interface UnlockExpiredEvent {
  eventName: string;
  timestamp: number;
}

interface AppInfo {
  name: string;
  bundleId: string;
  tokens: any[];
}

// Export singleton instance
export const DeviceActivityListener = new DeviceActivityListenerService();

// Export types
export type {
  AppBlockedEvent,
  UnlockExpiredEvent,
  AppInfo
};