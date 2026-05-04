import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { usersApi } from '../api/users';

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
  /** Backend-mirrored — controls transactional + reminder emails. */
  emailNotifications: boolean;
  /** Backend-mirrored — Pro-only weekly AI digest email. */
  weeklyDigestEnabled: boolean;
  dateFormat: string;
  /** When true, analytics (Amplitude) tracking is disabled. Default false. */
  analyticsOptOut: boolean;
  /** User-declared ICP segment — drives conditional copy and explainer triggers. */
  icpSegment: 'solo' | 'family' | 'team' | null;
  setCurrency: (currency: string) => void;
  setCountry: (country: string) => void;
  setRegion: (region: string) => void;
  setDisplayCurrency: (currency: string) => void;
  setLanguage: (language: string) => void;
  setReminderDays: (days: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setEmailNotifications: (enabled: boolean) => void;
  setWeeklyDigestEnabled: (enabled: boolean) => void;
  setDateFormat: (format: string) => void;
  setAnalyticsOptOut: (optOut: boolean) => void;
  setIcpSegment: (segment: 'solo' | 'family' | 'team' | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'USD',
      country: 'US',
      region: 'US',
      displayCurrency: 'USD',
      language: 'en',
      reminderDays: 2,
      notificationsEnabled: true,
      emailNotifications: true,
      weeklyDigestEnabled: true,
      dateFormat: 'DD/MM',
      analyticsOptOut: false,
      icpSegment: null,
      setCurrency: (currency) => set({ currency, displayCurrency: currency }),
      setCountry: (country) => set({ country, region: country }),
      setRegion: (region) => set({ region: region.toUpperCase(), country: region.toUpperCase() }),
      setDisplayCurrency: (displayCurrency) =>
        set({ displayCurrency: displayCurrency.toUpperCase(), currency: displayCurrency.toUpperCase() }),
      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
        // Sync to backend so cron-driven push/email content matches the UI.
        // Fire-and-forget — auth may be missing on cold-start onboarding.
        usersApi.updateMe({ locale: language }).catch(() => {});
      },
      setReminderDays: (reminderDays) => set({ reminderDays }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setEmailNotifications: (emailNotifications) => set({ emailNotifications }),
      setWeeklyDigestEnabled: (weeklyDigestEnabled) => set({ weeklyDigestEnabled }),
      setDateFormat: (dateFormat) => set({ dateFormat }),
      setAnalyticsOptOut: (analyticsOptOut) => set({ analyticsOptOut }),
      setIcpSegment: (icpSegment) => set({ icpSegment }),
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
