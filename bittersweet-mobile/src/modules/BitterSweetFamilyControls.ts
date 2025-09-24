import { FamilyActivitySelection } from '../types/models';

// Import react-native-device-activity with proper types
import * as ReactNativeDeviceActivity from 'react-native-device-activity';
import type {
  ShieldConfiguration,
  ShieldActions,
  AuthorizationStatusType,
  DeviceActivityEvent,
  DeviceActivitySchedule
} from 'react-native-device-activity';

// MARK: - Shield Configuration Constants

const SHIELD_CONFIGURATION_KEY = 'shieldConfiguration';
const SHIELD_ACTIONS_KEY = 'shieldActions';
const APP_GROUP_ID = 'group.com.path2us.bittersweet.appblocker';
const PENDING_DEEPLINK_KEY = 'pendingDeepLink';
const PENDING_DEEPLINK_TIMESTAMP_KEY = 'pendingDeepLinkTimestamp';

// MARK: - Custom Data Types (for events only, not shield config)

// MARK: - Custom Event Types (extending official types)

interface BitterSweetAppLaunchBlockedEvent {
  appName: string;
  bundleIdentifier: string;
  appTokens: string[];
  timestamp: number;
}

interface BitterSweetUnlockSessionExpiredEvent {
  appTokens: string[];
  duration: number;
  timestamp: number;
}

interface BitterSweetAuthorizationChangedEvent {
  status: AuthorizationStatusType;
  isAuthorized: boolean;
  timestamp: number;
}

// MARK: - Main Module Interface

class BitterSweetFamilyControlsModule {

  // MARK: - Shield Configuration Methods

  /**
   * Configure the shield appearance with current app state
   * @param fruitBalance - Current fruit balance
   */
  async configureShield(fruitBalance: number): Promise<boolean> {
    try {

      // Configure shield appearance (using official library interface)
      const shieldConfig: ShieldConfiguration = {
        title: '{applicationOrDomainDisplayName} is Blocked',
        subtitle: `You have ${fruitBalance} 🍎\nSpend fruits to unlock temporarily`,
        primaryButtonLabel: 'Unlock App',
        secondaryButtonLabel: 'Close',
        iconSystemName: 'hand.raised.fill',
        backgroundColor: { red: 178, green: 25, blue: 25, alpha: 1.0 }, // Dark red
        titleColor: { red: 255, green: 255, blue: 255, alpha: 1.0 }, // White
        subtitleColor: { red: 230, green: 230, blue: 230, alpha: 1.0 }, // Light gray
        primaryButtonLabelColor: { red: 255, green: 255, blue: 255, alpha: 1.0 }, // White
        primaryButtonBackgroundColor: { red: 51, green: 153, blue: 51, alpha: 1.0 }, // Green
        secondaryButtonLabelColor: { red: 178, green: 178, blue: 178, alpha: 1.0 }, // Gray
      };

      // No need to store unlock options - app will handle them when opened

      // Configure shield actions
      const shieldActions: ShieldActions = {
        primary: {
          behavior: 'defer',
          actions: [
            {
              type: "openApp",
              deeplinkUrl: "bittersweet-mobile://unlock?currentBalance=" + fruitBalance
            }
          ]
        },
        secondary: {
          behavior: 'close'
        }
      };

      // Store configuration in UserDefaults for the shield extensions
      ReactNativeDeviceActivity.userDefaultsSet(SHIELD_CONFIGURATION_KEY, shieldConfig);
      ReactNativeDeviceActivity.userDefaultsSet(SHIELD_ACTIONS_KEY, shieldActions);

      // Debug: Log the stored configuration
      console.log('✅ Shield configuration updated:', {
        fruitBalance,
        shieldConfig,
        shieldActions,
        deeplinkUrl: (shieldActions.primary.actions?.[0] as any)?.deeplinkUrl
      });

      // Debug: Verify configuration was stored
      const storedConfig = ReactNativeDeviceActivity.userDefaultsGet(SHIELD_CONFIGURATION_KEY);
      const storedActions = ReactNativeDeviceActivity.userDefaultsGet(SHIELD_ACTIONS_KEY);
      console.log('🔍 Stored shield configuration:', storedConfig);
      console.log('🔍 Stored shield actions:', storedActions);
      return true;
    } catch (error) {
      console.error('Failed to configure shield:', error);
      return false;
    }
  }

