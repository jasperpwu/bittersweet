import { FamilyActivitySelection } from '../types/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WidgetService } from '../services/WidgetService';
import Constants from 'expo-constants';
import i18n from '../i18n';

// Import react-native-device-activity with proper types
import * as ReactNativeDeviceActivity from 'react-native-device-activity';
import type {
  ShieldConfiguration,
  ShieldActions,
  AuthorizationStatusType,
  DeviceActivityEvent,
  DeviceActivitySchedule,
} from 'react-native-device-activity';

// MARK: - Shield Configuration Constants

const SHIELD_CONFIGURATION_KEY = 'shieldConfiguration';
const SHIELD_ACTIONS_KEY = 'shieldActions';
// Localized shield string templates for native writers (WidgetDataManager.swift),
// which rewrite the shield config from widget intents while JS isn't running
const SHIELD_STRINGS_KEY = 'shieldStrings';
const APP_GROUP_ID =
  Constants.expoConfig?.extra?.appGroupId ?? 'group.com.path2us.bittersweet.appblocker';
const MAIN_APP_BUNDLE_ID = Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.path2us.bittersweet';

// MARK: - Custom Data Types (for events only, not shield config)

// UserDefaults communication keys for shield extension communication
const PENDING_MAIN_APP_ACTION_KEY = 'pendingMainAppAction';

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
   * @param focusSessionActive - Whether a focus session is currently running
   */
  async configureShield(
    fruitBalance: number,
    focusSessionActive: boolean = false
  ): Promise<boolean> {
    try {
      // Configure shield appearance (using official library interface)
      const shieldConfig: ShieldConfiguration = focusSessionActive
        ? {
            title: i18n.t('shield.title'),
            subtitle: i18n.t('shield.focusSubtitle'),
            primaryButtonLabel: i18n.t('shield.closeButton'),
            iconSystemName: 'hand.raised.fill',
            backgroundBlurStyle: 18, // UIBlurEffect.Style.systemMaterialDark - force dark material in light mode
            backgroundColor: { red: 178, green: 25, blue: 25, alpha: 1.0 }, // Dark red
            titleColor: { red: 255, green: 255, blue: 255, alpha: 1.0 }, // White
            subtitleColor: { red: 230, green: 230, blue: 230, alpha: 1.0 }, // Light gray
            primaryButtonLabelColor: { red: 255, green: 255, blue: 255, alpha: 1.0 }, // White
            primaryButtonBackgroundColor: { red: 178, green: 25, blue: 25, alpha: 1.0 }, // Red (not green)
          }
        : {
            title: i18n.t('shield.title'),
            subtitle: i18n.t('shield.balanceSubtitle', { balance: fruitBalance }),
            primaryButtonLabel: i18n.t('shield.unlockButton'),
            secondaryButtonLabel: i18n.t('shield.closeButton'),
            iconSystemName: 'hand.raised.fill',
            backgroundBlurStyle: 18, // UIBlurEffect.Style.systemMaterialDark - force dark material in light mode
            backgroundColor: { red: 178, green: 25, blue: 25, alpha: 1.0 }, // Dark red
            titleColor: { red: 255, green: 255, blue: 255, alpha: 1.0 }, // White
            subtitleColor: { red: 230, green: 230, blue: 230, alpha: 1.0 }, // Light gray
            primaryButtonLabelColor: { red: 255, green: 255, blue: 255, alpha: 1.0 }, // White
            primaryButtonBackgroundColor: { red: 51, green: 153, blue: 51, alpha: 1.0 }, // Green
            secondaryButtonLabelColor: { red: 100, green: 100, blue: 100, alpha: 1.0 }, // Dark gray (readable on light secondary button bg)
          };

      // Configure shield actions - during focus session, just close; otherwise open app for unlock
      const shieldActions: ShieldActions = focusSessionActive
        ? {
            primary: {
              behavior: 'close',
            },
            secondary: {
              behavior: 'close',
            },
          }
        : {
            primary: {
              behavior: 'defer',
              actions: [
                {
                  type: 'openAppWithBundleId',
                  bundleId: MAIN_APP_BUNDLE_ID,
                },
              ],
            },
            secondary: {
              behavior: 'close',
            },
          };

      // Store configuration in UserDefaults for the shield extensions
      ReactNativeDeviceActivity.userDefaultsSet(SHIELD_CONFIGURATION_KEY, shieldConfig);
      ReactNativeDeviceActivity.userDefaultsSet(SHIELD_ACTIONS_KEY, shieldActions);

      // Sync localized templates so native shield writers (widget start/stop
      // intents) produce text in the user's language. `{balance}` is a literal
      // token substituted by WidgetDataManager.swift at write time.
      ReactNativeDeviceActivity.userDefaultsSet(SHIELD_STRINGS_KEY, {
        title: i18n.t('shield.title'),
        focusSubtitle: i18n.t('shield.focusSubtitle'),
        balanceSubtitle: i18n.t('shield.balanceSubtitle', { balance: '{balance}' }),
        unlockButton: i18n.t('shield.unlockButton'),
        closeButton: i18n.t('shield.closeButton'),
      });

      // Sync balance to app group so native widget/intent code can write
      // accurate shield config when stopping a session without JS running
      WidgetService.syncFruitBalance(fruitBalance);

      return true;
    } catch (error) {
      console.error('Failed to configure shield:', error);
      return false;
    }
  }

  /**
   * Update shield configuration when fruit balance changes.
   * Automatically checks AsyncStorage for active focus session if focusSessionActive is not provided.
   * @param fruitBalance - New fruit balance
   * @param focusSessionActive - Whether a focus session is currently running (auto-detected if omitted)
   */
  async updateShieldBalance(fruitBalance: number, focusSessionActive?: boolean): Promise<boolean> {
    try {
      // Auto-detect focus session state if not explicitly provided
      let isFocusActive = focusSessionActive;
      if (isFocusActive === undefined) {
        const activeSession = await AsyncStorage.getItem('active-focus-session');
        isFocusActive = !!activeSession;
      }
      return await this.configureShield(fruitBalance, isFocusActive);
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
      ReactNativeDeviceActivity.userDefaultsRemove(SHIELD_STRINGS_KEY);

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

      if (currentStatus === 2) {
        // 2 = approved
        console.log('✅ Already authorized');
        return true;
      }

      await ReactNativeDeviceActivity.requestAuthorization();
      const status = await this.getAuthorizationStatus();
      console.log('✅ Authorization result:', status);
      return status === 2; // 2 = approved
    } catch (error) {
      console.error('❌ Authorization failed:', error);
      console.error(
        '💡 Hint: Another app might have Family Controls authorization. Only one app can have it at a time.'
      );
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
      const status = ReactNativeDeviceActivity.getAuthorizationStatus();
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
    console.warn(
      'presentFamilyActivityPicker is deprecated. Use DeviceActivitySelectionView component instead'
    );
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
   * Remove all current app restrictions by clearing the library's internal blocklist.
   *
   * Uses `{ currentBlocklist: true }` so the native side diffs against the ACTUAL
   * internal blocklist rather than a named selection ID whose blob may have been
   * overwritten by the picker before Save was pressed.
   *
   * @returns Promise<boolean> - True if restrictions removed successfully
   */
  async removeRestrictions(): Promise<boolean> {
    try {
      console.log('🔓 removeRestrictions — clearing entire internal blocklist');

      ReactNativeDeviceActivity.unblockSelection({
        currentBlocklist: true,
      });

      console.log('✅ All app restrictions removed');
      return true;
    } catch (error) {
      console.error('❌ Failed to remove restrictions:', error);
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
        repeats: true,
      };

      // Create events for monitoring with the selection ID
      const events: DeviceActivityEvent[] = [
        {
          eventName: 'appBlocking',
          familyActivitySelection: selection, // This should be the selection ID
          threshold: { minute: 1 }, // Example threshold
        },
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
      ReactNativeDeviceActivity.stopMonitoring();

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
  addAppLaunchBlockedListener(listener: (event: BitterSweetAppLaunchBlockedEvent) => void): {
    remove: () => void;
  } {
    try {
      // Use react-native-device-activity's event listener
      const subscription = ReactNativeDeviceActivity.onDeviceActivityMonitorEvent((event: any) => {
        // Transform the event to match our AppLaunchBlockedEvent interface
        const transformedEvent: BitterSweetAppLaunchBlockedEvent = {
          appName: event.appName || 'Unknown App',
          bundleIdentifier: event.bundleIdentifier || '',
          appTokens: event.appTokens || [],
          timestamp: Date.now(),
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
   * Check if app was opened from shield using multiple detection methods
   * @returns Promise<boolean> - True if opened from shield
   */
  async checkIfOpenedFromShield(): Promise<boolean> {
    try {
      console.log('🛡️ [SHIELD_DEBUG] === Starting shield detection ===');
      console.log('🛡️ [SHIELD_DEBUG] App Group ID configured:', APP_GROUP_ID);

      // Method 1: Check for unlock request via UserDefaults
      console.log('🛡️ [SHIELD_DEBUG] Checking UserDefaults for unlock request...');
      const hasUnlockRequest = await this.checkUnlockRequest();
      if (hasUnlockRequest) {
        console.log('✅ [SHIELD_DEBUG] Shield detection: Found unlock request from shield');
        return true;
      }

      // UserDefaults is now the only method for shield communication

      console.log(
        'ℹ️ [SHIELD_DEBUG] Shield detection: No indicators found - likely normal app launch'
      );
      return false;
    } catch (error) {
      console.error('❌ [SHIELD_DEBUG] Failed to check shield opening:', error);
      return false;
    }
  }

  /**
   * Check if shield extension set a pending action via UserDefaults
   * @returns Promise<boolean> - True if unlock action was requested
   */
  async checkUnlockRequest(): Promise<boolean> {
    try {
      console.log(
        '📡 [USERDEFAULTS_DEBUG] Attempting to read UserDefaults key:',
        PENDING_MAIN_APP_ACTION_KEY
      );

      // Try to read the UserDefaults value
      const pendingAction = ReactNativeDeviceActivity.userDefaultsGet(
        PENDING_MAIN_APP_ACTION_KEY
      ) as any;

      console.log('📡 [USERDEFAULTS_DEBUG] Raw UserDefaults value:', pendingAction);
      console.log('📡 [USERDEFAULTS_DEBUG] Value type:', typeof pendingAction);
      console.log('📡 [USERDEFAULTS_DEBUG] Value is null:', pendingAction === null);
      console.log('📡 [USERDEFAULTS_DEBUG] Value is undefined:', pendingAction === undefined);

      if (pendingAction && typeof pendingAction === 'object') {
        console.log(
          '📡 [USERDEFAULTS_DEBUG] ✅ Found pending action from shield extension:',
          JSON.stringify(pendingAction, null, 2)
        );
        console.log('📡 [USERDEFAULTS_DEBUG] Action type:', pendingAction.action);
        console.log('📡 [USERDEFAULTS_DEBUG] Bundle ID:', pendingAction.bundleId);
        console.log('📡 [USERDEFAULTS_DEBUG] Shield ID:', pendingAction.shieldId);
        console.log(
          '📡 [USERDEFAULTS_DEBUG] Timestamp:',
          pendingAction.timestamp ? new Date(pendingAction.timestamp * 1000) : 'none'
        );
        console.log('📡 [USERDEFAULTS_DEBUG] Source:', pendingAction.source);

        // Clear the pending action
        console.log('📡 [USERDEFAULTS_DEBUG] Clearing UserDefaults key...');
        ReactNativeDeviceActivity.userDefaultsRemove(PENDING_MAIN_APP_ACTION_KEY);

        // Check if this is the primary button action (unlock request)
        const isUnlockAction =
          pendingAction.action === 'primaryButtonTapped' &&
          pendingAction.source === 'shieldExtension';

        console.log('📡 [USERDEFAULTS_DEBUG] Is unlock action check:');
        console.log(
          '📡 [USERDEFAULTS_DEBUG] - pendingAction.action === "primaryButtonTapped":',
          pendingAction.action === 'primaryButtonTapped'
        );
        console.log(
          '📡 [USERDEFAULTS_DEBUG] - pendingAction.source === "shieldExtension":',
          pendingAction.source === 'shieldExtension'
        );
        console.log('📡 [USERDEFAULTS_DEBUG] - Final isUnlockAction:', isUnlockAction);

        if (isUnlockAction) {
          console.log(
            '✅ [USERDEFAULTS_DEBUG] Confirmed unlock action from shield (primaryButtonTapped)'
          );
          return true;
        } else {
          console.log(
            'ℹ️ [USERDEFAULTS_DEBUG] Action found but not primary button unlock action:',
            pendingAction.action
          );
        }
      } else {
        console.log('📡 [USERDEFAULTS_DEBUG] ❌ No pending action found or invalid format');
      }

      return false;
    } catch (error) {
      console.error('❌ [USERDEFAULTS_DEBUG] Failed to check unlock request:', error);
      return false;
    }
  }

  // MARK: - Debug Methods

  /**
   * Debug method to inspect UserDefaults (for testing)
   */
  async debugUserDefaults(): Promise<void> {
    try {
      console.log('🔍 [DEBUG] === UserDefaults Debug ===');
      console.log('🔍 [DEBUG] App Group ID:', APP_GROUP_ID);

      // Try to read the main communication key
      const pendingAction = ReactNativeDeviceActivity.userDefaultsGet(PENDING_MAIN_APP_ACTION_KEY);
      console.log('🔍 [DEBUG] pendingMainAppAction:', pendingAction);
      console.log('🔍 [DEBUG] pendingMainAppAction type:', typeof pendingAction);
      console.log('🔍 [DEBUG] pendingMainAppAction JSON:', JSON.stringify(pendingAction));

      // Try to read other keys that might exist
      const shieldConfig = ReactNativeDeviceActivity.userDefaultsGet(SHIELD_CONFIGURATION_KEY);
      console.log('🔍 [DEBUG] shieldConfiguration exists:', !!shieldConfig);

      const shieldActions = ReactNativeDeviceActivity.userDefaultsGet(SHIELD_ACTIONS_KEY);
      console.log('🔍 [DEBUG] shieldActions exists:', !!shieldActions);

      // Try to read with different possible key variations
      const alternativeKeys = [
        'pendingMainAppAction',
        'PendingMainAppAction',
        'pending_main_app_action',
        'shieldCommunication',
        'shieldAction',
      ];

      for (const key of alternativeKeys) {
        const value = ReactNativeDeviceActivity.userDefaultsGet(key);
        if (value !== null && value !== undefined) {
          console.log(`🔍 [DEBUG] Found data with key '${key}':`, value);
        }
      }

      console.log('🔍 [DEBUG] === End UserDefaults Debug ===');
    } catch (error) {
      console.error('🔍 [DEBUG] Error inspecting UserDefaults:', error);
    }
  }

  /**
   * Force check UserDefaults right now (for manual testing)
   */
  async forceCheckUserDefaults(): Promise<void> {
    console.log('🔍 [FORCE_CHECK] === Forcing UserDefaults Check ===');
    await this.debugUserDefaults();
    const hasUnlock = await this.checkUnlockRequest();
    console.log('🔍 [FORCE_CHECK] checkUnlockRequest result:', hasUnlock);
    console.log('🔍 [FORCE_CHECK] === End Force Check ===');
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
  BitterSweetAuthorizationChangedEvent,
};
