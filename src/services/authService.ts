import { api } from '@/services/apiClient';
import { useAuthStore, User } from '@/store/useAuthStore';

/**
 * Login Request Interface
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login Response Interface
 * Matches backend structure: { user: {...}, tokens: { accessToken, refreshToken, expiresIn } }
 */
export interface LoginResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
  };
}

/**
 * Auth Service
 * 
 * Provides authentication-related API calls
 * Integrates with auth store for token management
 */
export const authService = {
  /**
   * Login user
   * @param credentials - User email and password
   * @returns User data and tokens
   */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    // Emails are stored lowercase (registration lowercases them); the login service
    // compares case-sensitively, so normalize here or ALEX@… 401s while alex@… works.
    const data = await api.post<LoginResponse>(
      '/auth/login',
      {
        ...credentials,
        email: credentials.email.trim().toLowerCase(),
      },
      // Login answers in well under a second; on a black-holed field network the
      // client-wide 30s timeout reads as a frozen screen. Fail to an error sooner.
      { timeout: 10000 }
    );
    
    // The auth server has shipped tokens as `tokens.accessToken`, `accessToken` and `access_token`
    // across environments — accept all three (same tolerance as field-native).
    const body = data as any;
    const accessToken = body?.tokens?.accessToken ?? body?.accessToken ?? body?.access_token ?? null;
    const refreshToken = body?.tokens?.refreshToken ?? body?.refreshToken ?? body?.refresh_token ?? null;
    if (body?.user && accessToken) {
      useAuthStore.getState().login(body.user, accessToken, refreshToken ?? '');
      return data;
    }
    throw new Error('Login failed - invalid response from server');
  },

  /**
   * Logout user
   * Calls backend to invalidate refresh token and clears local auth state
   */
  logout: async (): Promise<void> => {
    const { refresh_token } = useAuthStore.getState();
    
    try {
      // Call backend to invalidate refresh token
      if (refresh_token) {
        await api.post<{ message: string }>('/auth/logout', { refresh_token });
      }
    } catch (error) {
      // Continue with logout even if backend call fails
      console.error('Logout API error:', error);
    } finally {
      // Always clear local auth state
      useAuthStore.getState().logout();
    }
  },

  // TODO: Add these endpoints when backend is ready
  // /**
  //  * Get current user profile
  //  */
  // getCurrentUser: async (): Promise<User> => {
  //   const user = await api.get<User>('/auth/me');
  //   return user;
  // },

  // /**
  //  * Update user profile
  //  */
  // updateProfile: async (data: Partial<User>): Promise<User> => {
  //   const user = await api.patch<User>('/auth/profile', data);
  //   return user;
  // },

  // /**
  //  * Change password
  //  */
  // changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
  //   await api.post<void>('/auth/change-password', {
  //     current_password: currentPassword,
  //     new_password: newPassword,
  //   });
  // },

  // /**
  //  * Request password reset
  //  */
  // requestPasswordReset: async (email: string): Promise<void> => {
  //   await api.post<void>('/auth/forgot-password', { email });
  // },

  // /**
  //  * Reset password with token
  //  */
  // resetPassword: async (token: string, newPassword: string): Promise<void> => {
  //   await api.post<void>('/auth/reset-password', {
  //     token,
  //     password: newPassword,
  //   });
  // },
};