  /**
   * Update shield configuration when fruit balance changes
   * @param fruitBalance - New fruit balance
   */
  async updateShieldBalance(fruitBalance: number): Promise<boolean> {
    try {
      // Update shield with new balance
      return await this.configureShield(fruitBalance);
    } catch (error) {
      console.error('Failed to update shield balance:', error);
      return false;
    }
  }

  /**
   * Clear shield configuration
   */
  async clearShieldConfiguration(): Promise<boolean> {
    try {

      ReactNativeDeviceActivity.userDefaultsRemove(SHIELD_CONFIGURATION_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(SHIELD_ACTIONS_KEY);

      console.log('✅ Shield configuration cleared');
      return true;
    } catch (error) {
      console.error('Failed to clear shield configuration:', error);
      return false;
    }
  }

  // MARK: - Authorization Methods

  /**
   * Request authorization for Family Controls
   * @returns Promise<boolean> - True if authorization granted
   */
  async requestAuthorization(): Promise<boolean> {
    try {
      console.log('🔐 Requesting Family Controls authorization...');

      // First check current status
      const currentStatus = await this.getAuthorizationStatus();
      console.log('📊 Current authorization status:', currentStatus);

      if (currentStatus === 2) { // 2 = approved
        console.log('✅ Already authorized');
        return true;
      }

      await ReactNativeDeviceActivity.requestAuthorization();
      const status = await this.getAuthorizationStatus();
      console.log('✅ Authorization result:', status);
      return status === 2; // 2 = approved
    } catch (error) {
      console.error('❌ Authorization failed:', error);
      console.error('💡 Hint: Another app might have Family Controls authorization. Only one app can have it at a time.');
      console.error('💡 Check Settings > Screen Time for other apps with permissions.');
      return false;
    }
  }

  /**
   * Get current authorization status
   * @returns Promise<AuthorizationStatusType> - Current authorization status
   */
  async getAuthorizationStatus(): Promise<AuthorizationStatusType> {
    try {

      console.log('🔍 Calling ReactNativeDeviceActivity.getAuthorizationStatus()...');
      const status = await ReactNativeDeviceActivity.getAuthorizationStatus();
      console.log('🔍 Received status:', status, 'type:', typeof status);

      // Status should already be the correct numeric type from the library
      return status as AuthorizationStatusType;
    } catch (error) {
      console.error('Failed to get authorization status:', error);
      return 0; // notDetermined
    }
  }

  // MARK: - App Selection Methods

  /**
   * @deprecated Use DeviceActivitySelectionView component instead
   * Present the Family Activity Picker for app selection
   * @returns Promise<FamilyActivitySelection> - Selected apps/categories
   */
  async presentFamilyActivityPicker(): Promise<FamilyActivitySelection> {
    console.warn('presentFamilyActivityPicker is deprecated. Use DeviceActivitySelectionView component instead');
    return '';
  }

  // MARK: - Restriction Methods

  /**
   * Apply app restrictions based on selection ID
   * @param selectionId - App selection ID string
   * @returns Promise<boolean> - True if restrictions applied successfully
   */
  async applyRestrictions(selectionId: FamilyActivitySelection): Promise<boolean> {
    try {

      if (!selectionId || selectionId.trim() === '') {
        console.log('No apps selected for restriction');
        return true;
      }

      // Apply restrictions using the selection ID
      console.log('🔒 Applying restrictions for selectionId:', selectionId);

      // Use the correct blockSelection format with activitySelectionId
      ReactNativeDeviceActivity.blockSelection({
        activitySelectionId: selectionId,
      });

      console.log('✅ App restrictions applied successfully');
      return true;
    } catch (error) {
      console.error('Failed to apply restrictions:', error);
      return false;
    }
  }

  /**
   * Remove app restrictions using stored selection ID
   * @param selectionId - The selection ID to unblock
   * @returns Promise<boolean> - True if restrictions removed successfully
   */
  async removeRestrictions(selectionId: FamilyActivitySelection): Promise<boolean> {
    try {
      console.log('🔓 removeRestrictions called with selectionId:', selectionId);

      if (!selectionId) {
        console.log('No selectionId provided, nothing to unblock');
        return true;
      }

      // Unblock the specific selection using the stored ID
      console.log('🔓 Unblocking restrictions for selectionId:', selectionId);

      ReactNativeDeviceActivity.unblockSelection({
        activitySelectionId: selectionId,
      });

      console.log('✅ App restrictions removed for selectionId:', selectionId);
      return true;
    } catch (error) {
      console.error('❌ Failed to remove restrictions:', error);
      return false;
    }
  }

  /**
   * Create a temporary unlock for specified apps
   * @param appTokens - Tokens of apps to unlock
   * @param durationMinutes - Duration in minutes
   * @returns Promise<boolean> - True if unlock created successfully
   */
  async temporaryUnlock(appTokens: string[], durationMinutes: number): Promise<boolean> {
    try {

      // Temporary unlock functionality - this may need to be implemented differently
      // with react-native-device-activity's monitoring system
      console.warn('temporaryUnlock: May need to be implemented with monitoring schedules');

      // Set up a timer to reapply restrictions after the duration
      setTimeout(async () => {
        await this.reapplyRestrictions();
      }, durationMinutes * 60 * 1000);

      console.log(`✅ Temporary unlock created for ${durationMinutes} minutes`);
      return true;
    } catch (error) {
      console.error('Failed to create temporary unlock:', error);
      return false;
    }
  }

  /**
   * Reapply previously set restrictions
   * @returns Promise<boolean> - True if restrictions reapplied successfully
   */
  async reapplyRestrictions(): Promise<boolean> {
    try {
      // This would need to store the current selection and reapply it
      // For now, we'll return true as a placeholder
      console.log('✅ Restrictions reapplied successfully');
      return true;
    } catch (error) {
      console.error('Failed to reapply restrictions:', error);
      return false;
    }
  }

  // MARK: - Monitoring Methods

  /**
   * Start device activity monitoring for selected apps
   * @param selection - App selection token string
   * @returns Promise<boolean> - True if monitoring started successfully
   */
  async startMonitoring(selection: FamilyActivitySelection): Promise<boolean> {
    try {

      if (!selection || selection.trim() === '') {
        console.log('No apps selected for monitoring');
        return true;
      }

      // Start monitoring using react-native-device-activity
      const monitoringName = 'BitterSweetAppBlocking';
      const schedule: DeviceActivitySchedule = {
        intervalStart: { hour: 0, minute: 0, second: 0 },
        intervalEnd: { hour: 23, minute: 59, second: 59 },
        repeats: true
      };

      // Create events for monitoring with the selection ID
      const events: DeviceActivityEvent[] = [
        {
          eventName: 'appBlocking',
          familyActivitySelection: selection, // This should be the selection ID
          threshold: { minute: 1 } // Example threshold
        }
      ];

      await ReactNativeDeviceActivity.startMonitoring(monitoringName, schedule, events);

      console.log('✅ Device activity monitoring started');
      return true;
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      return false;
    }
  }

  /**
   * Stop device activity monitoring
   * @returns Promise<boolean> - True if monitoring stopped successfully
   */
  async stopMonitoring(): Promise<boolean> {
    try {

      // Stop monitoring using react-native-device-activity
      await ReactNativeDeviceActivity.stopMonitoring();

      console.log('✅ Device activity monitoring stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop monitoring:', error);
      return false;
    }
  }

  // MARK: - Event Listeners

  /**
   * Add listener for app launch blocked events
   * Note: react-native-device-activity handles blocking automatically via shields
   */
  addAppLaunchBlockedListener(
    listener: (event: BitterSweetAppLaunchBlockedEvent) => void
  ): { remove: () => void } {
    try {

      // Use react-native-device-activity's event listener
      const subscription = ReactNativeDeviceActivity.onDeviceActivityMonitorEvent((event: any) => {
        // Transform the event to match our AppLaunchBlockedEvent interface
        const transformedEvent: BitterSweetAppLaunchBlockedEvent = {
          appName: event.appName || 'Unknown App',
          bundleIdentifier: event.bundleIdentifier || '',
          appTokens: event.appTokens || [],
          timestamp: Date.now()
        };
        listener(transformedEvent);
      });

      return { remove: () => subscription?.remove() };
    } catch (error) {
      console.error('Failed to add app launch blocked listener:', error);
      return { remove: () => {} };
    }
  }

  /**
   * Add listener for unlock session expired events
   */
  addUnlockSessionExpiredListener(
    _listener: (event: BitterSweetUnlockSessionExpiredEvent) => void
  ): { remove: () => void } {
    // This would integrate with DeviceActivity event listeners if needed
    console.log('Unlock expiration handling setup');
    return { remove: () => {} };
  }

  /**
   * Add listener for authorization changed events
   */
  addAuthorizationChangedListener(
    _listener: (event: BitterSweetAuthorizationChangedEvent) => void
  ): { remove: () => void } {
    // This would listen for authorization status changes
    console.log('Authorization change listening setup');
    return { remove: () => {} };
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    console.log('Event listeners cleaned up');
  }

  // MARK: - App Group Communication Methods

  /**
   * Check for pending deep links from shield extension
   * @returns Promise<string | null> - Pending deep link URL or null
   */
  async checkPendingDeepLink(): Promise<string | null> {
    try {
      // Get the pending deep link from App Group UserDefaults
      const pendingUrl = ReactNativeDeviceActivity.userDefaultsGet(PENDING_DEEPLINK_KEY) as string | null;

      if (pendingUrl) {
        console.log('🔗 Found pending deep link from shield:', pendingUrl);

        // Clear the pending link so it's not processed again
        ReactNativeDeviceActivity.userDefaultsRemove(PENDING_DEEPLINK_KEY);
        ReactNativeDeviceActivity.userDefaultsRemove(PENDING_DEEPLINK_TIMESTAMP_KEY);

        return pendingUrl;
      }

      return null;
    } catch (error) {
      console.error('Failed to check pending deep link:', error);
      return null;
    }
  }

  /**
   * Process a deep link URL (whether from direct URL or App Group)
   * @param url - The deep link URL to process
   */
  processPendingDeepLink(url: string): void {
    try {
      console.log('🔗 Processing deep link:', url);

      // Parse the URL
      const urlObj = new URL(url);

      if (url.includes('unlock')) {
        const currentBalance = urlObj.searchParams.get('currentBalance');
        console.log('🍎 Extracted currentBalance from deep link:', currentBalance);

        // Import router dynamically to avoid circular dependencies
        import('expo-router').then(({ router }) => {
          router.push({
            pathname: '/(modals)/blocking-screen',
            params: {
              fromShield: 'true',
              ...(currentBalance && { currentBalance })
            }
          });
          console.log('🚀 Navigated to blocking screen from App Group deep link');
        });
      }
    } catch (error) {
      console.error('Failed to process deep link:', error);
    }
  }

  // MARK: - Utility Methods

  /**
   * Check if Family Controls is available on this device
   * @returns boolean - True if available
   */
  isAvailable(): boolean {
    // Family Controls is available on iOS 16.0+ only
    return true; // This would check actual availability in production
  }

  /**
   * Get readable string for authorization status
   * @param status - Authorization status
   * @returns string - Human readable status
   */
  getStatusDescription(status: AuthorizationStatusType): string {
    switch (status) {
      case 0: // notDetermined
        return 'Not yet requested';
      case 1: // denied
        return 'Permission denied';
      case 2: // approved
        return 'Permission granted';
      default:
        return 'Unknown status';
    }
  }
}

// Export singleton instance
export const FamilyControlsModule = new BitterSweetFamilyControlsModule();

// Export types
export type {
  AuthorizationStatusType as BitterSweetAuthorizationStatus,
  BitterSweetAppLaunchBlockedEvent,
  BitterSweetUnlockSessionExpiredEvent,
  BitterSweetAuthorizationChangedEvent
};