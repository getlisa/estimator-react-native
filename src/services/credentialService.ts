import * as SecureStore from 'expo-secure-store';

const KEYS = {
  EMAIL: 'user_email',
  PASSWORD: 'user_password',
  REMEMBER_ME: 'remember_me',
} as const;

export interface SavedCredentials {
  email: string;
  password: string;
}

/**
 * Credential Storage Service
 * Uses expo-secure-store for encrypted storage of login credentials
 * 
 * iOS: Uses Keychain services
 * Android: Uses SharedPreferences encrypted with Keystore
 * 
 * @see https://docs.expo.dev/versions/latest/sdk/securestore/
 */
export const credentialService = {
  /**
   * Check if SecureStore is available on the device
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      return await SecureStore.isAvailableAsync();
    } catch {
      return false;
    }
  },

  /**
   * Save credentials securely
   * @param email - User's email
   * @param password - User's password
   */
  saveCredentials: async (email: string, password: string): Promise<void> => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.EMAIL, email, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        }),
        SecureStore.setItemAsync(KEYS.PASSWORD, password, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED,
        }),
        SecureStore.setItemAsync(KEYS.REMEMBER_ME, 'true'),
      ]);
    } catch (error) {
      throw error;
    }
  },

  /**
   * Load saved credentials
   * @returns Saved credentials or null if not found
   */
  loadCredentials: async (): Promise<SavedCredentials | null> => {
    try {
      const rememberMe = await SecureStore.getItemAsync(KEYS.REMEMBER_ME);
      
      if (rememberMe !== 'true') {
        return null;
      }

      const [email, password] = await Promise.all([
        SecureStore.getItemAsync(KEYS.EMAIL),
        SecureStore.getItemAsync(KEYS.PASSWORD),
      ]);

      if (email && password) {
        return { email, password };
      }

      return null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Check if credentials are saved
   */
  hasCredentials: async (): Promise<boolean> => {
    try {
      const rememberMe = await SecureStore.getItemAsync(KEYS.REMEMBER_ME);
      return rememberMe === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Clear all saved credentials
   */
  clearCredentials: async (): Promise<void> => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.EMAIL),
        SecureStore.deleteItemAsync(KEYS.PASSWORD),
        SecureStore.deleteItemAsync(KEYS.REMEMBER_ME),
      ]);
    } catch (error) {
    }
  },

  /**
   * Set remember me preference without changing credentials
   */
  setRememberMe: async (remember: boolean): Promise<void> => {
    try {
      if (remember) {
        await SecureStore.setItemAsync(KEYS.REMEMBER_ME, 'true');
      } else {
        await credentialService.clearCredentials();
      }
    } catch (error) {
    }
  },
};

export default credentialService;
