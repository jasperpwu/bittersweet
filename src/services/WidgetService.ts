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

export interface WidgetSessionData {
  isActive: boolean;
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
  usageCount?: number;
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
          tagName: '',
          tagIcon: '',
          tagColor: '',
          startTime: 0,
          endTime: 0,
          isInfinite: false,
        });
      }
      console.log('📱 [Widget] Synced session state:', data ? 'active' : 'idle');
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
      console.log('📱 [Widget] Synced tag list:', tags.length, 'tags');
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
      console.log('📱 [Widget] Synced selected tag ID:', tagId ?? 'none');
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
   * Check for a pending action written by the widget via UserDefaults.
   */
  static checkPendingAction(): PendingWidgetAction | null {
    try {
      const raw = ReactNativeDeviceActivity.userDefaultsGet(PENDING_ACTION_KEY);
      if (!raw || typeof raw !== 'object') return null;

      const action = raw as PendingWidgetAction;
      if (!action.action || !action.timestamp) return null;

      ReactNativeDeviceActivity.userDefaultsRemove(PENDING_ACTION_KEY);
      console.log('📱 [Widget] Found pending action:', action.action);
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
      console.log('📱 [Widget] Found widget-started session:', session.tagId);
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
      console.log('📱 [Widget] Found widget stop action');
      return action;
    } catch (error) {
      console.error('📱 [Widget] Failed to check widget stop action:', error);
      return null;
    }
  }
}
