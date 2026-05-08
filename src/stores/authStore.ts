import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const SECURE_KEY = 'auth-storage';
const ASYNC_FALLBACK_KEY = 'auth-storage-fallback';

// SecureStore options:
//   `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` lets the Keychain item be read
//   after the user has unlocked the device at least once since boot, and
//   stays readable while the app runs in the background. The default
//   (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) fails with "User interaction is
//   not allowed." right after boot or while the device is locked — that
//   produces silent token-write failures, the mobile login state goes
//   missing, and every API call returns 401, surfacing as "this account
//   cannot perform actions" in the UI.
//
// AsyncStorage fallback:
//   Expo Go and some sandboxed simulator setups can't reach the
//   Keychain at all. When SecureStore throws, we fall back to
//   AsyncStorage so the user stays logged in. AsyncStorage is unsigned,
//   but the threat model here is "lost token = user gets logged out
//   mid-session"; treating that as worse than plaintext-on-device for
//   the dev/Expo-Go case is a reasonable trade-off. Production EAS
//   builds use SecureStore as the primary, so this branch only fires on
//   genuine Keychain unavailability.
const SECURE_OPTS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const v = await SecureStore.getItemAsync(name, SECURE_OPTS);
      if (v != null) return v;
    } catch {}
    try {
      return await AsyncStorage.getItem(`${ASYNC_FALLBACK_KEY}:${name}`);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value, SECURE_OPTS);
      // Mirror to AsyncStorage so a later SecureStore-down read still
      // gets the freshest value. Cheap and removes a class of "token
      // saved but unreadable next launch" bugs.
      try { await AsyncStorage.setItem(`${ASYNC_FALLBACK_KEY}:${name}`, value); } catch {}
      return;
    } catch (e) {
      if (__DEV__) {
        console.warn('[authStore] SecureStore unavailable, using AsyncStorage:', e);
      }
      try {
        await AsyncStorage.setItem(`${ASYNC_FALLBACK_KEY}:${name}`, value);
      } catch (asyncErr) {
        if (__DEV__) {
          console.warn('[authStore] AsyncStorage fallback also failed:', asyncErr);
        }
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try { await SecureStore.deleteItemAsync(name, SECURE_OPTS); } catch {}
    try { await AsyncStorage.removeItem(`${ASYNC_FALLBACK_KEY}:${name}`); } catch {}
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
      logout: () => {
        // Clear per-user flags so new account gets fresh experience
        AsyncStorage.multiRemove(['trial_offered', 'welcome_shown']).catch(() => {});
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isOnboarded: false,
        });
      },
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
