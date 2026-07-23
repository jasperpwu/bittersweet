import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const secureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error(`SecureStore getItem error for "${key}":`, error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`SecureStore setItem error for "${key}":`, error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`SecureStore removeItem error for "${key}":`, error);
    }
  },
  isServer: false as const,
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// React Native's fetch has NO default timeout: a request that stalls on a marginal
// uplink hangs until the OS eventually gives up (tens of seconds) before throwing
// "TypeError: Network request failed". In the sequential sync flush that means one
// hung socket blocks every queued row behind it — the main reason sign-out flush
// "takes forever". Wrap fetch with an AbortController so a stalled request fails fast
// and the flush moves on (the row stays queued and retries next flush).
const REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Respect a signal the caller already passed (e.g. supabase-js aborting a refresh):
  // forward its abort to ours so we don't leak either listener.
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
};

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  global: {
    fetch: fetchWithTimeout,
  },
});
