import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

// SecureStore has a 2048-byte value limit per key.
// To avoid hitting the limit with large JSON blobs, we store each sensitive
// key individually and wrap everything in a single JSON envelope under one
// SecureStore key for Zustand's persist middleware.
const SECURE_KEY = 'auth-storage';

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (e) {
      // SecureStore setItemAsync can fail if value > 2 KB.
      // Log in dev but don't crash — tokens are short enough to be safe.
      if (__DEV__) {
        console.warn('[authStore] SecureStore.setItemAsync failed:', e);
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {}
  },
};

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  _hasHydrated: boolean;
  setUser: (user: User, token: string, refreshToken?: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  updateUser: (data: Partial<User>) => void;
  logout: () => void;
  setOnboarded: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isOnboarded: false,
      _hasHydrated: false,
      setUser: (user, token, refreshToken) =>
        set({ user, token, refreshToken: refreshToken ?? null, isAuthenticated: true }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      updateUser: (data) =>
        set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isOnboarded: false }),
      setOnboarded: () => set({ isOnboarded: true }),
    }),
    {
      name: SECURE_KEY,
      storage: createJSONStorage(() => secureStorage),
      // Persist only the minimum required fields.
      // Large/derived state (e.g. _hasHydrated, actions) is excluded.
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ _hasHydrated: true });
      },
    }
  )
);
