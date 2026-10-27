import { authFetch } from '@/services/authFetch';
import { useAuthStore } from '@/store/useAuthStore';

/** copilot-server base. Dev default matches eas.json development profile. */
export const COPILOT_BASE_URL = process.env.EXPO_PUBLIC_COPILOT_BASE_URL || 'http://localhost:3000';
export const COPILOT_API_BASE = `${COPILOT_BASE_URL}/api/v1`;

const DEV_BYPASS = process.env.EXPO_PUBLIC_COPILOT_DEV_BYPASS === 'true';
const DEV_USER_ID = process.env.EXPO_PUBLIC_COPILOT_DEV_USER_ID;
const DEV_USER_EMAIL = process.env.EXPO_PUBLIC_COPILOT_DEV_USER_EMAIL;
const DEV_USER_ROLE = process.env.EXPO_PUBLIC_COPILOT_DEV_USER_ROLE;
const DEV_COMPANY_ID = process.env.EXPO_PUBLIC_COPILOT_DEV_COMPANY_ID;

type HeadersShape = Record<string, string>;

/** Bearer header (or the dev-bypass set when no token and EXPO_PUBLIC_COPILOT_DEV_BYPASS=true). */
export const buildHeaders = (asJson: boolean = true): HeadersShape => {
  const headers: HeadersShape = {};
  if (asJson) headers['Content-Type'] = 'application/json';
  const { access_token } = useAuthStore.getState();
  if (access_token) {
    headers['Authorization'] = `Bearer ${access_token}`;
  } else if (DEV_BYPASS) {
    headers['X-Dev-Bypass'] = 'true';
    if (DEV_USER_ID) headers['X-User-Id'] = DEV_USER_ID;
    if (DEV_USER_EMAIL) headers['X-User-Email'] = DEV_USER_EMAIL;
    if (DEV_USER_ROLE) headers['X-User-Role'] = DEV_USER_ROLE;
    if (DEV_COMPANY_ID) headers['X-Company-Id'] = DEV_COMPANY_ID;
  }
  return headers;
};

export const copilotChatService = {
  async transcribeVoice(params: {
    audioBase64: string;
    mimeType?: string;
    language?: string;
  }): Promise<{ success: boolean; text: string }> {
    const res = await authFetch(`${COPILOT_API_BASE}/voice/transcribe`, {
      method: 'POST',
      headers: buildHeaders(true),
      body: JSON.stringify({
        audioBase64: params.audioBase64,
        mimeType: params.mimeType || 'audio/webm',
        language: params.language,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`voice/transcribe failed (${res.status}): ${body || 'no response body'}`);
    }
    return res.json();
  },
};
