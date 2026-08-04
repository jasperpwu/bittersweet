/**
 * How the shield's "Unlock App" button reaches Bittersweet, and what has to be
 * true for it to work.
 *
 * iOS 26.5 added `ShieldActionResponse.openParentalControlsApp`, which opens the
 * app that applied the shield directly. Below 26.5 there is no supported way for
 * an app extension to open its containing app, so the shield posts a local
 * notification instead and the user taps it — which silently does nothing if
 * notifications aren't allowed.
 *
 * So on iOS < 26.5 only, notification permission is what makes that button work.
 * This module detects that case and asks for permission at the moment it starts
 * to matter (right after a blocklist is saved), rather than gating the app on it
 * — App Review guideline 5.1.2(i) forbids requiring system functionality like
 * notifications in order to use an app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';

import i18n from '../i18n';

/**
 * Mirrors the `#available(iOS 26.5, *)` guard in
 * `targets/ShieldAction/ShieldActionExtension.swift`. Keep the two in sync — if
 * they disagree, users get either a missing handoff or a stray notification.
 */
const SHIELD_OPENS_APP_MIN_IOS = [26, 5];

/** Local-only: depends on this device's iOS version, so it must not sync. */
const PROMPT_LAST_SHOWN_KEY = 'bittersweet-shield-notif-prompt-last-shown';

/**
 * How often to re-raise the ask. Affected users are stuck with a shield button
 * that can't reach the app, so this repeats rather than showing once — but not
 * so often that it reads as badgering. Every prompt is dismissible and the app
 * stays fully usable either way (App Review guideline 5.1.2(i)).
 */
const NAG_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * True when this device's iOS can open Bittersweet straight from the shield, so
 * the notification fallback (and its permission) is irrelevant.
 */
export function shieldOpensAppDirectly(): boolean {
  if (Platform.OS !== 'ios') return false;

  // Compare component-wise rather than with parseFloat: parseFloat('26.10')
  // is 26.1, which would misread a later minor version as older than 26.5.
  const parts = String(Platform.Version)
    .split('.')
    .map((part) => parseInt(part, 10) || 0);

  for (let i = 0; i < SHIELD_OPENS_APP_MIN_IOS.length; i++) {
    const actual = parts[i] ?? 0;
    const required = SHIELD_OPENS_APP_MIN_IOS[i];
    if (actual > required) return true;
    if (actual < required) return false;
  }
  return true;
}

/**
 * Explain that the shield's Unlock button needs notifications, and either
 * request the permission or send the user to Settings if iOS won't let us ask
 * again.
 *
 * No-ops on iOS 26.5+, when permission is already granted, and while inside the
 * nag interval. Declining is always allowed; blocking still works, the user just
 * has to open Bittersweet themselves to unlock.
 */
export async function maybePromptForShieldUnlockNotifications(): Promise<void> {
  try {
    if (shieldOpensAppDirectly()) return;

    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return;

    const lastShown = Number(await AsyncStorage.getItem(PROMPT_LAST_SHOWN_KEY)) || 0;
    if (Date.now() - lastShown < NAG_INTERVAL_MS) return;
    await AsyncStorage.setItem(PROMPT_LAST_SHOWN_KEY, String(Date.now()));

    if (canAskAgain) {
      Alert.alert(i18n.t('shield.notifPromptTitle'), i18n.t('shield.notifPromptBody'), [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('shield.notifPromptEnable'),
          onPress: () => {
            Notifications.requestPermissionsAsync();
          },
        },
      ]);
      return;
    }

    // Denied at the OS level — iOS won't show the prompt again, so Settings is
    // the only way back.
    Alert.alert(i18n.t('shield.notifPromptTitle'), i18n.t('shield.notifPromptBody'), [
      { text: i18n.t('common.cancel'), style: 'cancel' },
      { text: i18n.t('journal.openSettings'), onPress: () => Linking.openSettings() },
    ]);
  } catch (error) {
    // Never let a permission check block saving a blocklist.
    console.error('❌ Failed to check shield unlock notification permission:', error);
  }
}
