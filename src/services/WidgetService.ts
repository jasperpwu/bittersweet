import * as ReactNativeDeviceActivity from 'react-native-device-activity';
import { reloadWidgetTimelines } from 'expo-live-activity';

// UserDefaults keys (must match WidgetKeys in WidgetDataManager.swift)
const SESSION_DATA_KEY = 'widgetSessionData';
const TAG_LIST_KEY = 'widgetTagList';
const PENDING_ACTION_KEY = 'pendingWidgetAction';
const WIDGET_STARTED_SESSION_KEY = 'widgetStartedSession';
const WIDGET_STOP_ACTION_KEY = 'widgetStopAction';
const SELECTED_TAG_ID_KEY = 'widgetSelectedTagId';
const FRUIT_BALANCE_KEY = 'widgetFruitBalance';
const WIDGET_UNLOCK_STOP_ACTION_KEY = 'widgetUnlockStopAction';
const CURRENT_SELECTION_ID_KEY = 'widgetCurrentSelectionId';
const UNLOCK_SESSION_DATA_KEY = 'widgetUnlockSessionData';
const SCHEDULED_NOTIFICATION_ID_KEY = 'widgetScheduledNotificationId';
const SUPABASE_USER_ID_KEY = 'supabaseUserId';
const SUPABASE_ACCESS_TOKEN_KEY = 'supabaseAccessToken';
const GROVE_SHARED_TAG_IDS_KEY = 'groveSharedTagIds';
const GROVE_SHARE_NOTES_KEY = 'groveShareNotes';
const GROVE_SHOW_LIVE_STATUS_KEY = 'groveShowLiveStatus';
const GOALS_DATA_KEY = 'widgetGoalsData';
const GROVE_ACTIVE_CHALLENGES_KEY = 'groveActiveChallenges';

export interface WidgetSessionData {
  isActive: boolean;
  tagId: string; // lets native StopSessionIntent match the finished session to its goal
  tagName: string;
  tagIcon: string;
  tagColor: string;
  startTime: number;  // Unix timestamp ms
  endTime: number;    // Unix timestamp ms, 0 if infinite
  isInfinite: boolean;
  todayTotalMinutes?: number;
}

export interface WidgetTagInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  lastDuration?: number; // minutes; undefined = unknown, 0 = infinite
  lastUsedAt?: number;   // Unix timestamp ms of most recent session; 0 = never used
}

export interface WidgetStartedSession {
  tagId: string;
  tagName: string;
  tagIcon: string;
  tagColor: string;
  duration: number;   // minutes; 0 = infinite
  startTime: number;  // Unix timestamp ms
  endTime: number;    // Unix timestamp ms, 0 if infinite
  isInfinite: boolean;
  liveActivityId?: string; // set when LiveActivityIntent starts the activity in the app process
}

export interface WidgetStopAction {
  action: 'stop';
  timestamp: number;
  sessionId?: string; // id the native Supabase write used; JS reuses it so the two collapse to one row
}

export interface WidgetUnlockStopAction {
  action: 'stopUnlock';
  timestamp: number;
}

export interface WidgetUnlockSessionData {
  isActive: boolean;
  endTime: number; // Unix timestamp ms
}

export interface WidgetGoalData {
  name: string;
  currentMinutes: number;
  targetMinutes: number;
  percentage: number;
  period: string; // "Daily" / "Weekly" / "Monthly"
  tagId: string; // 1:1 with tag — lets native StopSessionIntent match a finished session to a goal
  tagIcon: string;
  tagColor: string;
}

export interface PendingWidgetAction {
  action: 'start' | 'stop';
  tagId?: string;
  duration?: number; // minutes; undefined = unknown, 0 = infinite
  timestamp: number;
}

/**
 * Service for communicating with the Home Screen Widget via shared UserDefaults.
 * Mirrors the LiveActivityService pattern — all static methods, no instantiation.
 */
