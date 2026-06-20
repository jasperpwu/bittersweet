import { useRef } from 'react';
import { router } from 'expo-router';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
import type { Action } from 'expo-quick-actions';
import { openChat } from '../services/crisp';

/**
 * Home Screen quick action (long-press the app icon) IDs. Keep in sync with the
 * `iosActions` entries registered in `app.json` under the `expo-quick-actions`
 * plugin.
 */
const CONTACT_DEVELOPER_ACTION_ID = 'contact-developer';

/**
 * Handles iOS Home Screen quick actions.
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
