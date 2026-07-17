import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../config/supabase';
import { PENDING_REFERRAL_KEY } from '../../hooks/useDeepLinkHandler';

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

export interface AuthSlice {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastSignedInUserId: string | null;

  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearAuthError: () => void;
}

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
      const signInResult = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      let user = signInResult.data.user;

      if (signInResult.error) {
        // No matching auth record (e.g. a test account that was deleted) →
        // transparently sign up instead. Supabase returns the same
        // `invalid_credentials` error for "no such user" AND "wrong password"
        // (deliberate anti-enumeration), so we can't tell them apart: we just
        // try to create the account. If the email already exists, signUp fails
        // (or returns no session) and we surface the original sign-in error.
        if (signInResult.error.code === 'invalid_credentials') {
          const signUpResult = await supabase.auth.signUp({ email, password });
          console.log('🔐 Auto-signup fallback:', {
            signUpError: signUpResult.error?.message,
            signUpErrorCode: signUpResult.error?.code,
            hasSession: !!signUpResult.data.session,
            hasUser: !!signUpResult.data.user,
            // empty identities array = email already registered (obfuscated)
            identities: signUpResult.data.user?.identities?.length,
          });
          if (signUpResult.error || !signUpResult.data.session) {
            throw signInResult.error;
          }
          // Brand-new account created and signed in. The onAuthStateChange
          // listener in _layout.tsx handles the new-signup data lifecycle
          // (cloud-empty probe → initialUpload).
          user = signUpResult.data.user;
        } else {
          throw signInResult.error;
        }
      }

      if (!user) throw signInResult.error ?? new Error('Sign-in failed');

      await completeSignIn(set, get, user);
    } catch (error: any) {
      console.error('Email Sign-In error:', error);
      set((state: any) => ({
        auth: {
          ...state.auth,
          isLoading: false,
          error: error.message || 'Sign-in failed',
        },
      }));
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
      // Detect fresh install: AsyncStorage is deleted on uninstall, but
      // Keychain (expo-secure-store) persists. If our flag is missing,
      // this is a fresh install — clear the stale Keychain session.
      const INSTALLED_FLAG_KEY = 'bittersweet-installed';
      const hasLaunchedBefore = await AsyncStorage.getItem(INSTALLED_FLAG_KEY);

      if (!hasLaunchedBefore) {
        console.log('🔐 Fresh install detected — clearing stale Keychain session');
        // No default tags are seeded here — a fresh install always goes through
        // onboarding, and completeOnboarding creates the user's three chosen tags.
        await supabase.auth.signOut();
        await AsyncStorage.setItem(INSTALLED_FLAG_KEY, 'true');
        // No session to restore after clearing
        return;
      }

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
