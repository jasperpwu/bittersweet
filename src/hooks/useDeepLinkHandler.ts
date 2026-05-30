import { useEffect } from 'react';
import { Linking, Alert } from 'react-native';
import { useAppStore } from '../store';

const INVITE_PREFIX = 'bittersweet-mobile://invite/';

function extractInviteCode(url: string): string | null {
  if (url.startsWith(INVITE_PREFIX)) {
    const code = url.slice(INVITE_PREFIX.length).split('?')[0].split('#')[0];
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
    const result = await store.grove.resolveInviteCode(code);
    Alert.alert(
      'Friend Added',
      `You and ${result.friend.display_name} are now friends!`,
      [{ text: 'OK' }]
    );
  } catch (error: any) {
    const message = error.message;
    if (message === 'INVALID_CODE') {
      Alert.alert('Invalid Link', 'This invite link is no longer valid.');
    } else if (message === 'SELF_INVITE') {
      Alert.alert('Oops', "You can't add yourself as a friend!");
    } else if (message === 'ALREADY_FRIENDS') {
      Alert.alert('Already Friends', "You're already friends with this person.");
    } else {
      Alert.alert('Error', 'Failed to process invite link. Please try again.');
    }
  }
}

export function useDeepLinkHandler() {
  useEffect(() => {
    // Handle deep link when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const code = extractInviteCode(url);
      if (code) {
        handleInviteCode(code);
      }
    });

    // Handle deep link that opened the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        const code = extractInviteCode(url);
        if (code) {
          // Small delay to let app initialize
          setTimeout(() => handleInviteCode(code), 1000);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
