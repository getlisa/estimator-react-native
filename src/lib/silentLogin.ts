import axios from 'axios';
import { Platform } from 'react-native';

import { credentialService } from '@/services/credentialService';
import { useAuthStore } from '@/store/useAuthStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

let inflight: Promise<string | null> | null = null;

/**
 * Native-only fallback when the refresh token is dead: log in again with the credentials saved
 * at the last interactive login. Resolves to the new access token, or null (web, no saved
 * credentials, or wrong password — the caller then logs out).
 */
export const silentLogin = (): Promise<string | null> => {
  if (Platform.OS === 'web') return Promise.resolve(null);
  inflight ??= (async () => {
    try {
      const creds = await credentialService.loadCredentials();
      if (!creds) return null;
      const resp = await axios.post(
        `${API_BASE_URL}/auth/login`,
        { email: creds.email.trim().toLowerCase(), password: creds.password },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      const data = resp.data?.data ?? resp.data;
      const access = data?.tokens?.accessToken ?? data?.accessToken ?? data?.access_token ?? null;
      const refresh = data?.tokens?.refreshToken ?? data?.refreshToken ?? data?.refresh_token ?? '';
      if (!data?.user || !access) return null;
      useAuthStore.getState().login(data.user, access, refresh);
      return access as string;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

/** Refresh failed and silent login failed: drop everything so the login screen shows. */
export const hardLogout = async () => {
  useAuthStore.getState().logout();
  if (Platform.OS !== 'web') await credentialService.clearCredentials();
};
