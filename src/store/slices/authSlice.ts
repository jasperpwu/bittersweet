import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../config/supabase';
import { SyncService } from '../../services/sync/SyncService';
import { PENDING_REFERRAL_KEY } from '../../hooks/useDeepLinkHandler';

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

/**
 * Outcome of an email sign-up. `confirmationSent` means the Supabase project has
 * "Confirm email" enabled, so no session exists yet — the user must tap the link
 * we just emailed them, which comes back through the `auth/reset` deep link.
 */
export type SignUpOutcome = 'signedIn' | 'confirmationSent' | 'failed';

export interface AuthSlice {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastSignedInUserId: string | null;

  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpOutcome>;
  sendPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearAuthError: () => void;
}

/**
 * Where Supabase sends the user after they tap a link in a confirmation or
 * password-reset email. `createURL` resolves the variant-aware scheme
 * (`bittersweet-mobile://` vs `bittersweet-mobile-dev://`), so dev and prod
 * builds each get their own link — but BOTH must be added to the Supabase
 * dashboard's redirect allowlist or the link bounces to the Site URL instead.
 */
export const AUTH_REDIRECT_URL = Linking.createURL('auth/reset');

/** Minimum enforced by Supabase's default password policy. */
export const MIN_PASSWORD_LENGTH = 6;

// GoogleSignin.configure() must run once before any other GoogleSignin call.
// Client IDs come from app.config.js extra (variant-aware: dev vs prod).
let googleSignInConfigured = false;
const configureGoogleSignIn = () => {
  if (googleSignInConfigured) return;
  GoogleSignin.configure({
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
  });
  googleSignInConfigured = true;
};

// Shared post-sign-in: store the user and apply any referral code saved from a
// deep link before sign-in. `overrides` carries provider values not (yet) in
// user_metadata — e.g. Apple only sends fullName/email on the first sign-in.
const completeSignIn = async (
  set: any,
  get: any,
  user: SupabaseUser,
  overrides: { email?: string | null; fullName?: string | null } = {}
) => {
  set((state: any) => ({
    auth: {
      ...state.auth,
      user: {
        id: user.id,
        email: user.email ?? overrides.email ?? null,
        fullName: overrides.fullName ?? user.user_metadata?.full_name ?? null,
        avatarUrl: user.user_metadata?.avatar_url ?? null,
        createdAt: user.created_at ?? null,
      },
      isAuthenticated: true,
      isLoading: false,
    },
  }));

  // Check for pending referral code (from deep link before sign-in)
  try {
    const pendingCode = await AsyncStorage.getItem(PENDING_REFERRAL_KEY);
    if (pendingCode) {
      await AsyncStorage.removeItem(PENDING_REFERRAL_KEY);
      await get().referral.applyReferralCode(pendingCode);
    }
  } catch (refError: any) {
    console.error('Failed to apply pending referral code:', refError);
  }
};

