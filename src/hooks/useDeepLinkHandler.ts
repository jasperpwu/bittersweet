import { useEffect } from 'react';
import { Linking, Alert } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store';

const INVITE_PATTERN = /^bittersweet-mobile(?:-dev)?:\/\/invite\/(.+)/;
const REFER_PATTERN = /^bittersweet-mobile(?:-dev)?:\/\/refer\/(.+)/;
const INSIGHTS_PATTERN = /^bittersweet-mobile(?:-dev)?:\/\/insights\/?$/;

const PENDING_REFERRAL_KEY = 'bittersweet-pending-referral-code';

function extractInviteCode(url: string): string | null {
  const match = url.match(INVITE_PATTERN);
  if (match) {
    const code = match[1].split('?')[0].split('#')[0];
    return code || null;
  }
  return null;
}

function extractReferralCode(url: string): string | null {
  const match = url.match(REFER_PATTERN);
  if (match) {
    const code = match[1].split('?')[0].split('#')[0];
    return code || null;
  }
  return null;
}

async function handleInviteCode(code: string) {
  const store = useAppStore.getState();

  if (!store.auth.isAuthenticated) {
    Alert.alert(
      'Sign In Required',
      'You need to sign in before adding friends.',
      [{ text: 'OK' }]
    );
    return;
  }

  if (!store.grove.profile) {
    Alert.alert(
      'Set Up Grove',
      'You need to set up your Grove profile before adding friends.',
      [{ text: 'OK' }]
    );
    return;
  }

  try {
    await store.grove.lookupInviteCode(code);
    router.push('/(modals)/invite-preview');
  } catch (error: any) {
    const message = error.message;
    if (message === 'INVALID_CODE') {
      Alert.alert('Invalid Link', 'This invite link is no longer valid.');
    } else if (message === 'SELF_INVITE') {
      Alert.alert('Oops', "You can't add yourself as a friend!");
    } else {
      Alert.alert('Error', 'Failed to process invite link. Please try again.');
    }
  }
}

async function handleReferralCode(code: string) {
  const store = useAppStore.getState();

  if (!store.auth.isAuthenticated) {
    // Store for later — will be applied after sign-up
    await AsyncStorage.setItem(PENDING_REFERRAL_KEY, code);
    return;
  }

  // Apply immediately
  await store.referral.applyReferralCode(code);
}

function handleDeepLink(url: string) {
  const inviteCode = extractInviteCode(url);
  if (inviteCode) {
    handleInviteCode(inviteCode);
    return;
  }

  const referralCode = extractReferralCode(url);
  if (referralCode) {
    handleReferralCode(referralCode);
    return;
  }

  // Widget deep link: navigate to insights tab
  if (INSIGHTS_PATTERN.test(url)) {
    router.replace('/(tabs)/insights');
    return;
  }

}

export { PENDING_REFERRAL_KEY };

export function useDeepLinkHandler() {
  useEffect(() => {
    // Handle deep link when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Handle deep link that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        // Small delay to let app initialize
        setTimeout(() => handleDeepLink(url), 1000);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
