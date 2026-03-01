import { create } from 'zustand';

interface SettingsState {
  currency: string;
  country: string;
  reminderDays: number[];
  notificationsEnabled: boolean;
  setCurrency: (currency: string) => void;
  setCountry: (country: string) => void;
  setReminderDays: (days: number[]) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currency: 'USD',
  country: 'US',
  reminderDays: [1, 3, 7],
  notificationsEnabled: true,
  setCurrency: (currency) => set({ currency }),
  setCountry: (country) => set({ country }),
  setReminderDays: (reminderDays) => set({ reminderDays }),
  setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
}));