export class WidgetService {
  /**
   * Sync current session state to the widget.
   * Call when a session starts, stops, or is recovered.
   * Pass null to indicate no active session.
   */
  static syncSessionState(data: WidgetSessionData | null): void {
    try {
      if (data) {
        ReactNativeDeviceActivity.userDefaultsSet(SESSION_DATA_KEY, data);
      } else {
        // Write an idle state rather than removing, so the widget always has data
        ReactNativeDeviceActivity.userDefaultsSet(SESSION_DATA_KEY, {
          isActive: false,
          tagId: '',
          tagName: '',
          tagIcon: '',
          tagColor: '',
          startTime: 0,
          endTime: 0,
          isInfinite: false,
        });
      }
      // Force widget to refresh immediately instead of waiting up to 15 min
      reloadWidgetTimelines();
    } catch (error) {
      console.error('📱 [Widget] Failed to sync session state:', error);
    }
  }

  /**
   * Sync available tags to the widget for configuration.
   * Call on app mount and whenever tags change.
   */
  static syncTagList(tags: WidgetTagInfo[]): void {
    try {
      ReactNativeDeviceActivity.userDefaultsSet(TAG_LIST_KEY, tags);
      reloadWidgetTimelines();
    } catch (error) {
      console.error('📱 [Widget] Failed to sync tag list:', error);
    }
  }

  /**
   * Sync the currently selected tag ID from the Focus tab.
   * The small widget reads this to show the active tag automatically.
   */
  static syncSelectedTagId(tagId: string | null): void {
    try {
      if (tagId) {
        ReactNativeDeviceActivity.userDefaultsSet(SELECTED_TAG_ID_KEY, tagId);
      } else {
        ReactNativeDeviceActivity.userDefaultsRemove(SELECTED_TAG_ID_KEY);
      }
      // Force widget to refresh immediately so the small widget shows the new tag
      reloadWidgetTimelines();
    } catch (error) {
      console.error('📱 [Widget] Failed to sync selected tag ID:', error);
    }
  }

  /**
   * Sync the current fruit balance to UserDefaults so the native widget/intent
   * code can write accurate shield configuration without waiting for JS.
   * Call whenever the balance changes (e.g. after earning or spending fruits).
   */
  static syncFruitBalance(balance: number): void {
    try {
      ReactNativeDeviceActivity.userDefaultsSet(FRUIT_BALANCE_KEY, balance);
    } catch (error) {
      console.error('📱 [Widget] Failed to sync fruit balance:', error);
    }
  }

  /**
   * Sync unlock session state to the widget.
   * Call when an unlock starts, stops, or expires.
   * Pass null to clear the unlock state (idle).
   */
  static syncUnlockSessionState(data: WidgetUnlockSessionData | null): void {
    try {
      if (data) {
        ReactNativeDeviceActivity.userDefaultsSet(UNLOCK_SESSION_DATA_KEY, data);
      } else {
        ReactNativeDeviceActivity.userDefaultsRemove(UNLOCK_SESSION_DATA_KEY);
      }
      reloadWidgetTimelines();
    } catch (error) {
      console.error('📱 [Widget] Failed to sync unlock session state:', error);
    }
  }

  /**
   * Check for a pending action written by the widget via UserDefaults.
   */
  static checkPendingAction(): PendingWidgetAction | null {
    try {
      const raw = ReactNativeDeviceActivity.userDefaultsGet(PENDING_ACTION_KEY);
      if (!raw || typeof raw !== 'object') return null;

      const action = raw as PendingWidgetAction;
      if (!action.action || !action.timestamp) return null;

      ReactNativeDeviceActivity.userDefaultsRemove(PENDING_ACTION_KEY);
      return action;
    } catch (error) {
      console.error('📱 [Widget] Failed to check pending action:', error);
      return null;
    }
  }

  /**
   * Check if the widget started a session (written by StartSessionIntent).
   * Reads and clears the widgetStartedSession UserDefaults key.
   */
  static checkWidgetStartedSession(): WidgetStartedSession | null {
    try {
      const raw = ReactNativeDeviceActivity.userDefaultsGet(WIDGET_STARTED_SESSION_KEY);
      if (!raw || typeof raw !== 'object') return null;

      const session = raw as WidgetStartedSession;
      if (!session.tagId || !session.startTime) return null;

      ReactNativeDeviceActivity.userDefaultsRemove(WIDGET_STARTED_SESSION_KEY);
      return session;
    } catch (error) {
      console.error('📱 [Widget] Failed to check widget started session:', error);
      return null;
    }
  }

