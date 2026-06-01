import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../../config/supabase';

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface AuthSlice {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastSignedInUserId: string | null;

  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearAuthError: () => void;
}

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

      const user = data.user;
      set((state: any) => ({
        auth: {
          ...state.auth,
          user: {
            id: user.id,
            email: user.email ?? credential.email,
            fullName: fullName ?? user.user_metadata?.full_name ?? null,
            avatarUrl: user.user_metadata?.avatar_url ?? null,
          },
          isAuthenticated: true,
          isLoading: false,
        },
      }));
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

  signInWithEmail: async (email: string, password: string) => {
    set((state: any) => ({
      auth: { ...state.auth, isLoading: true, error: null },
    }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const user = data.user;
      set((state: any) => ({
        auth: {
          ...state.auth,
          user: {
            id: user.id,
            email: user.email ?? null,
            fullName: user.user_metadata?.full_name ?? null,
            avatarUrl: user.user_metadata?.avatar_url ?? null,
          },
          isAuthenticated: true,
          isLoading: false,
        },
      }));
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
      if (sessionData.session) {
        await supabase.functions.invoke('delete-account');
      }

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
    }
  },

  clearAuthError: () => {
    set((state: any) => ({
      auth: { ...state.auth, error: null },
    }));
  },
});
