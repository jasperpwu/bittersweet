/**
 * Auth slice implementation with user management, authentication tokens, and session handling
 * Addresses Requirements: 2.1, 2.2, 5.1, 5.2, 8.2, 9.2
 */

import { AuthSlice, AsyncState, User, UserPreferences, UserStats } from '../types';
import { createAsyncAction } from '../middleware';
import { createEventEmitter, STORE_EVENTS } from '../utils/eventBus';
import { get } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';

// Mock API functions (replace with actual API calls)
const authAPI = {
  login: async (credentials: { email: string; password: string }): Promise<{ user: User; authToken: string; refreshToken: string }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock validation
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }
    
    if (!credentials.email.includes('@')) {
      throw new Error('Invalid email format');
    }
    
    if (credentials.password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    
    // Mock failed login for demo purposes
    if (credentials.email === 'fail@test.com') {
      throw new Error('Invalid credentials');
    }
    
    // Mock successful login
    const mockUser: User = {
      id: `user-${Date.now()}`,
      email: credentials.email,
      name: credentials.email.split('@')[0],
      avatar: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        theme: 'system',
        notifications: true,
        soundEnabled: true,
        hapticFeedback: true,
        defaultFocusDuration: 25,
        autoStartBreaks: false,
      },
      stats: {
        totalFocusTime: 0,
        totalSessions: 0,
        currentStreak: 0,
        longestStreak: 0,
        seedsEarned: 0,
        level: 1,
        experience: 0,
      },
    };
    
    return {
      user: mockUser,
      authToken: `auth-token-${Date.now()}`,
      refreshToken: `refresh-token-${Date.now()}`,
    };
  },
  
  refreshToken: async (refreshToken: string): Promise<{ authToken: string; refreshToken: string }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      authToken: 'new-mock-auth-token',
      refreshToken: 'new-mock-refresh-token',
    };
  },
  
  updateProfile: async (userId: string, updates: Partial<User>): Promise<User> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    // Return updated user (mock)
    const currentUser = get().auth.user;
    if (!currentUser) throw new Error('No user logged in');
    
    return {
      ...currentUser,
      ...updates,
      updatedAt: new Date(),
    };
  },
};

export function createAuthSlice(set: any, get: any, api: any): AuthSlice {
  const eventEmitter = createEventEmitter('auth');
  
  return {
    // State
    user: null,
    isAuthenticated: false,
    authToken: null,
    refreshToken: null,
    loginState: { data: null, loading: false, error: null, lastFetch: null },
    
    // Actions
    login: async (credentials: { email: string; password: string }) => {
      const loginAction = createAsyncAction('login', authAPI.login);
      
      try {
        set((state: any) => {
          state.auth.loginState.loading = true;
          state.auth.loginState.error = null;
        });
        
        const result = await loginAction(credentials, { set, get });
        
        set((state: any) => {
          state.auth.user = result.user;
          state.auth.authToken = result.authToken;
          state.auth.refreshToken = result.refreshToken;
          state.auth.isAuthenticated = true;
          state.auth.loginState.loading = false;
          state.auth.loginState.data = result.user;
          state.auth.loginState.lastFetch = new Date();
        });
        
        // Emit login event for cross-store communication
        eventEmitter.emitUserLoggedIn(result.user);
        
        if (__DEV__) {
          console.log('✅ User logged in successfully:', result.user.email);
        }
      } catch (error) {
        set((state: any) => {
          state.auth.loginState.loading = false;
          state.auth.loginState.error = error instanceof Error ? error.message : 'Login failed';
        });
        
        if (__DEV__) {
          console.error('❌ Login failed:', error);
        }
        
        throw error;
      }
    },
    
    logout: () => {
      set((state: any) => {
        const user = state.auth.user;
        
        // Clear auth state
        state.auth.user = null;
        state.auth.authToken = null;
        state.auth.refreshToken = null;
        state.auth.isAuthenticated = false;
        state.auth.loginState = { data: null, loading: false, error: null, lastFetch: null };
      });
      
      // Emit logout event for cross-store communication
      eventEmitter.emitUserLoggedOut();
      
      if (__DEV__) {
        console.log('✅ User logged out successfully');
      }
    },
    
    refreshAuth: async () => {
      const currentRefreshToken = get().auth.refreshToken;
      
      if (!currentRefreshToken) {
        throw new Error('No refresh token available');
      }
      
      try {
        const result = await authAPI.refreshToken(currentRefreshToken);
        
        set((state: any) => {
          state.auth.authToken = result.authToken;
          state.auth.refreshToken = result.refreshToken;
        });
        
        if (__DEV__) {
          console.log('✅ Auth tokens refreshed successfully');
        }
      } catch (error) {
        // If refresh fails, logout user
        get().auth.logout();
        
        if (__DEV__) {
          console.error('❌ Token refresh failed, logging out user:', error);
        }
        
        throw error;
      }
    },
    
    updateProfile: async (updates: Partial<User>) => {
      const currentUser = get().auth.user;
      
      if (!currentUser) {
        throw new Error('No user logged in');
      }
      
      try {
        // Mock API call - replace with actual API
        await new Promise(resolve => setTimeout(resolve, 500));
        const updatedUser = {
          ...currentUser,
          ...updates,
          updatedAt: new Date(),
        };
        
        set((state: any) => {
          state.auth.user = updatedUser;
        });
        
        // Emit profile update event
        eventEmitter.emit(STORE_EVENTS.USER_PROFILE_UPDATED, { user: updatedUser });
        
        if (__DEV__) {
          console.log('✅ User profile updated successfully');
        }
      } catch (error) {
        if (__DEV__) {
          console.error('❌ Profile update failed:', error);
        }
        
        throw error;
      }
    },
    
    // Selectors
    getUser: () => get().auth.user,
    isLoggedIn: () => get().auth.isAuthenticated,
  };
}