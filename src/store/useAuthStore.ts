import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  job_title?: string;
  /** Mirrors the backend user_role enum. Check with isAdminRole() from '@/lib/roles'. */
  role?: 'technician' | 'admin' | 'service_manager';
  company_id?: number;
  created_at?: string;
  updated_at?: string;
}

interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  _hasHydrated: boolean;
  login: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setAccessToken: (token: string) => void;
  setRefreshToken: (token: string) => void;
  setHasHydrated: (state: boolean) => void;
}

/** Auth store persisted to AsyncStorage (localStorage on web) under 'auth-storage'. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      access_token: null,
      refresh_token: null,
      _hasHydrated: false,
      login: (user, accessToken, refreshToken) =>
        set({ user, access_token: accessToken, refresh_token: refreshToken }),
      logout: () => set({ user: null, access_token: null, refresh_token: null }),
      setAccessToken: (token) => set({ access_token: token }),
      setRefreshToken: (token) => set({ refresh_token: token }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        access_token: state.access_token,
        refresh_token: state.refresh_token,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    }
  )
);

export default useAuthStore;
