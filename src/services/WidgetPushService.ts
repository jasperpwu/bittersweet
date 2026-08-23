import * as Application from 'expo-application';
import { Platform } from 'react-native';
import * as ReactNativeDeviceActivity from 'react-native-device-activity';
import { supabase } from '../config/supabase';

/**
 * Files this device's WidgetKit push token in Supabase, so the
 * `session-remote-control` edge function can wake the widget extension when a
 * session starts or stops on the desktop (Phase 4).
 *
 * The token itself is captured natively — `FocusWidgetPushHandler` in
 * `targets/HomeWidget/RemoteSessionSync.swift` is the only place iOS hands it
 * over, and it stashes it in the app group. Apple is explicit that this is not a
 * User Notifications token: "you can't use the User Notifications framework to
 * register your widget for push notifications. Instead, you use WidgetKit to
 * obtain a push token." So it exists whether or not the user has ever allowed
 * notifications, which is the entire reason this mechanism was chosen.
 *
 * The extension uploads it too, for the phone whose app is never reopened. This
 * side exists because the extension's copy is a fire-and-forget request from a
 * process the system may suspend mid-flight, and because only the app knows who
 * is signed in — a token filed under the previous account has to be re-filed.
 *
 * Sign-out clearing is already covered: `LiveActivityPushService.clear()` deletes
 * every `device_push_tokens` row for the user, widget rows included.
 *
 * Requires `supabase/migrations/20260820_device_push_tokens.sql`.
 */

/** Written by FocusWidgetPushHandler; see WidgetKeys.widgetPushToken. */
const WIDGET_PUSH_TOKEN_KEY = 'widgetPushToken';

function readTokenFromAppGroup(): string | null {
  try {
    const value = ReactNativeDeviceActivity.userDefaultsGet(WIDGET_PUSH_TOKEN_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch (error) {
    console.warn('[WidgetPush] failed to read token from app group:', error);
    return null;
  }
}

export const WidgetPushService = {
  /**
   * Upsert the stored token under whoever is signed in now, and drop any older
   * widget token for them.
   *
   * Idempotent and cheap — at most one upsert and one delete — so it is safe to
   * call on mount, on foreground and on every sign-in. A no-op when iOS has
   * never issued a token, which is the normal state on iOS 25 and below, and on
   * iOS 26 for a user with no Bittersweet widget on their Home Screen: WidgetKit
   * only issues a token for widgets that are actually installed.
   */
  async syncToCurrentUser(): Promise<void> {
    if (Platform.OS !== 'ios') return;

    const token = readTokenFromAppGroup();
    if (!token) return;

    const bundleId = Application.applicationId;
    if (!bundleId) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const { error } = await supabase.from('device_push_tokens').upsert(
        {
          user_id: userId,
          kind: 'widget',
          token,
          // Widget tokens belong to the install, not to any one activity, so
          // unlike 'liveactivity' rows there is nothing to scope them to.
          activity_id: null,
          bundle_id: bundleId,
          // Only read for 'pushtostart', where the server has to pick a Live
          // Activity's colors without the device present.
          color_scheme: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,kind,token' }
      );

      if (error) {
        console.warn('[WidgetPush] failed to store widget token:', error.message);
        return;
      }

      // Keep exactly one widget row per user. Apple asks that the previous token
      // be invalidated as soon as a new one arrives, and a stale row here would
      // have the server pushing at a token APNs answers 410 for while the live
      // one goes untouched.
      const { error: pruneError } = await supabase
        .from('device_push_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('kind', 'widget')
        .neq('token', token);

      if (pruneError) {
        console.warn('[WidgetPush] failed to prune old widget tokens:', pruneError.message);
      }
    } catch (e) {
      console.warn('[WidgetPush] syncToCurrentUser threw:', e);
    }
  },
};
