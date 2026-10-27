/// <reference types="jest" />
/**
 * The auth chain behind every API call: 401 → refresh once → retry; dead refresh → silent
 * re-login from saved credentials (native) → retry; that failing → logout + credentials cleared.
 */
import axios from 'axios';

jest.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    setItemAsync: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    getItemAsync: jest.fn(async (k: string) => store[k] ?? null),
    deleteItemAsync: jest.fn(async (k: string) => { delete store[k]; }),
    isAvailableAsync: jest.fn(async () => true),
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    __store: store,
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import apiClient, { api } from '@/services/apiClient';
import { credentialService } from '@/services/credentialService';
import { useAuthStore } from '@/store/useAuthStore';

type Handler = (cfg: { url?: string; headers?: Record<string, string>; data?: string }) => { status: number; data: unknown };

const installAdapter = (handler: Handler) => {
  const adapter = jest.fn(async (cfg: any) => {
    const { status, data } = handler(cfg);
    if (status >= 400) {
      const err: any = new Error(`Request failed with status code ${status}`);
      err.config = cfg; err.response = { status, data, headers: {}, config: cfg }; err.isAxiosError = true;
      throw err;
    }
    return { status, data, headers: {}, config: cfg, statusText: 'OK' };
  });
  axios.defaults.adapter = adapter;
  apiClient.defaults.adapter = adapter;
  return adapter;
};

const session = () => useAuthStore.getState().login({ id: '1', email: 'a@b.c', first_name: 'A', last_name: 'B' }, 'old-access', 'refresh-1');

beforeEach(() => { useAuthStore.getState().logout(); jest.clearAllMocks(); });

test('401 → refresh once → retry with the new token', async () => {
  session();
  let refreshes = 0;
  const adapter = installAdapter((cfg) => {
    if (cfg.url?.includes('/auth/refresh')) { refreshes++; return { status: 200, data: { data: { accessToken: 'new-access' } } }; }
    const auth = cfg.headers?.Authorization;
    return auth === 'Bearer new-access' ? { status: 200, data: { data: { ok: true } } } : { status: 401, data: { error: { message: 'expired' } } };
  });
  await expect(api.get('/users/self')).resolves.toEqual({ ok: true });
  expect(refreshes).toBe(1);
  expect(useAuthStore.getState().access_token).toBe('new-access');
  expect(adapter).toHaveBeenCalledTimes(3); // original, refresh, retry
});

test('dead refresh → silent login with saved credentials → retry', async () => {
  session();
  await credentialService.saveCredentials('a@b.c', 'pw');
  installAdapter((cfg) => {
    if (cfg.url?.includes('/auth/refresh')) return { status: 401, data: { error: { message: 'dead' } } };
    if (cfg.url?.includes('/auth/login')) {
      expect(JSON.parse(cfg.data ?? '{}')).toEqual({ email: 'a@b.c', password: 'pw' });
      return { status: 200, data: { data: { user: { id: '1', email: 'a@b.c', first_name: 'A', last_name: 'B' }, tokens: { accessToken: 'relogin-access', refreshToken: 'refresh-2' } } } };
    }
    return cfg.headers?.Authorization === 'Bearer relogin-access' ? { status: 200, data: { data: { ok: true } } } : { status: 401, data: {} };
  });
  await expect(api.get('/users/self')).resolves.toEqual({ ok: true });
  expect(useAuthStore.getState().refresh_token).toBe('refresh-2');
});

test('dead refresh + wrong saved password → logged out and credentials cleared', async () => {
  session();
  await credentialService.saveCredentials('a@b.c', 'stale');
  installAdapter((cfg) => {
    if (cfg.url?.includes('/auth/refresh') || cfg.url?.includes('/auth/login')) return { status: 401, data: { error: { message: 'nope' } } };
    return { status: 401, data: {} };
  });
  await expect(api.get('/users/self')).rejects.toBeTruthy();
  await new Promise((r) => setTimeout(r, 0)); // hardLogout is fire-and-forget
  expect(useAuthStore.getState().access_token).toBeNull();
  expect(await credentialService.hasCredentials()).toBe(false);
});
