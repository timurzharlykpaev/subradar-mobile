import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';

interface SettingsState {
  /** @deprecated — kept for backward compatibility. Use displayCurrency. */
  currency: string;
  /** @deprecated — kept for backward compatibility. Use region. */
  country: string;
  /** ISO-3166 alpha-2 region where user buys subscriptions. Drives AI pricing. */
  region: string;
  /** ISO-4217 currency for displaying subscription totals. Independent from region. */
  displayCurrency: string;
  language: string;
  reminderDays: number;
  notificationsEnabled: boolean;
  dateFormat: string;
  setCurrency: (currency: string) => void;
  setCountry: (country: string) => void;
  setRegion: (region: string) => void;
  setDisplayCurrency: (currency: string) => void;
  setLanguage: (language: string) => void;
  setReminderDays: (days: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setDateFormat: (format: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'USD',
      country: 'US',
      region: 'US',
      displayCurrency: 'USD',
      language: 'en',
      reminderDays: 3,
      notificationsEnabled: true,
      dateFormat: 'DD/MM',
      setCurrency: (currency) => set({ currency, displayCurrency: currency }),
      setCountry: (country) => set({ country, region: country }),
      setRegion: (region) => set({ region: region.toUpperCase(), country: region.toUpperCase() }),
      setDisplayCurrency: (displayCurrency) =>
        set({ displayCurrency: displayCurrency.toUpperCase(), currency: displayCurrency.toUpperCase() }),
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },
      setReminderDays: (reminderDays) => set({ reminderDays }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
    }),
    {
      name: 'subradar-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (!persistedState) return persistedState;
        if (version < 2) {
          return {
            ...persistedState,
            region:
              persistedState.region ??
              (typeof persistedState.country === 'string'
                ? persistedState.country.toUpperCase()
                : 'US'),
            displayCurrency:
              persistedState.displayCurrency ??
              (typeof persistedState.currency === 'string'
                ? persistedState.currency.toUpperCase()
                : 'USD'),
          };
        }
        return persistedState;
      },
    },
  ),
);
