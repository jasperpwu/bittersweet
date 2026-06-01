import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Catch-all route for invite deep links.
 *
 * Expo Router automatically resolves bittersweet-mobile://invite/<code>
 * to this route. The actual invite handling is done by useDeepLinkHandler
 * via the Linking API. This route simply redirects to home to prevent
 * the +not-found screen from showing.
 */
export default function InviteCodeRoute() {
  useEffect(() => {
    router.replace('/');
  }, []);

  return null;
}