export const createAuthSlice = (set: any, get: any): AuthSlice => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastSignedInUserId: null,

  signInWithApple: async () => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;

      // Apple only sends fullName on the first sign-in — persist it
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ')
        : null;

      if (fullName) {
        await supabase.auth.updateUser({
          data: { full_name: fullName },
        });
      }

      await completeSignIn(set, get, data.user, {
        email: credential.email,
        fullName,
      });
    } catch (error: any) {
      // User cancelled is not an error
      if (error.code === 'ERR_REQUEST_CANCELED') {
        set((state: any) => ({
          auth: { ...state.auth, isLoading: false },
        }));
        return;
      }

      console.error('Apple Sign-In error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Sign-in failed',
        },
      }));
    }
  },

  signInWithGoogle: async () => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      configureGoogleSignIn();
      const response = await GoogleSignin.signIn();

      // User cancelled is not an error (v13+ resolves with type 'cancelled'
      // instead of rejecting)
      if (response.type === 'cancelled') {
        set((state: any) => ({
          auth: { ...state.auth, isLoading: false },
        }));
        return;
      }

      if (!response.data.idToken) {
        throw new Error('No identity token received from Google');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      });

      if (error) throw error;

      await completeSignIn(set, get, data.user);
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Sign-in failed',
        },
      }));
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      // Sign-in only — never falls back to creating an account. Supabase returns
      // the same `invalid_credentials` error for "no such user" and "wrong
      // password" (deliberate anti-enumeration), so a silent sign-up fallback
      // can't tell a typo'd email from a genuinely new one: it would strand the
      // user in a brand-new empty account instead of showing "wrong password".
      // Account creation is explicit, via signUpWithEmail.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Sign-in failed');

      await completeSignIn(set, get, data.user);
      return true;
    } catch (error: any) {
      console.error('Email Sign-In error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Sign-in failed',
        },
      }));
      return false;
    }
  },

  signUpWithEmail: async (email: string, password: string) => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: AUTH_REDIRECT_URL },
      });

      if (error) throw error;

      // Supabase obfuscates "email already registered" rather than erroring, to
      // avoid leaking which addresses have accounts: it returns a user with an
      // EMPTY identities array and no session. Surfacing a generic message keeps
      // that property while still telling the user to try signing in.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error('EMAIL_ALREADY_REGISTERED');
      }

      // "Confirm email" is enabled on the project → no session yet. The user must
      // tap the emailed link, which returns through the auth/reset deep link and
      // is exchanged for a session there.
      if (!data.session) {
        set((state: any) => ({ auth: { ...state.auth, isLoading: false } }));
        return 'confirmationSent';
      }

      // Brand-new account, already signed in. The onAuthStateChange listener in
      // _layout.tsx runs the new-signup data lifecycle (cloud-empty probe →
      // initialUpload), which preserves anything built before the account.
      await completeSignIn(set, get, data.user!);
      return 'signedIn';
    } catch (error: any) {
      console.error('Email Sign-Up error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Sign-up failed',
        },
      }));
      return 'failed';
    }
  },

  sendPasswordReset: async (email: string) => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      // With flowType 'pkce' this stashes a code verifier (suffixed `/recovery`)
      // in the Keychain and emails a link carrying the matching challenge. The
      // verifier is what lets exchangeCodeForSession later mint a session — so
      // the reset MUST be completed on this same device/install.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: AUTH_REDIRECT_URL,
      });

      if (error) throw error;

      set((state: any) => ({ auth: { ...state.auth, isLoading: false } }));
      return true;
    } catch (error: any) {
      console.error('Password reset request error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Could not send reset email',
        },
      }));
      return false;
    }
  },

  updatePassword: async (newPassword: string) => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      // Requires the recovery session established by exchangeCodeForSession in
      // the deep-link handler; without it Supabase rejects the update.
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      if (data.user) {
        await completeSignIn(set, get, data.user);
      }
      set((state: any) => ({ auth: { ...state.auth, isLoading: false } }));
      return true;
    } catch (error: any) {
      console.error('Password update error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Could not update password',
        },
      }));
      return false;
    }
  },

  signOut: async () => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      // Best-effort: clear the native Google session so the next Google
      // sign-in shows the account picker instead of silently reusing the
      // last account. Never blocks the Supabase sign-out.
      try {
        configureGoogleSignIn();
        await GoogleSignin.signOut();
      } catch (googleError) {
        console.warn('Google sign-out skipped:', googleError);
      }

      // Flush any queued writes to the cloud while the token is STILL VALID.
      // This must happen before signOut(): afterward the token is gone (so
      // SyncService.flush()'s getSession guard no-ops), and the SIGNED_OUT
      // handler's resetSyncSnapshot() calls syncQueue.clear() — so any op not
      // flushed here is dropped for good on the local wipe. That is the exact
      // path that stranded a completed session (queued, never flushed, then the
      // queue was cleared). Best-effort: an offline sign-out can't reach the
      // cloud and those rows are unavoidably lost, but a reachable one now
      // durably saves the user's in-flight sessions instead of discarding them.
      try {
        const result = await SyncService.flush();
        console.log(
          `[signOut] Pre-sign-out flush — flushed:${result.flushed} failed:${result.failed}`
        );
      } catch (flushError) {
        console.warn('[signOut] Pre-sign-out flush failed:', flushError);
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set((state: any) => ({
        auth: {
          ...state.auth,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        },
      }));
    } catch (error: any) {
      console.error('Sign-out error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Sign-out failed',
        },
      }));
    }
  },

  restoreSession: async () => {
    try {
      // The session lives in the Keychain (expo-secure-store), which persists
      // across uninstall/reinstall — intentionally: a reinstall restores the
      // sign-in, and the INITIAL_SESSION cold-start merge repopulates local
      // data from the cloud. A stale session (e.g. deleted account) self-heals:
      // its refresh fails, supabase-js emits SIGNED_OUT, and the wipe path runs.
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session?.user) {
        const user = data.session.user;
        set((state: any) => ({
          auth: {
            ...state.auth,
            user: {
              id: user.id,
              email: user.email ?? null,
              fullName: user.user_metadata?.full_name ?? null,
              avatarUrl: user.user_metadata?.avatar_url ?? null,
              createdAt: user.created_at ?? null,
            },
            isAuthenticated: true,
          },
        }));
      }
    } catch (error: any) {
      console.error('Session restore error:', error);
    }
  },

  deleteAccount: async () => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('You must be signed in to delete your account.');
      }

      // Permanently delete the account + all cloud data. The function returns
      // errors in its result (it does not throw), and a handled failure comes
      // back as { data: { error } } — check both so we never wipe local state
      // and sign out while cloud data still exists.
      const { data, error } = await supabase.functions.invoke('delete-account');
      if (error) {
        throw new Error(error.message || 'Account deletion failed.');
      }
      if (data?.error) {
        throw new Error(data.detail || data.error);
      }

      // Sign-out triggers the auth listener, which wipes all local data.
      await supabase.auth.signOut();

      set((state: any) => ({
        auth: {
          ...state.auth,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        },
      }));
    } catch (error: any) {
      console.error('Delete account error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Account deletion failed',
        },
      }));
      // Re-throw so the UI can tell the user it failed (we stayed signed in
      // and kept local data — nothing was deleted).
      throw error;
    }
  },

  clearAuthError: () => {
    set((state: any) => ({
      auth: { ...state.auth, error: null },
    }));
  },
});