  /**
   * Read the widget-started session WITHOUT clearing it.
   * Use clearWidgetStartedSession() after successful adoption.
   */
  static readWidgetStartedSession(): WidgetStartedSession | null {
    try {
      const raw = ReactNativeDeviceActivity.userDefaultsGet(WIDGET_STARTED_SESSION_KEY);
      if (!raw || typeof raw !== 'object') return null;

      const session = raw as WidgetStartedSession;
      if (!session.tagId || !session.startTime) return null;

      return session;
    } catch (error) {
      console.error('📱 [Widget] Failed to read widget started session:', error);
      return null;
    }
  }

  /**
   * Clear the widget-started session key. Call after successful adoption.
   */
  static clearWidgetStartedSession(): void {
    try {
      ReactNativeDeviceActivity.userDefaultsRemove(WIDGET_STARTED_SESSION_KEY);
    } catch (error) {
      console.error('📱 [Widget] Failed to clear widget started session:', error);
    }
  }

  /**
   * Sync the scheduled completion notification ID to shared UserDefaults so
   * the native StopSessionIntent can cancel it immediately without waiting
   * for JS to foreground.
   */
  static syncScheduledNotificationId(id: string | null): void {
    try {
      if (id) {
        ReactNativeDeviceActivity.userDefaultsSet(SCHEDULED_NOTIFICATION_ID_KEY, id);
      } else {
        ReactNativeDeviceActivity.userDefaultsRemove(SCHEDULED_NOTIFICATION_ID_KEY);
      }
    } catch (error) {
      console.error('📱 [Widget] Failed to sync scheduled notification ID:', error);
    }
  }

  /**
   * Sync the current blocklist selection ID to UserDefaults so the native
   * StopUnlockIntent can re-block apps without waiting for JS.
   * Call whenever currentSelectionId changes in the store.
   */
  static syncCurrentSelectionId(selectionId: string | null): void {
    try {
      if (selectionId) {
        ReactNativeDeviceActivity.userDefaultsSet(CURRENT_SELECTION_ID_KEY, selectionId);
      } else {
        ReactNativeDeviceActivity.userDefaultsRemove(CURRENT_SELECTION_ID_KEY);
      }
    } catch (error) {
      console.error('📱 [Widget] Failed to sync current selection ID:', error);
    }
  }

  /**
   * Check if the widget stopped an unlock session (written by StopUnlockIntent).
   * Reads and clears the widgetUnlockStopAction UserDefaults key.
   */
  static checkWidgetUnlockStopAction(): WidgetUnlockStopAction | null {
    try {
      const raw = ReactNativeDeviceActivity.userDefaultsGet(WIDGET_UNLOCK_STOP_ACTION_KEY);
      if (!raw || typeof raw !== 'object') return null;

      const action = raw as WidgetUnlockStopAction;
      if (!action.timestamp) return null;

      ReactNativeDeviceActivity.userDefaultsRemove(WIDGET_UNLOCK_STOP_ACTION_KEY);
      return action;
    } catch (error) {
      console.error('📱 [Widget] Failed to check widget unlock stop action:', error);
      return null;
    }
  }

  // ========== Supabase Credentials + Privacy Sync ==========

  /**
   * Sync Supabase credentials to shared UserDefaults so native intents
   * can make direct REST calls without waiting for JS to foreground.
   * Call on SIGNED_IN, INITIAL_SESSION, and TOKEN_REFRESHED.
   */
  static syncSupabaseCredentials(userId: string, accessToken: string): void {
    try {
      ReactNativeDeviceActivity.userDefaultsSet(SUPABASE_USER_ID_KEY, userId);
      ReactNativeDeviceActivity.userDefaultsSet(SUPABASE_ACCESS_TOKEN_KEY, accessToken);
    } catch (error) {
      console.error('📱 [Widget] Failed to sync Supabase credentials:', error);
    }
  }

