// Analytics tracker — thin, swappable wrapper around PostHog.
//
// All analytics flows through this module so the underlying SDK stays replaceable
// and event names stay consistent. The `posthog` client is a standalone instance
// (ready immediately, no async init) so it can be used both from React via
// `<PostHogProvider client={posthog}>` and from non-React code (Zustand store,
// services). See docs/analytics-plan.md for the event/person-property spec.

import PostHog from 'posthog-react-native';

import { DEBUG_FLAGS } from '../../config/constants';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

// Null when no key is configured (e.g. local dev / CI) — every call below no-ops,
// so analytics is fully optional and never throws.
export const posthog = POSTHOG_KEY
  ? new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // The standalone client registers its own AppState listener and emits
      // Application Opened / Became Active / Backgrounded — this is our DAU /
      // retention backbone, so no <PostHogProvider> is required. (Default is
      // already true; set explicitly to document the dependency.)
      captureAppLifecycleEvents: true,
      // In dev, send each event immediately instead of waiting for the batch
      // flush, so events appear in PostHog right away during local testing.
      flushAt: __DEV__ ? 1 : 20,
    })
  : null;

if (posthog) {
  // Mark this person as anonymous until an explicit sign-in flips it to true.
  // `$set_once` so it never clobbers an already-identified user's `is_signed_in:
  // true` on a returning-session launch — it only fills the gap for never-signed-in
  // persons, making "anonymous vs signed-in" a clean cohort filter in PostHog.
  posthog.capture('$set', { $set_once: { is_signed_in: false } });

  if (__DEV__ && DEBUG_FLAGS.analytics) {
    // Verbose `[PostHog] …` console logging of every capture + network request.
    posthog.debug(true);
    console.log(`[Analytics] PostHog initialized → host=${POSTHOG_HOST}`);
  }
} else {
  console.warn('[Analytics] EXPO_PUBLIC_POSTHOG_KEY not set — analytics disabled.');
}

type Props = Record<string, any>;

interface TrackOptions {
  /** Person properties to set on the current user (always overwrites). */
  set?: Props;
  /** Person properties to set only if not already set (e.g. first-touch flags). */
  setOnce?: Props;
}

export const AnalyticsTracker = {
  /**
   * Capture an event. Optionally attach person-property updates via `set` /
   * `setOnce` so cohort properties ride along with the event that changes them.
   */
  track(event: string, properties?: Props, options?: TrackOptions): void {
    if (!posthog) return;
    const payload: Props = { ...(properties ?? {}) };
    if (options?.set) payload.$set = options.set;
    if (options?.setOnce) payload.$set_once = options.setOnce;
    posthog.capture(event, payload);
  },

  /** Associate subsequent events with a known user (call on auth). */
  identify(distinctId: string, personProperties?: Props): void {
    posthog?.identify(distinctId, personProperties);
  },

  /**
   * Update person properties without a semantic event. Prefer passing `set` /
   * `setOnce` to `track()` when an event is already firing.
   */
  setPersonProperties(set?: Props, setOnce?: Props): void {
    if (!posthog || (!set && !setOnce)) return;
    posthog.capture('$set', {
      ...(set ? { $set: set } : {}),
      ...(setOnce ? { $set_once: setOnce } : {}),
    });
  },

  /**
   * Mirror the user's preference surface onto the person.
   *
   * Must be called BOTH on every preference edit and once per launch. Edit-only
   * stamping was the original bug: a user who never opens Settings would have no
   * `language` / `theme` / `timer_picker_style` at all, so the settings-distribution
   * charts would silently cover only the minority who changed something and drop
   * everyone on defaults into a "not set" bucket.
   *
   * Loosely typed on purpose — this module must not import the store (circular).
   */
  syncPreferenceProperties(preferences: any): void {
    if (!preferences) return;
    AnalyticsTracker.setPersonProperties({
      language: preferences.language,
      theme: preferences.theme,
      multitask_enabled: preferences.adhdModeEnabled ?? false,
      timer_picker_style: preferences.focus?.timerPickerStyle,
      goal_reminder_enabled: preferences.notifications?.goalReminderEnabled,
      notifications_enabled: preferences.notifications?.enabled,
      healthkit_enabled: preferences.healthKit?.enabled ?? false,
      slider_theme_id: preferences.sliderThemeId ?? null,
    });
  },

  /** Clear the current identity (call on sign-out — privacy requirement). */
  reset(): void {
    if (!posthog) return;
    // reset() spawns a fresh anonymous distinct_id with no person properties, so
    // re-stamp it as anonymous — otherwise post-logout events stay unlabelled
    // until the next app launch re-runs the init `$set_once`.
    posthog.reset();
    posthog.capture('$set', { $set: { is_signed_in: false } });
  },
};
