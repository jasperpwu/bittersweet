import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Copy desktop/.env.example to desktop/.env.local and fill it in from the Expo app .env.'
  );
}

/**
 * Same Supabase project as the iOS app, so the same RLS policies apply — every
 * table this client touches is gated on `auth.uid() = user_id`.
 *
 * Differences from `src/config/supabase.ts` (the iOS client), both deliberate:
 *  - storage is the browser's localStorage default, not Keychain/SecureStore
 *  - `detectSessionInUrl: true`, because a browser OAuth/magic-link redirect
 *    comes back with the code in the URL. iOS sets it false; it has no URL bar.
 */
export const supabase = createClient(url, publishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
