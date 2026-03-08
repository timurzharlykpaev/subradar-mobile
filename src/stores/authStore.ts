import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan?: 'free' | 'pro';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  setUser: (user: User, token: string) => void;
  logout: () => void;
  setOnboarded: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isOnboarded: false,
      setUser: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, isOnboarded: false }),
      setOnboarded: () => set({ isOnboarded: true }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
      }),
    }
  )
);
