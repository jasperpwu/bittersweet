import { client, ApiResponse } from './client';

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  email: string;
  password: string;
  name: string;
  confirmPassword: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    createdAt: string;
  };
  token: string;
  refreshToken: string;
}

interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

interface ForgotPasswordData {
  email: string;
}

interface ResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}

export const AuthService = {
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    return client.post<AuthResponse>('/auth/login', credentials);
  },

  async signup(data: SignupData): Promise<ApiResponse<AuthResponse>> {
    return client.post<AuthResponse>('/auth/signup', data);
  },

  async logout(): Promise<ApiResponse<void>> {
    const response = await client.post<void>('/auth/logout');
    client.removeAuthToken();
    return response;
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<RefreshTokenResponse>> {
    return client.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
  },

  async forgotPassword(data: ForgotPasswordData): Promise<ApiResponse<void>> {
    return client.post<void>('/auth/forgot-password', data);
  },

  async resetPassword(data: ResetPasswordData): Promise<ApiResponse<void>> {
    return client.post<void>('/auth/reset-password', data);
  },

  async verifyEmail(token: string): Promise<ApiResponse<void>> {
    return client.post<void>('/auth/verify-email', { token });
  },

  async resendVerification(email: string): Promise<ApiResponse<void>> {
    return client.post<void>('/auth/resend-verification', { email });
  },

  async getProfile(): Promise<ApiResponse<AuthResponse['user']>> {
    return client.get<AuthResponse['user']>('/auth/profile');
  },

  async updateProfile(data: Partial<AuthResponse['user']>): Promise<ApiResponse<AuthResponse['user']>> {
    return client.patch<AuthResponse['user']>('/auth/profile', data);
  },

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<ApiResponse<void>> {
    return client.post<void>('/auth/change-password', data);
  },

  async deleteAccount(): Promise<ApiResponse<void>> {
    return client.delete<void>('/auth/account');
  },
};

export type {
  LoginCredentials,
  SignupData,
  AuthResponse,
  RefreshTokenResponse,
  ForgotPasswordData,
  ResetPasswordData,
};