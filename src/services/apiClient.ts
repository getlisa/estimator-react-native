import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { hardLogout, silentLogin } from '@/lib/silentLogin';

/**
 * API Error Interface
 * Matches backend error structure
 */
export interface ApiError {
  status?: number;
  message: string;
  code?: string;
  details?: any;
}

/**
 * API Response Interface
 * Matches backend response structure: { data?, error? }
 */
export interface ApiResponse<T = any> {
  data?: T | null;
  error?: ApiError | null;
}

/**
 * Base API URL from environment variables
 * Falls back to localhost if not set
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

/**
 * Axios Client Instance
 * 
 * Features:
 * - Base URL configuration from environment variables
 * - Request interceptor for JWT token attachment
 * - Response interceptor that silently refreshes on 401 (logs out only if refresh fails)
 * - Comprehensive error handling
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

/**
 * Request Interceptor
 * Attaches JWT access token to all outgoing requests
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { access_token } = useAuthStore.getState();

    // Attach access token if available
    if (access_token && config.headers) {
      config.headers.Authorization = `Bearer ${access_token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Silent refresh: the login service signs short-lived access tokens, so a 401 on an
 * expired token is routine — exchange the stored refresh token for a new access token
 * and retry, logging out only when the refresh itself fails. Single-flight so a burst
 * of concurrent 401s triggers one refresh, and done on a bare axios call so the
 * refresh request can't recurse through this interceptor.
 */
let refreshPromise: Promise<string | null> | null = null;

export const refreshAccessToken = (): Promise<string | null> => {
  refreshPromise ??= (async () => {
    const { refresh_token } = useAuthStore.getState();
    if (!refresh_token) return silentLogin();
    try {
      const resp = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      // Tolerate both wrapped ({ data: … }) and bare bodies, snake/camel/nested keys —
      // the same shapes the login response has shipped in.
      const body = resp.data?.data ?? resp.data ?? {};
      const access =
        body.access_token ?? body.accessToken ?? body.token ?? body.tokens?.accessToken ?? null;
      const refresh =
        body.refresh_token ?? body.refreshToken ?? body.tokens?.refreshToken ?? null;
      if (!access) return silentLogin();
      useAuthStore.getState().setAccessToken(access);
      if (refresh) useAuthStore.getState().setRefreshToken(refresh);
      return access;
    } catch {
      // Dead refresh token: native re-logs in with saved credentials; web gives up.
      return silentLogin();
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

/**
 * Response Interceptor
 * On 401: refresh the access token and retry the request once; log out when there is
 * nothing left to try. Auth routes themselves (login/refresh/logout) never trigger a
 * refresh — a 401 there means bad credentials or a dead session, not an expired token.
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthRoute = Boolean(original?.url?.includes('/auth/'));

    if (error.response?.status === 401 && !isAuthRoute) {
      if (original && !original._retry) {
        original._retry = true;
        const newAccess = await refreshAccessToken();
        if (newAccess) {
          original.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(original);
        }
      }
      void hardLogout();
    }
    return Promise.reject(formatError(error));
  }
);

/**
 * Format error for consistent error handling
 */
const formatError = (error: AxiosError): ApiError => {
  if (error.response) {
    // API error with response
    const data = error.response.data as any;
    return {
      message: data?.message || error.message || 'An error occurred',
      status: error.response.status,
      code: data?.code,
      details: data?.details,
    };
  } else if (error.request) {
    // Network error - no response received
    return {
      message: 'Network error. Please check your connection.',
    };
  } else {
    // Other errors
    return {
      message: error.message || 'An unexpected error occurred',
    };
  }
};

/**
 * API Helper Methods
 * Type-safe wrappers around apiClient methods
 */

export const api = {
  /**
   * GET request
   */
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return apiClient.get(url, config).then((response) => {
      const apiResponse: ApiResponse<T> = response.data;
      if (apiResponse.error) {
        throw apiResponse.error;
      }
      return apiResponse.data as T;
    });
  },

  /**
   * POST request
   */
  post: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    return apiClient.post(url, data, config).then((response) => {
      const apiResponse: ApiResponse<T> = response.data;
      if (apiResponse.error) {
        throw apiResponse.error;
      }
      return apiResponse.data as T;
    });
  },

  /**
   * PUT request
   */
  put: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    return apiClient.put(url, data, config).then((response) => {
      const apiResponse: ApiResponse<T> = response.data;
      if (apiResponse.error) {
        throw apiResponse.error;
      }
      return apiResponse.data as T;
    });
  },

  /**
   * PATCH request
   */
  patch: <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> => {
    return apiClient.patch(url, data, config).then((response) => {
      const apiResponse: ApiResponse<T> = response.data;
      if (apiResponse.error) {
        throw apiResponse.error;
      }
      return apiResponse.data as T;
    });
  },

  /**
   * DELETE request
   */
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    return apiClient.delete(url, config).then((response) => {
      const apiResponse: ApiResponse<T> = response.data;
      if (apiResponse.error) {
        throw apiResponse.error;
      }
      return apiResponse.data as T;
    });
  },
};

export default apiClient;

