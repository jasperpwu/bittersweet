import { useState, useEffect, useCallback } from 'react';
import { AuthService, AuthResponse } from '../../services/api/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: AuthResponse['user'] | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (data: { email: string; password: string; name: string; confirmPassword: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (data: Partial<AuthResponse['user']>) => Promise<{ success: boolean; error?: string }>;
}

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

export const useAuth = (): AuthState & AuthActions => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const [token, userData] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        if (token && userData) {
          const user = JSON.parse(userData);
          setState({
            user,
            token,
            isLoading: false,
            isAuthenticated: true,
          });
          
          // Set token in API client
          const { client } = await import('../../services/api/client');
          client.setAuthToken(token);
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    initializeAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await AuthService.login({ email, password });
      
      if (response.success && response.data) {
        const { user, token, refreshToken } = response.data;
        
        // Store auth data
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, token),
          AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
        ]);

        setState({
          user,
          token,
          isLoading: false,
          isAuthenticated: true,
        });

        return { success: true };
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: response.error || 'Login failed' };
      }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Network error' };
    }
  }, []);

  const signup = useCallback(async (data: { email: string; password: string; name: string; confirmPassword: string }) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await AuthService.signup(data);
      
      if (response.success && response.data) {
        const { user, token, refreshToken } = response.data;
        
        // Store auth data
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, token),
          AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
          AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
        ]);

        setState({
          user,
          token,
          isLoading: false,
          isAuthenticated: true,
        });

        return { success: true };
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
        return { success: false, error: response.error || 'Signup failed' };
      }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: 'Network error' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);

      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const refreshTokenValue = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshTokenValue) return false;

      const response = await AuthService.refreshToken(refreshTokenValue);
      
      if (response.success && response.data) {
        const { token, refreshToken: newRefreshToken } = response.data;
        
        await Promise.all([
          AsyncStorage.setItem(TOKEN_KEY, token),
          AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken),
        ]);

        setState(prev => ({ ...prev, token }));
        
        // Update token in API client
        const { client } = await import('../../services/api/client');
        client.setAuthToken(token);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<AuthResponse['user']>) => {
    try {
      const response = await AuthService.updateProfile(data);
      
      if (response.success && response.data) {
        const updatedUser = response.data;
        
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        
        setState(prev => ({
          ...prev,
          user: updatedUser,
        }));

        return { success: true };
      } else {
        return { success: false, error: response.error || 'Update failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }, []);

  return {
    ...state,
    login,
    signup,
    logout,
    refreshToken,
    updateProfile,
  };
};