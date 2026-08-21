import * as Application from 'expo-application';
import * as LiveActivity from 'expo-live-activity';
import { Appearance, Platform } from 'react-native';
import type { EventSubscription } from 'expo-modules-core';
import { supabase } from '../config/supabase';

/**
 * Ships ActivityKit push tokens to Supabase so the `session-remote-control`
 * edge function can drive this phone's Live Activity from the desktop client.
 *
 * Two different tokens, for two different jobs:
 *
 *  - **push-to-start** (`Activity.pushToStartTokenUpdates`, iOS 17.2+) exists
 *    whether or not an activity is running and is the only way to make a Live
 *    Activity appear on a phone whose app has been swiped away. One per install.
 *  - **update** (`activity.pushTokenUpdates`) is scoped to a single activity and
 *    is the only way to update or end that activity. It dies with it.
 *
 * Neither has anything to do with `PushNotificationService` / expo-notifications:
 * these come from ActivityKit, are not gated on notification permission, and are
 * addressed to `<bundle id>.push-type.liveactivity` rather than the app's own
 * topic. That is also why they cannot go through Expo Push Service and need the
 * direct-APNs path in `supabase/functions/_shared/apns.ts`.
 *
 * Requires `supabase/migrations/20260820_device_push_tokens.sql`.
 */

type TokenKind = 'liveactivity' | 'pushtostart';

let subscriptions: EventSubscription[] = [];
let started = false;

/**
 * The tokens this device has been handed, kept so they can be re-filed under a
 * different account.
 *
 * ActivityKit emits a token when it has one — at launch, and whenever an
 * activity starts — not when we happen to want it. Both of the moments that
 * matter arrive *after* that: a cold start restores the session only once the
 * store has hydrated (app/_layout.tsx gates the auth listener on it), and a
 * sign-in can happen hours into a session. Without this cache, a user who signs
 * in on an already-running app has no token row until they relaunch, and the
 * desktop silently can't reach their phone.
 */
const lastSeen: { liveactivity?: { token: string; activityId: string }; pushtostart?: string } = {};

/**
 * The bundle ID this build actually runs under.
 *
 * Stored with every token because the APNs topic must match the app that owns
 * it, and this project ships two IDs — `com.path2us.bittersweet` and the `.dev`
 * variant (app.config.js:10). Read from the runtime rather than from
 * expo-constants so a config change can't disagree with the installed binary.
 */
function bundleId(): string | null {
  return Application.applicationId ?? null;
}

async function currentUserId(): Promise<string | null> {
  // getSession reads the cached session rather than hitting the network, which
  // matters here: token events can arrive during a background launch, where a
  // round trip may not finish before the process is suspended again.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

async function storeToken(kind: TokenKind, token: string, activityId?: string): Promise<void> {
  if (kind === 'pushtostart') lastSeen.pushtostart = token;
  else lastSeen.liveactivity = { token, activityId: activityId ?? '' };

  const userId = await currentUserId();
  const bundle = bundleId();
  if (!userId || !bundle) return;

  const { error } = await supabase.from('device_push_tokens').upsert(
    {
      user_id: userId,
      kind,
      token,
      activity_id: activityId ?? null,
      bundle_id: bundle,
      // Only consulted for push-to-start, where the server has to choose the
      // Live Activity's colors without the device present. Sent for both kinds
      // so a token row is never the stale one.
      color_scheme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,kind,token' }
  );

  if (error) {
    console.warn(`[LiveActivityPush] failed to store ${kind} token:`, error.message);
    return;
  }

  // Keep exactly one row per kind. Apple tells us to invalidate the previous
  // token as soon as a new one arrives ("invalidate the previous, now-outdated
  // token on your server"), and for update tokens it is stronger than that: a
  // stale row would have the server pushing at an activity that no longer
  // exists while the live one goes untouched.
  const { error: pruneError } = await supabase
    .from('device_push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('kind', kind)
    .neq('token', token);

  if (pruneError) {
    console.warn(`[LiveActivityPush] failed to prune old ${kind} tokens:`, pruneError.message);
  }
}

async function dropActivityToken(activityId: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('device_push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('kind', 'liveactivity')
    .eq('activity_id', activityId);

  if (error) {
    console.warn('[LiveActivityPush] failed to drop ended activity token:', error.message);
  }
}

export const LiveActivityPushService = {
  /**
   * Begin forwarding tokens. Idempotent, and safe to call before sign-in —
   * events that arrive without a session are dropped, and the next token
   * (ActivityKit re-issues one per activity) re-registers.
   *
   * Call this as early as possible. A push-to-start push wakes the app in the
   * background specifically so it can hand over the new activity's update token
   * ("the system wakes your app and you'll receive new push tokens to use for
   * updates"), and that event is delivered once — if no JS listener is attached
   * yet, it is gone, and the session cannot be ended remotely.
   */
  start(): void {
    if (started || Platform.OS !== 'ios') return;
    if (!LiveActivity?.addActivityTokenListener) return;
    started = true;

    const tokenSub = LiveActivity.addActivityTokenListener((event) => {
      storeToken('liveactivity', event.activityPushToken, event.activityID).catch(() => {});
    });

    const startTokenSub = LiveActivity.addActivityPushToStartTokenListener((event) => {
      storeToken('pushtostart', event.activityPushToStartToken).catch(() => {});
    });

    // An ended activity's token is dead; APNs answers 410 for it forever. Drop
    // the cached copy too, or syncToCurrentUser would file it again on the next
    // sign-in and the server would push at an activity that no longer exists.
    const stateSub = LiveActivity.addActivityUpdatesListener((event) => {
      if (event.activityState === 'ended' || event.activityState === 'dismissed') {
        if (lastSeen.liveactivity?.activityId === event.activityID) {
          delete lastSeen.liveactivity;
        }
        dropActivityToken(event.activityID).catch(() => {});
      }
    });

    subscriptions = [tokenSub, startTokenSub, stateSub].filter(Boolean) as EventSubscription[];
  },

  /**
   * Re-file the tokens this device already holds under whoever is signed in now.
   *
   * Call on every sign-in and on cold-start session restore. Cheap and
   * idempotent — it is an upsert of at most two rows, and a no-op when no token
   * has been seen yet (a fresh install with no Live Activity ever started).
   */
  async syncToCurrentUser(): Promise<void> {
    if (Platform.OS !== 'ios') return;
    if (lastSeen.pushtostart) {
      await storeToken('pushtostart', lastSeen.pushtostart).catch(() => {});
    }
    if (lastSeen.liveactivity) {
      await storeToken(
        'liveactivity',
        lastSeen.liveactivity.token,
        lastSeen.liveactivity.activityId || undefined
      ).catch(() => {});
    }
  },

  /**
   * Forget every token for the signed-out user.
   *
   * Part of the sign-out wipe for the same reason the rest of it exists: a token
   * left behind would let this device keep receiving the previous account's
   * sessions on its Lock Screen.
   */
  async clear(userId: string): Promise<void> {
    try {
      const { error } = await supabase.from('device_push_tokens').delete().eq('user_id', userId);
      if (error) console.warn('[LiveActivityPush] failed to clear tokens:', error.message);
      // The tokens themselves stay valid for this device — only their ownership
      // changes — so the cache is kept for whoever signs in next.
    } catch (e) {
      console.warn('[LiveActivityPush] clear threw:', e);
    }
  },

  /** Test seam — drops the listeners without touching stored tokens. */
  stop(): void {
    subscriptions.forEach((s) => s.remove());
    subscriptions = [];
    started = false;
  },
};
