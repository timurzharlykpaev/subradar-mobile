import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

const SECURE_KEY = 'auth-storage';
const ASYNC_FALLBACK_KEY = 'auth-storage-fallback';
// Where the non-sensitive half of the auth blob (user profile, flags) lives.
// Splitting it off keeps the SecureStore item small (just tokens) and avoids
// the >2KB warning that newer expo-secure-store versions will turn into a
// hard error.
const ASYNC_PROFILE_KEY = 'auth-storage-profile';

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

async function secureGet(name: string): Promise<string | null> {
  try {
    const v = await SecureStore.getItemAsync(name, SECURE_OPTS);
    if (v != null) return v;
  } catch {}
  try {
    return await AsyncStorage.getItem(`${ASYNC_FALLBACK_KEY}:${name}`);
  } catch {
    return null;
  }
}

async function secureSet(name: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(name, value, SECURE_OPTS);
    // Mirror to AsyncStorage so a later SecureStore-down read still gets
    // the freshest value. Cheap and removes a class of "token saved but
    // unreadable next launch" bugs.
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
}

async function secureRemove(name: string): Promise<void> {
  try { await SecureStore.deleteItemAsync(name, SECURE_OPTS); } catch {}
  try { await AsyncStorage.removeItem(`${ASYNC_FALLBACK_KEY}:${name}`); } catch {}
}

// Split storage adapter:
//   - tokens (small, sensitive)        → SecureStore (Keychain)
//   - user profile + flags (large)     → AsyncStorage
//
// The Zustand `persist` middleware writes one JSON string per key. We
// intercept that write, parse it, split into tokens / profile, and
// recombine on read. Externally it still looks like a single key.
//
// Migration from the pre-split format (everything in SecureStore under
// `auth-storage`) happens on first read: if the new split keys don't
// exist but the legacy SecureStore item does, we read it once, split,
// persist into the new shape, then delete the legacy item.
const splitStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const [tokensRaw, profileRaw] = await Promise.all([
      secureGet(name),
      AsyncStorage.getItem(`${ASYNC_PROFILE_KEY}:${name}`).catch(() => null),
    ]);

    // Fresh install with neither half present.
    if (tokensRaw == null && profileRaw == null) return null;

    // Two cases when SecureStore has data but AsyncStorage doesn't:
    //   1. Pre-split builds wrote the entire state under `name` in
    //      SecureStore (the "legacy blob" — recognised by the presence
    //      of `state.user` / `state.isAuthenticated`). Return it as-is;
    //      Zustand's next setItem rewrites it into the new split shape.
    //   2. Split-format data where the AsyncStorage half was wiped
    //      independently (Android partial app-data clear, storage
    //      corruption). Treat as no auth: leaving the tokens orphaned
    //      would let Axios send a token while `isAuthenticated=false`,
    //      causing a stream of 401s. One-time forced re-login is the
    //      safer outcome.
    if (tokensRaw && profileRaw == null) {
      try {
        const parsed = JSON.parse(tokensRaw);
        const inner = parsed?.state;
        if (inner && (inner.user !== undefined || inner.isAuthenticated !== undefined)) {
          return tokensRaw;
        }
      } catch {}
      // Split tokens without a profile → orphaned. Drop them.
      await secureRemove(name);
      return null;
    }

    let tokens: any = {};
    let profile: any = {};
    let version: number | undefined;
    try {
      const t = tokensRaw ? JSON.parse(tokensRaw) : null;
      if (t?.state) tokens = t.state;
      if (typeof t?.version === 'number') version = t.version;
    } catch {}
    try {
      const p = profileRaw ? JSON.parse(profileRaw) : null;
      if (p?.state) profile = p.state;
      if (version === undefined && typeof p?.version === 'number') version = p.version;
    } catch {}

    return JSON.stringify({ state: { ...profile, ...tokens }, version });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    let wrapper: any = null;
    try { wrapper = JSON.parse(value); } catch {}
    const state = wrapper?.state ?? {};
    const version = wrapper?.version;

    const tokenSlice = {
      token: state.token ?? null,
      refreshToken: state.refreshToken ?? null,
    };
    const profileSlice = {
      user: state.user ?? null,
      isAuthenticated: !!state.isAuthenticated,
      isOnboarded: !!state.isOnboarded,
    };

    await Promise.all([
      secureSet(name, JSON.stringify({ state: tokenSlice, version })),
      AsyncStorage.setItem(
        `${ASYNC_PROFILE_KEY}:${name}`,
        JSON.stringify({ state: profileSlice, version }),
      ).catch((e) => {
        if (__DEV__) console.warn('[authStore] profile AsyncStorage write failed:', e);
      }),
    ]);
  },
  removeItem: async (name: string): Promise<void> => {
    await Promise.all([
      secureRemove(name),
      AsyncStorage.removeItem(`${ASYNC_PROFILE_KEY}:${name}`).catch(() => {}),
    ]);
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
        // Clear per-user flags so a new account doesn't inherit the
        // previous user's trial/welcome state.
        AsyncStorage.multiRemove(['trial_offered', 'welcome_shown']).catch(() => {});
        // Keep `isOnboarded` true on logout. The onboarding screen
        // internally checks `isOnboarded` and jumps straight to the
        // login step (see app/onboarding.tsx — `setStep(isOnboarded ? 3 : 0)`),
        // so the user gets sent to the auth UI without re-watching the
        // welcome slides they already saw.
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },
      setOnboarded: () => set({ isOnboarded: true }),
    }),
    {
      name: SECURE_KEY,
      storage: createJSONStorage(() => splitStorage),
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
