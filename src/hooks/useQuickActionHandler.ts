import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import type { Action } from 'expo-quick-actions';
import { openChat } from '../services/crisp';

/** Home Screen quick action (long-press the app icon) IDs. */
const CONTACT_DEVELOPER_ACTION_ID = 'contact-developer';

/**
 * Registers and handles iOS Home Screen quick actions.
 *
 * Registration is done at runtime (`QuickActions.setItems`) rather than
 * statically in `app.json`, because static `UIApplicationShortcutItems` titles
 * can only be localized through `InfoPlist.strings`, which follows the *device*
 * language and would ignore an in-app language override. Setting the items from
 * JS lets them use the same i18n resources as the rest of the UI, and they are
 * re-registered whenever the user switches language. The trade-off is that the
 * action only exists once the app has been launched at least once after install
 * — dynamic shortcut items live in the app's own state, not the bundle.
 *
 * The "Contact developer" action deeplinks to the Support & About page and
 * opens the in-app support chat so the user is immediately talking to us.
 *
 * Cold start vs. warm start:
 * - On a cold start (app launched by tapping the action) the action fires
 *   before the navigator and Crisp are mounted, so we defer until `isReady`.
 *   `useQuickActionCallback` re-invokes the launching action (`QuickActions.initial`)
 *   whenever the callback identity changes, so gating on `isReady` lets the
 *   replay land once we're ready.
 * - `QuickActions.initial` is a stable module-level reference, so we dedupe it
 *   by object identity to avoid handling the same launch action twice. Live taps
 *   (app already open) arrive as fresh action objects, so they're always handled.
 */
export function useQuickActionHandler(isReady: boolean) {
  const lastHandledRef = useRef<Action | null>(null);
  const { t, i18n } = useTranslation();

  useEffect(() => {
    QuickActions.setItems([
      {
        id: CONTACT_DEVELOPER_ACTION_ID,
        title: t('quickActions.contactDeveloperTitle'),
        subtitle: t('quickActions.contactDeveloperSubtitle'),
        icon: 'symbol:message.fill',
      },
    ]).catch((error) => {
      console.warn('[quickActions] Failed to register Home Screen actions', error);
    });
  }, [t, i18n.language]);

  useQuickActionCallback((action: Action) => {
    if (!isReady) return;
    if (action.id !== CONTACT_DEVELOPER_ACTION_ID) return;
    // Skip replays of the same launch action; live taps are distinct objects.
    if (lastHandledRef.current === action) return;

    lastHandledRef.current = action;
    router.navigate('/settings/support');
    openChat();
  });
}
