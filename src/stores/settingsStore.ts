import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

interface SettingsState {
  currency: string;
  country: string;
  language: string;
  reminderDays: number[];
  notificationsEnabled: boolean;
  setCurrency: (currency: string) => void;
  setCountry: (country: string) => void;
  setLanguage: (language: string) => void;
  setReminderDays: (days: number[]) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'USD',
      country: 'US',
      language: 'en',
      reminderDays: [1, 3, 7],
      notificationsEnabled: true,
      setCurrency: (currency) => set({ currency }),
      setCountry: (country) => set({ country }),
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      setReminderDays: (reminderDays) => set({ reminderDays }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
    }),
    {
      name: 'subradar-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
