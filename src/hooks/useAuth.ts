import { useCallback } from 'react';
import { Platform } from 'react-native';

import { authService } from '@/services/authService';
import { credentialService } from '@/services/credentialService';
import { useAuthStore } from '@/store/useAuthStore';

export const useAuth = () => {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.access_token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  const login = useCallback(async (email: string, password: string) => {
    await authService.login({ email, password });
    // Native: remember credentials so a dead refresh token never shows the login screen again.
    if (Platform.OS !== 'web') {
      await credentialService.saveCredentials(email.trim().toLowerCase(), password).catch(() => {});
    }
  }, []);

  const logout = useCallback(async () => {
    if (Platform.OS !== 'web') await credentialService.clearCredentials();
    await authService.logout();
  }, []);

  return { user, isAuthenticated: !!accessToken && !!user, hasHydrated, login, logout };
};

export default useAuth;
