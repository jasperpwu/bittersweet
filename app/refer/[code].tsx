import { useEffect } from 'react';
import { router } from 'expo-router';

/**
 * Catch-all route for referral deep links.
 *
 * Expo Router automatically resolves bittersweet-mobile://refer/<code>
 * to this route. The actual referral handling is done by useDeepLinkHandler
 * via the Linking API. This route simply redirects to home to prevent
 * the +not-found screen from showing.
 */
export default function ReferCodeRoute() {
  useEffect(() => {
    router.replace('/');
  }, []);

  return null;
}