  /**
   * Clear Supabase credentials from shared UserDefaults on sign-out.
   */
  static clearSupabaseCredentials(): void {
    try {
      ReactNativeDeviceActivity.userDefaultsRemove(SUPABASE_USER_ID_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(SUPABASE_ACCESS_TOKEN_KEY);
    } catch (error) {
      console.error('📱 [Widget] Failed to clear Supabase credentials:', error);
    }
  }

  /**
   * Sync Grove privacy settings to shared UserDefaults so native intents
   * can respect privacy when sharing sessions and setting focus status.
   */
  static syncGrovePrivacy(settings: {
    sharedTagIds: string[];
    shareNotes: boolean;
    showLiveStatus: boolean;
  }): void {
    try {
      ReactNativeDeviceActivity.userDefaultsSet(
        GROVE_SHARED_TAG_IDS_KEY,
        JSON.stringify(settings.sharedTagIds)
      );
      ReactNativeDeviceActivity.userDefaultsSet(GROVE_SHARE_NOTES_KEY, settings.shareNotes);
      ReactNativeDeviceActivity.userDefaultsSet(GROVE_SHOW_LIVE_STATUS_KEY, settings.showLiveStatus);
    } catch (error) {
      console.error('📱 [Widget] Failed to sync grove privacy:', error);
    }
  }

  /**
   * Sync active challenges to shared UserDefaults so native intents
   * can record challenge progress on session stop.
   */
  static syncActiveChallenges(challenges: { id: string; tagId: string }[]): void {
    try {
      ReactNativeDeviceActivity.userDefaultsSet(
        GROVE_ACTIVE_CHALLENGES_KEY,
        JSON.stringify(challenges)
      );
    } catch (error) {
      console.error('📱 [Widget] Failed to sync active challenges:', error);
    }
  }

  /**
   * Sync pre-computed goal progress data to the widget.
   * The caller (layout) calculates progress before calling this.
   */
  static syncGoalsData(goals: WidgetGoalData[]): void {
    try {
      ReactNativeDeviceActivity.userDefaultsSet(GOALS_DATA_KEY, goals);
      reloadWidgetTimelines();
    } catch (error) {
      console.error('📱 [Widget] Failed to sync goals data:', error);
    }
  }

  /**
   * Check if the widget stopped a session (written by StopSessionIntent).
   * Reads and clears the widgetStopAction UserDefaults key.
   */
  static checkWidgetStopAction(): WidgetStopAction | null {
    try {
      const raw = ReactNativeDeviceActivity.userDefaultsGet(WIDGET_STOP_ACTION_KEY);
      if (!raw || typeof raw !== 'object') return null;

      const action = raw as WidgetStopAction;
      if (!action.timestamp) return null;

      ReactNativeDeviceActivity.userDefaultsRemove(WIDGET_STOP_ACTION_KEY);
      return action;
    } catch (error) {
      console.error('📱 [Widget] Failed to check widget stop action:', error);
      return null;
    }
  }

  /**
   * Clear all widget configuration and credentials from UserDefaults.
   * Call on user sign-out or sign-in (before importing new data).
   */
  static clearAllWidgetData(): void {
    try {
      ReactNativeDeviceActivity.userDefaultsRemove(SESSION_DATA_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(TAG_LIST_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(SELECTED_TAG_ID_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(FRUIT_BALANCE_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(UNLOCK_SESSION_DATA_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(CURRENT_SELECTION_ID_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(SUPABASE_USER_ID_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(SUPABASE_ACCESS_TOKEN_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(GROVE_SHARED_TAG_IDS_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(GROVE_SHARE_NOTES_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(GROVE_SHOW_LIVE_STATUS_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(GOALS_DATA_KEY);
      ReactNativeDeviceActivity.userDefaultsRemove(GROVE_ACTIVE_CHALLENGES_KEY);
      reloadWidgetTimelines();
    } catch (error) {
      console.error('📱 [Widget] Failed to clear all widget data:', error);
    }
  }
}

