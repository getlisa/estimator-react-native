import { refreshAccessToken } from '@/services/apiClient';
import { hardLogout } from '@/lib/silentLogin';

/**
 * Drop-in replacement for fetch() on copilot-server calls. Those calls don't go
 * through the axios apiClient, so its silent-refresh interceptor never sees their
 * 401s — an expired access token made every quotes/chat request fail until the
 * user logged out and back in. On a 401 for a request that carried a Bearer token,
 * refresh once (single-flight, shared with the axios interceptor) and retry with
 * the new token; log out only when the refresh itself fails, same as the interceptor.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, init);

  const headers = init?.headers as Record<string, string> | undefined;
  if (res.status !== 401 || !headers?.Authorization) return res;

  const newAccess = await refreshAccessToken();
  if (!newAccess) {
    void hardLogout();
    return res;
  }

  return fetch(input, {
    ...init,
    headers: { ...headers, Authorization: `Bearer ${newAccess}` },
  });
}
